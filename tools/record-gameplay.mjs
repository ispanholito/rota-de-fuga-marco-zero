/**
 * Grava um vídeo de gameplay automatizado (Artefato 03).
 *
 * Abre o build de arquivo único num navegador Chromium com captura de vídeo
 * ligada e joga uma partida roteirizada, caminhando de verdade pelo cenário
 * (busca em largura para achar o caminho + teclas seguradas, como um jogador
 * faria) em vez de teleportar o personagem. Legendas são injetadas na página
 * durante a partida para explicar cada sistema demonstrado.
 *
 * Saída: dist/gameplay.webm (convertido para .mp4 pelo script de empacotamento).
 *
 * Uso: node tools/record-gameplay.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const JOGO = `file://${path.join(ROOT, 'dist', 'rota-de-fuga-standalone.html')}`;
const SAIDA = path.join(ROOT, 'dist', 'video');
const TILE = 32;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 760 },
  recordVideo: { dir: SAIDA, size: { width: 1280, height: 760 } },
});
const page = await context.newPage();

const espera = (ms) => page.waitForTimeout(ms);

await page.goto(JOGO);
await page.waitForFunction(() => window.jogo !== undefined);

// ---------------------------------------------------------------- legendas
await page.addStyleTag({
  content: `
    #legenda {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 99;
      background: linear-gradient(transparent, rgba(0,0,0,.92) 35%);
      color: #d6ffcb; font: 20px "Courier New", monospace; letter-spacing: .5px;
      text-align: center; padding: 40px 60px 22px; pointer-events: none;
      opacity: 0; transition: opacity .35s ease;
    }
    #legenda.on { opacity: 1; }
    #legenda b { color: #39ff14; }
    #selo-demo {
      position: fixed; top: 10px; right: 16px; z-index: 99;
      color: #cc5500; font: 11px "Courier New", monospace; letter-spacing: 2px;
      opacity: .75; pointer-events: none;
    }
  `,
});
await page.evaluate(() => {
  const el = document.createElement('div');
  el.id = 'legenda';
  document.body.appendChild(el);

  const selo = document.createElement('div');
  selo.id = 'selo-demo';
  selo.textContent = 'MODO DEMONSTRAÇÃO · CRONÔMETRO ASSISTIDO (PAUSA NAS EXPLICAÇÕES)';
  document.body.appendChild(selo);
  window.__legenda = (html) => {
    const l = document.getElementById('legenda');
    if (!html) { l.classList.remove('on'); return; }
    l.innerHTML = html;
    l.classList.add('on');
  };
});

const legenda = (html) => page.evaluate((h) => window.__legenda(h), html);

// Piso de segurança do cronômetro: impede que a gravação termine em Game Over
// por causa do tempo gasto lendo legendas. Sinalizado em tela pelo selo de demo.
await page.evaluate(() => {
  setInterval(() => {
    const t = window.jogo && window.jogo.threat;
    if (t && t.remaining < 25) t.remaining = 25;
  }, 500);
});

/**
 * Pausa de leitura da legenda.
 *
 * Durante a explicação o cronômetro da ameaça é mantido no valor em que estava:
 * sem isso, o tempo de leitura das legendas consumiria o tempo de jogo e a
 * demonstração terminaria em Game Over no meio de uma frase. O selo
 * "MODO DEMONSTRAÇÃO" fica visível em tela o vídeo inteiro para deixar claro
 * que essa pausa existe — em jogo normal o relógio nunca para.
 */
async function explicar(html, ms) {
  await legenda(html);
  const congelado = await page.evaluate(() => window.jogo.threat?.remaining ?? null);
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    await espera(250);
    if (congelado !== null) {
      await page.evaluate((v) => {
        if (window.jogo.threat) window.jogo.threat.remaining = v;
      }, congelado);
    }
  }
}

// ------------------------------------------------------- navegação no mapa
/** Caminho em tiles até um destino, por busca em largura (dentro da página). */
async function caminhoAte(gx, gy) {
  return page.evaluate(({ tx, ty }) => {
    const g = window.jogo;
    const L = g.level;
    const inicio = { x: Math.floor(g.player.x / 32), y: Math.floor(g.player.y / 32) };
    const chave = (p) => `${p.x},${p.y}`;
    const anterior = new Map([[chave(inicio), null]]);
    const fila = [inicio];
    while (fila.length) {
      const atual = fila.shift();
      if (atual.x === tx && atual.y === ty) {
        const caminho = [];
        let passo = atual;
        while (passo) { caminho.unshift(passo); passo = anterior.get(`${passo.x},${passo.y}`); }
        return caminho.slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const prox = { x: atual.x + dx, y: atual.y + dy };
        if (anterior.has(chave(prox))) continue;
        if (L.isSolidTile(L.tileAt(prox.x, prox.y))) continue;
        anterior.set(chave(prox), atual);
        fila.push(prox);
      }
    }
    return [];
  }, { tx: gx, ty: gy });
}

const TECLA = { '1,0': 'KeyD', '-1,0': 'KeyA', '0,1': 'KeyS', '0,-1': 'KeyW' };
const OPOSTA = { KeyD: 'KeyA', KeyA: 'KeyD', KeyS: 'KeyW', KeyW: 'KeyS' };

const posPixel = () => page.evaluate(() => ({ x: window.jogo.player.x, y: window.jogo.player.y }));

/**
 * Anda exatamente um tile, parando no CENTRO do tile de destino.
 *
 * Parar no centro é essencial: a caixa de colisão do personagem tem 18px num
 * tile de 32px, então um personagem parado sobre a divisa entre dois tiles
 * encosta na fileira vizinha e trava ao tentar virar. Depois de segurar a tecla,
 * pequenos toques na tecla oposta corrigem o excesso.
 */
async function passo(destino) {
  const atual = await page.evaluate(() => ({
    x: Math.floor(window.jogo.player.x / 32),
    y: Math.floor(window.jogo.player.y / 32),
  }));
  const tecla = TECLA[`${destino.x - atual.x},${destino.y - atual.y}`];
  if (!tecla) return false;

  const horizontal = tecla === 'KeyD' || tecla === 'KeyA';
  const centro = horizontal ? destino.x * 32 + 16 : destino.y * 32 + 16;
  const sentido = (tecla === 'KeyD' || tecla === 'KeyS') ? 1 : -1;
  const coord = (pos) => (horizontal ? pos.x : pos.y);

  await page.keyboard.down(tecla);
  const limite = Date.now() + 2500;
  for (;;) {
    await espera(25);
    const pos = await posPixel();
    if ((coord(pos) - centro) * sentido >= -1) break;   // alcançou o centro
    if (Date.now() > limite) break;                      // travou: desiste do passo
  }
  await page.keyboard.up(tecla);

  // correção fina: elimina o excesso para o personagem ficar centralizado
  for (let i = 0; i < 6; i++) {
    const pos = await posPixel();
    const erro = coord(pos) - centro;
    if (Math.abs(erro) <= 3) break;
    const correcao = erro > 0 ? OPOSTA[tecla] : tecla;
    await page.keyboard.down(correcao);
    await espera(Math.min(60, Math.max(20, Math.abs(erro) * 7)));
    await page.keyboard.up(correcao);
  }
  return true;
}

const tileAtual = () => page.evaluate(() => ({
  x: Math.floor(window.jogo.player.x / 32),
  y: Math.floor(window.jogo.player.y / 32),
}));

/**
 * Caminha até um tile livre vizinho ao alvo (objeto, terminal, comporta).
 *
 * O caminho é recalculado a cada passo: se o personagem passar do tile alvo por
 * uma fração de segundo (latência entre soltar a tecla e ler a posição), a rota
 * seguinte já sai da posição real, em vez de o roteiro dessincronizar.
 */
async function irAte(alvoGx, alvoGy, { entrarNoTile = false, limiteMs = 30000 } = {}) {
  let destino = { x: alvoGx, y: alvoGy };
  if (!entrarNoTile) {
    destino = await page.evaluate(({ gx, gy }) => {
      const L = window.jogo.level;
      for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        if (!L.isSolidTile(L.tileAt(gx + dx, gy + dy))) return { x: gx + dx, y: gy + dy };
      }
      return { x: gx, y: gy };
    }, { gx: alvoGx, gy: alvoGy });
  }

  const prazo = Date.now() + limiteMs;
  for (;;) {
    const atual = await tileAtual();
    if (atual.x === destino.x && atual.y === destino.y) return true;
    if (Date.now() > prazo) {
      console.warn(`aviso: não chegou em (${destino.x},${destino.y})`);
      return false;
    }
    const caminho = await caminhoAte(destino.x, destino.y);
    if (!caminho.length) return false;
    await passo(caminho[0]);
  }
}

/** Vai até uma pista e inspeciona, conferindo que o diário registrou. */
async function coletar(indice) {
  const antes = await page.evaluate(() => window.jogo.journal.entries().length);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const prop = await posProp(indice);
    await irAte(prop.gx, prop.gy);
    await espera(350);
    await page.keyboard.press('KeyE');
    await espera(500);
    const agora = await page.evaluate(() => window.jogo.journal.entries().length);
    if (agora > antes) return true;
  }
  console.warn(`aviso: pista ${indice} não coletada`);
  return false;
}

/** Atravessa a comporta liberada e confere que o setor mudou. */
async function atravessar() {
  const setorAntes = await page.evaluate(() => window.jogo.level.sector);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const porta = await posPorta();
    await irAte(porta.gx, porta.gy, { entrarNoTile: true, limiteMs: 20000 });
    await espera(700);
    const estado = await page.evaluate(() => ({ s: window.jogo.state, setor: window.jogo.level.sector }));
    if (estado.s === 'VICTORY' || estado.setor !== setorAntes) return true;
  }
  console.warn('aviso: não atravessou a comporta');
  return false;
}

const posProp = (i) => page.evaluate((idx) => {
  const p = window.jogo.level.props[idx];
  return { gx: p.gx, gy: p.gy };
}, i);

const posTerminal = () => page.evaluate(() => ({
  gx: window.jogo.level.terminal.gx, gy: window.jogo.level.terminal.gy,
}));

const posPorta = () => page.evaluate(() => ({
  gx: window.jogo.level.door.gx, gy: window.jogo.level.door.gy,
}));

const digitar = async (texto) => {
  for (const ch of String(texto)) {
    await page.keyboard.press(ch === '-' ? 'Minus' : `Digit${ch}`);
    await espera(220);
  }
};

// ---------------------------------------------------------------- roteiro

/** Sai do briefing e entra no setor, confirmando a transição de estado. */
async function entrarNoSetor() {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    if (await page.evaluate(() => window.jogo.state) === 'PLAYING') return;
    await page.keyboard.press('Enter');
    await espera(600);
  }
}

await page.click('#aviso-foco');
await espera(600);

// --- abertura ---
await explicar('<b>ROTA DE FUGA: MARCO ZERO</b> &nbsp;·&nbsp; PAC Extensionista — Engenharia de Software', 4200);
await explicar('Protótipo jogável da entrega <b>N1</b> — cinco setores, HTML5 Canvas, sem engine', 4000);
await legenda('');
await espera(700);

await page.keyboard.press('Enter');   // menu -> briefing
await espera(2400);
await explicar('Cada setor abre com um <b>briefing narrativo</b>', 3000);
await legenda('');
await entrarNoSetor();
await espera(800);

// --- setor 1: o loop completo, com calma ---
await explicar('<b>SETOR 1 — ENFERMARIA.</b> A lanterna revela só o que está por perto: o bunker é escuro.', 4000);
await irAte(6, 4);
await explicar('No topo: <b>vida</b>, <b>radiação</b>, pistas encontradas e o <b>tempo</b> até os saqueadores chegarem.', 4200);
await explicar('O painel à direita é o <b>diário do engenheiro</b>, preenchido sozinho.', 3400);

await legenda('Objetos com contorno verde escondem as <b>variáveis</b> da senha. A tecla <b>E</b> inspeciona.');
await coletar(0);
await explicar('As variáveis chegam como fragmentos da história — não como enunciado de prova.', 4200);

await legenda('Falta a segunda variável.');
await coletar(1);
await explicar('Diário atualizado: o jogador não precisa de papel e caneta.', 3600);

await legenda('Com as duas variáveis, o <b>terminal CRT</b> da comporta.');
let t = await posTerminal();
await irAte(t.gx, t.gy);
await espera(500);
await page.keyboard.press('KeyE');
await espera(1000);
await explicar('A expressão do Setor 1: <b>X = A + B</b>, com A = 7 e B = 5.', 4200);

await explicar('Primeiro, um <b>erro de propósito</b>:', 2200);
await digitar('99');
await espera(600);
await page.keyboard.press('Enter');
await espera(1600);
await explicar('Errar aciona o alarme e <b>desconta 10 segundos</b> do tempo até a invasão.', 4000);

await explicar('Agora a resposta correta: 7 + 5 = <b>12</b>', 2600);
await digitar('12');
await espera(500);
await page.keyboard.press('Enter');
await espera(2400);
await legenda('Trinco hidráulico liberado. A saída fica na borda leste do mapa.');
await atravessar();
await espera(1400);

// --- setor 2: regra de sinais e furtividade ---
await legenda('');
await espera(1600);
await entrarNoSetor();
await espera(700);
await explicar('<b>SETOR 2 — ALOJAMENTOS.</b> A dificuldade sobe: parênteses e regra de sinais.', 3600);

await legenda('');
await coletar(0);
await espera(1600);
await coletar(1);
await espera(1400);

await explicar('Andar colado aos caixotes deixa o engenheiro lento, porém <b>silencioso</b>: o tempo corre mais devagar.', 4200);
t = await posTerminal();
await irAte(t.gx, t.gy);
await espera(500);
await page.keyboard.press('KeyE');
await espera(900);
await explicar('<b>X = (A × B) − 15</b>, com A = 5 e B = −2 &nbsp;→&nbsp; (5 × −2) − 15 = <b>−25</b>', 5000);
await digitar('-25');
await espera(500);
await page.keyboard.press('Enter');
await espera(2200);
await legenda('');
await atravessar();
await espera(1400);

// --- setor 3: radiação ---
await entrarNoSetor();
await espera(700);
await explicar('<b>SETOR 3 — SALA DE MÁQUINAS.</b> Um vazamento radioativo bloqueia o caminho central.', 3800);

await legenda('Pisar na poça carrega a barra <b>RAD</b> — e o contador Geiger acelera.');
await irAte(13, 4, { entrarNoTile: true, limiteMs: 15000 });
await espera(2600);
await explicar('Saturada, a barra causa dano, reduz a velocidade e encolhe o facho da lanterna.', 3200);
await irAte(11, 4, { limiteMs: 15000 });
await espera(900);

await legenda('');
await coletar(0);
await espera(1500);
await coletar(1);
await espera(1300);

t = await posTerminal();
await irAte(t.gx, t.gy);
await espera(500);
await page.keyboard.press('KeyE');
await espera(900);
await explicar('Agora é equação de 1º grau: <b>2X + A = B</b>, com A = 4 e B = 18 &nbsp;→&nbsp; X = <b>7</b>', 4800);
await digitar('7');
await espera(500);
await page.keyboard.press('Enter');
await espera(2200);
await legenda('');
await atravessar();
await espera(1400);

// --- setores 4 e 5 ---
for (const setor of [4, 5]) {
  await entrarNoSetor();
  await espera(700);
  await explicar(setor === 4
    ? '<b>SETOR 4 — CENTRO DE COMANDO.</b> Potência e prioridade de operadores.'
    : '<b>SETOR 5 — ZONA DE QUARENTENA.</b> Radiação extrema e o tempo mais curto do jogo.', 3400);

  await legenda('');
  const total = await page.evaluate(() => window.jogo.level.props.length);
  for (let i = 0; i < total; i++) {
    await coletar(i);
    await espera(1300);
  }

  t = await posTerminal();
  await irAte(t.gx, t.gy);
  await espera(500);
  await page.keyboard.press('KeyE');
  await espera(900);

  const puzzle = await page.evaluate(() => ({
    display: window.jogo.level.def.puzzle.display.replace(/\*/g, '×'),
    answer: window.jogo.level.def.puzzle.answer,
  }));
  await explicar(`<b>${puzzle.display}</b> &nbsp;→&nbsp; X = <b>${puzzle.answer}</b>`, 4600);
  await digitar(puzzle.answer);
  await espera(500);
  await page.keyboard.press('Enter');
  await espera(2200);
  await legenda('');
  await atravessar();
  await espera(1800);
}

// --- encerramento ---
await explicar('Cinco setores concluídos — do <b>A + B</b> da enfermaria à álgebra da zona de quarentena.', 4600);
await explicar('Para a <b>N2</b>: saqueadores visíveis, expressões geradas dinamicamente e balanceamento por playtest.', 5000);
await legenda('');
await espera(2000);

const estadoFinal = await page.evaluate(() => window.jogo.state);
console.log('estado final:', estadoFinal);

await context.close();   // fechar o contexto é o que grava o vídeo em disco
await browser.close();
console.log('vídeo salvo em', path.relative(ROOT, SAIDA));
