/**
 * Arte do jogo — gerada proceduralmente em código (pixel art 16x16 escalada 2x).
 *
 * Decisão de projeto: não há dependência de arquivos de imagem externos. Todos
 * os tiles, props e quadros de animação do personagem são desenhados uma única
 * vez em canvas fora da tela, na inicialização, e depois apenas copiados
 * (blit) a cada quadro. Isso mantém o custo de renderização baixo e garante
 * que o projeto rode a partir de qualquer pasta, sem assets faltando.
 *
 * Paleta oficial do GDD:
 *   #1A1A1A  concreto / sombras
 *   #39FF14  terminais e radiação
 *   #CC5500  ferrugem e uniforme do engenheiro
 */

import { makeRng, offscreen } from '../engine/utils.js';

export const TILE = 32;   // tamanho do tile em pixels de tela
const GRID = 16;          // resolução lógica da arte (16x16)
const SCALE = TILE / GRID;

const PAL = {
  concreto: '#1a1a1a',
  concretoClaro: '#2a2a2a',
  concretoTopo: '#343434',
  piso: '#22261f',
  pisoAlt: '#2a2f26',
  junta: '#171a15',
  ferrugem: '#cc5500',
  ferrugemEsc: '#7a3300',
  metal: '#4a4a4a',
  metalEsc: '#2e2e2e',
  verde: '#39ff14',
  verdeEsc: '#1d7a0c',
  vidro: '#08210a',
  pele: '#c9a07a',
  capacete: '#3b3b3b',
  bota: '#232323',
  luz: '#e9ffcf',
  osso: '#cfc9b0',
  sangue: '#5a1f1f',
};

/** Desenha um "pixel" lógico (bloco SCALE x SCALE). */
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

// ---------------------------------------------------------------- TILES

function makeFloor(seed) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  const rng = makeRng(seed);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  // juntas do piso industrial
  px(ctx, 0, 0, 16, 1, PAL.junta);
  px(ctx, 0, 0, 1, 16, PAL.junta);
  px(ctx, 8, 0, 1, 16, '#1c201a');
  px(ctx, 0, 8, 16, 1, '#1c201a');
  // sujeira/manchas determinísticas
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * 16);
    const y = Math.floor(rng() * 16);
    px(ctx, x, y, 1, 1, rng() > 0.75 ? PAL.pisoAlt : '#1d211b');
  }
  if (rng() > 0.7) px(ctx, 3 + Math.floor(rng() * 8), 4 + Math.floor(rng() * 7), 2, 1, '#221d16');
  return canvas;
}

function makeWall(seed) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  const rng = makeRng(seed);
  px(ctx, 0, 0, 16, 16, PAL.concretoClaro);
  px(ctx, 0, 0, 16, 2, '#3f3f3f');      // topo iluminado
  px(ctx, 0, 14, 16, 2, '#0d0d0d');            // base em sombra
  // blocos de concreto
  px(ctx, 0, 7, 16, 1, '#111');
  px(ctx, 7, 2, 1, 5, '#111');
  px(ctx, 11, 8, 1, 6, '#111');
  // manchas de ferrugem escorrendo
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * 16);
    const y = 2 + Math.floor(rng() * 12);
    px(ctx, x, y, 1, 1, rng() > 0.6 ? PAL.concretoClaro : '#151515');
  }
  if (rng() > 0.6) px(ctx, 2 + Math.floor(rng() * 12), 3, 1, 4 + Math.floor(rng() * 4), '#3a2410');
  return canvas;
}

function makeCrate() {
  const { canvas, ctx } = offscreen(TILE, TILE);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  px(ctx, 1, 2, 14, 13, PAL.ferrugemEsc);
  px(ctx, 2, 3, 12, 11, PAL.ferrugem);
  px(ctx, 2, 3, 12, 1, '#e07016');
  px(ctx, 2, 8, 12, 1, PAL.ferrugemEsc);
  px(ctx, 7, 3, 2, 11, PAL.ferrugemEsc);
  px(ctx, 1, 14, 14, 1, '#000');
  // reforços metálicos
  px(ctx, 2, 4, 1, 1, PAL.metal);
  px(ctx, 13, 4, 1, 1, PAL.metal);
  px(ctx, 2, 12, 1, 1, PAL.metal);
  px(ctx, 13, 12, 1, 1, PAL.metal);
  return canvas;
}

function makeRubble(seed) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  const rng = makeRng(seed);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rng() * 12);
    const y = 3 + Math.floor(rng() * 10);
    const w = 2 + Math.floor(rng() * 3);
    px(ctx, x, y, w, 2, i % 2 ? PAL.concretoClaro : PAL.metalEsc);
    px(ctx, x, y, w, 1, '#3a3a3a');
  }
  px(ctx, 2, 13, 12, 2, '#101010');
  return canvas;
}

function makeRadiation(frame) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  const glow = frame === 0 ? '#1f5c12' : '#276f16';
  const core = frame === 0 ? '#39ff14' : '#5cff3f';
  px(ctx, 1, 3, 14, 10, glow);
  px(ctx, 2, 2, 12, 12, glow);
  px(ctx, 3, 4, 10, 8, '#2e8a18');
  px(ctx, 5, 6, 6, 4, core);
  px(ctx, 4 + frame, 5, 2, 1, '#a5ff8f');
  px(ctx, 9 - frame, 10, 2, 1, '#a5ff8f');
  // bolhas
  px(ctx, 6, 4, 1, 1, '#d9ffcb');
  px(ctx, 10, 9, 1, 1, '#d9ffcb');
  return canvas;
}

function makeTerminal(on) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  px(ctx, 1, 1, 14, 14, PAL.metalEsc);   // gabinete
  px(ctx, 2, 2, 12, 12, PAL.metal);
  px(ctx, 3, 3, 10, 8, '#0a0a0a');       // moldura da tela
  px(ctx, 4, 4, 8, 6, on ? PAL.vidro : '#0c0c0c');
  if (on) {
    // linhas de texto no CRT
    px(ctx, 5, 5, 6, 1, PAL.verde);
    px(ctx, 5, 7, 4, 1, PAL.verdeEsc);
    px(ctx, 5, 9, 5, 1, PAL.verde);
  }
  px(ctx, 3, 12, 10, 2, '#1f1f1f');      // teclado
  for (let i = 0; i < 5; i++) px(ctx, 4 + i * 2, 12, 1, 1, '#3d3d3d');
  px(ctx, 13, 3, 1, 1, on ? PAL.verde : '#5a1f1f'); // LED de status
  return canvas;
}

function makeDoor(unlocked) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  px(ctx, 0, 0, 16, 16, PAL.concreto);
  px(ctx, 1, 0, 14, 16, unlocked ? '#1d2a1d' : PAL.metalEsc);
  px(ctx, 2, 0, 12, 16, unlocked ? '#24361f' : PAL.metal);
  // faixas de advertência diagonais
  for (let i = -4; i < 16; i += 4) {
    px(ctx, 2, i + 2, 12, 1, unlocked ? PAL.verdeEsc : PAL.ferrugem);
  }
  px(ctx, 7, 0, 2, 16, '#0e0e0e');        // fenda central
  px(ctx, 2, 7, 12, 2, '#1a1a1a');        // trinco hidráulico
  px(ctx, 6, 7, 4, 2, unlocked ? PAL.verde : '#8a1a12');
  return canvas;
}

/** Props que escondem variáveis (prontuário, fita cassete, painel). */
function makeProp(kind) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  px(ctx, 0, 0, 16, 16, PAL.piso);
  if (kind === 'chart') {            // prontuário médico / prancheta
    px(ctx, 3, 2, 10, 13, '#3a3a34');
    px(ctx, 4, 3, 8, 11, '#d9d6c2');
    px(ctx, 6, 2, 4, 2, PAL.metal);
    px(ctx, 5, 6, 6, 1, '#7a776a');
    px(ctx, 5, 8, 6, 1, '#7a776a');
    px(ctx, 5, 10, 4, 1, '#7a776a');
  } else if (kind === 'tape') {      // fita cassete
    px(ctx, 2, 4, 12, 9, '#2b2b30');
    px(ctx, 3, 5, 10, 7, '#43434a');
    px(ctx, 5, 7, 2, 3, '#15151a');
    px(ctx, 9, 7, 2, 3, '#15151a');
    px(ctx, 4, 6, 8, 1, '#9a9aa5');
  } else if (kind === 'panel') {     // painel elétrico / quadro
    px(ctx, 2, 2, 12, 12, PAL.metalEsc);
    px(ctx, 3, 3, 10, 10, '#20242a');
    px(ctx, 4, 4, 8, 1, PAL.verdeEsc);
    px(ctx, 4, 6, 5, 1, PAL.ferrugem);
    px(ctx, 4, 8, 7, 1, PAL.verdeEsc);
    px(ctx, 4, 10, 3, 1, PAL.ferrugem);
    px(ctx, 11, 10, 2, 2, '#8a1a12');
  } else if (kind === 'locker') {    // armário de alojamento
    px(ctx, 2, 1, 12, 14, PAL.metalEsc);
    px(ctx, 3, 2, 10, 12, '#3f4640');
    px(ctx, 8, 2, 1, 12, PAL.metalEsc);
    px(ctx, 6, 7, 1, 2, '#c9c9c9');
    px(ctx, 10, 7, 1, 2, '#c9c9c9');
    px(ctx, 4, 3, 4, 1, '#556056');
  } else {                            // 'body' — restos, prop narrativo
    px(ctx, 3, 5, 10, 7, '#2a2622');
    px(ctx, 5, 4, 4, 4, PAL.osso);
    px(ctx, 6, 5, 1, 1, '#111');
    px(ctx, 8, 5, 1, 1, '#111');
    px(ctx, 4, 11, 8, 2, PAL.sangue);
  }
  // brilho de item interativo (canto)
  px(ctx, 14, 1, 1, 1, PAL.verde);
  return canvas;
}

/** Prop já inspecionado — versão apagada. */
function desaturate(source) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, TILE, TILE);
  return canvas;
}

// ------------------------------------------------------- PERSONAGEM

/**
 * Engenheiro sobrevivente — 4 direções cardinais.
 * frame 0 = parado (Eng_Idle), 1 e 2 = ciclo de caminhada (Eng_Walk),
 * frame 3 = postura de interação/hacking (Eng_Hack).
 */
function makeEngineer(dir, frame) {
  const { canvas, ctx } = offscreen(TILE, TILE);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const hack = frame === 3;
  const bodyY = hack ? 1 : 0;

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(TILE / 2, TILE - 3, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // pernas
  px(ctx, 5, 12 + bodyY, 2, 3 - bodyY, PAL.bota);
  px(ctx, 9, 12 + bodyY, 2, 3 - bodyY, PAL.bota);
  if (step === 1) px(ctx, 5, 14, 3, 1, PAL.bota);
  if (step === -1) px(ctx, 8, 14, 3, 1, PAL.bota);

  // tronco (macacão laranja)
  px(ctx, 4, 6 + bodyY, 8, 7, PAL.ferrugemEsc);
  px(ctx, 5, 6 + bodyY, 6, 6, PAL.ferrugem);
  px(ctx, 5, 9 + bodyY, 6, 1, PAL.ferrugemEsc);   // cinto de ferramentas
  px(ctx, 7, 9 + bodyY, 2, 1, '#d8d2c0');         // fivela

  if (dir === 'up') {
    px(ctx, 5, 5 + bodyY, 6, 4, PAL.metalEsc);    // mochila nas costas
    px(ctx, 6, 6 + bodyY, 4, 2, PAL.metal);
  }

  // cabeça + capacete
  px(ctx, 5, 2 + bodyY, 6, 5, PAL.capacete);
  px(ctx, 4, 3 + bodyY, 8, 1, '#2b2b2b');         // aba do capacete
  if (dir === 'down') {
    px(ctx, 6, 5 + bodyY, 4, 2, PAL.pele);
    px(ctx, 6, 5 + bodyY, 1, 1, '#101010');
    px(ctx, 9, 5 + bodyY, 1, 1, '#101010');
  } else if (dir === 'left') {
    px(ctx, 5, 5 + bodyY, 3, 2, PAL.pele);
    px(ctx, 5, 5 + bodyY, 1, 1, '#101010');
  } else if (dir === 'right') {
    px(ctx, 8, 5 + bodyY, 3, 2, PAL.pele);
    px(ctx, 10, 5 + bodyY, 1, 1, '#101010');
  }

  // lanterna de capacete + braço estendido
  const lx = dir === 'left' ? 3 : dir === 'right' ? 12 : 7;
  const ly = dir === 'up' ? 2 : 4;
  px(ctx, lx, ly + bodyY, 1, 1, PAL.luz);

  if (hack) {
    // braços à frente, digitando
    px(ctx, 3, 8, 3, 2, PAL.ferrugem);
    px(ctx, 10, 8, 3, 2, PAL.ferrugem);
    px(ctx, 3, 9, 2, 1, PAL.pele);
    px(ctx, 11, 9, 2, 1, PAL.pele);
  } else {
    px(ctx, 3, 7 + bodyY, 2, 4, PAL.ferrugem);
    px(ctx, 11, 7 + bodyY, 2, 4, PAL.ferrugem);
  }
  return canvas;
}

// ------------------------------------------------------- CATÁLOGO

export const Sprites = {
  floors: [],
  walls: [],
  crate: null,
  rubble: null,
  rad: [],
  terminalOn: null,
  terminalOff: null,
  doorLocked: null,
  doorOpen: null,
  props: {},
  propsUsed: {},
  engineer: {},
};

/** Pré-renderiza todos os sprites. Chamado uma vez no boot. */
export function buildSprites() {
  for (let i = 0; i < 4; i++) Sprites.floors.push(makeFloor(101 + i * 37));
  for (let i = 0; i < 3; i++) Sprites.walls.push(makeWall(9001 + i * 17));
  Sprites.crate = makeCrate();
  Sprites.rubble = makeRubble(555);
  Sprites.rad = [makeRadiation(0), makeRadiation(1)];
  Sprites.terminalOn = makeTerminal(true);
  Sprites.terminalOff = makeTerminal(false);
  Sprites.doorLocked = makeDoor(false);
  Sprites.doorOpen = makeDoor(true);

  for (const kind of ['chart', 'tape', 'panel', 'locker', 'body']) {
    Sprites.props[kind] = makeProp(kind);
    Sprites.propsUsed[kind] = desaturate(Sprites.props[kind]);
  }

  for (const dir of ['down', 'up', 'left', 'right']) {
    Sprites.engineer[dir] = [0, 1, 2, 3].map((f) => makeEngineer(dir, f));
  }
  return Sprites;
}
