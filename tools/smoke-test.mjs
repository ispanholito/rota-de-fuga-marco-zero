/**
 * Teste de fumaça automatizado (Playwright + Chromium).
 *
 * Sobe um servidor estático, abre o jogo num navegador headless e executa uma
 * partida roteirizada: avança do menu, coleta as pistas de cada setor via API
 * interna, resolve o terminal e confere se os 5 setores são concluídos.
 * Falha se qualquer erro de console (ou exceção de página) aparecer.
 *
 * Uso: node tools/smoke-test.mjs [--shots]
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = 8321;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(ROOT, 'docs', 'capturas');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('nao encontrado');
  }
});

const problems = [];
const log = (msg) => console.log(msg);

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForFunction(() => window.jogo !== undefined, { timeout: 10000 });
log('✓ página carregada e jogo instanciado');

const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
};

await page.waitForTimeout(400);
await shot('01-menu');

// menu -> setor 1
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
if (await page.evaluate(() => window.jogo.state) !== 'BRIEFING') problems.push('não entrou no briefing');
await shot('02-briefing');

for (let sector = 1; sector <= 5; sector++) {
  // briefing -> jogo
  await page.waitForTimeout(1400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => window.jogo.state);
  if (state !== 'PLAYING') { problems.push(`setor ${sector}: estado ${state}, esperado PLAYING`); break; }

  // movimentação real do jogador (valida entrada + colisão)
  const before = await page.evaluate(() => ({ x: window.jogo.player.x, y: window.jogo.player.y }));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => ({ x: window.jogo.player.x, y: window.jogo.player.y }));
  if (Math.abs(after.x - before.x) < 5) problems.push(`setor ${sector}: jogador não se moveu`);

  if (sector === 1) await shot('03-gameplay');

  // coleta das pistas (teleporta até cada prop e pressiona E)
  const clueCount = await page.evaluate(() => window.jogo.level.props.length);
  for (let i = 0; i < clueCount; i++) {
    await page.evaluate((idx) => {
      const g = window.jogo;
      const prop = g.level.props[idx];
      // posiciona o jogador ao lado do objeto, num tile livre
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const gx = prop.gx + dx;
        const gy = prop.gy + dy;
        if (!g.level.isSolidTile(g.level.tileAt(gx, gy))) {
          g.player.x = gx * 32 + 16;
          g.player.y = gy * 32 + 16;
          return;
        }
      }
    }, i);
    await page.waitForTimeout(120);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
  }

  const collected = await page.evaluate(() => window.jogo.journal.entries().length);
  if (collected !== clueCount) problems.push(`setor ${sector}: ${collected}/${clueCount} pistas coletadas`);

  // acessa o terminal
  await page.evaluate(() => {
    const g = window.jogo;
    const t = g.level.terminal;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const gx = t.gx + dx;
      const gy = t.gy + dy;
      if (!g.level.isSolidTile(g.level.tileAt(gx, gy))) {
        g.player.x = gx * 32 + 16;
        g.player.y = gy * 32 + 16;
        return;
      }
    }
  });
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
  if (await page.evaluate(() => window.jogo.state) !== 'TERMINAL') {
    problems.push(`setor ${sector}: terminal não abriu`);
    break;
  }
  if (sector === 1) await shot('04-terminal');

  // primeiro erra de propósito (valida alarme e penalidade de tempo)
  if (sector === 1) {
    const timeBefore = await page.evaluate(() => window.jogo.threat.remaining);
    await page.keyboard.type('999');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const timeAfter = await page.evaluate(() => window.jogo.threat.remaining);
    if (timeAfter >= timeBefore - 5) problems.push('penalidade por código errado não aplicada');
    if (await page.evaluate(() => window.jogo.stats.wrong) !== 1) problems.push('tentativa incorreta não contabilizada');
    log('✓ código incorreto dispara alarme e penalidade');
  }

  // agora digita a resposta certa
  const answer = await page.evaluate(() => String(window.jogo.level.def.puzzle.answer));
  for (const ch of answer) await page.keyboard.press(ch === '-' ? 'Minus' : `Digit${ch}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  if (!await page.evaluate(() => window.jogo.level.doorUnlocked)) {
    problems.push(`setor ${sector}: comporta não destrancou com a resposta ${answer}`);
    break;
  }
  log(`✓ setor ${sector}: puzzle resolvido (resposta ${answer})`);

  // caminha até a saída
  await page.evaluate(() => {
    const g = window.jogo;
    g.player.x = g.level.door.x + 16;
    g.player.y = g.level.door.y + 16;
  });
  await page.waitForTimeout(300);

  const next = await page.evaluate(() => ({ state: window.jogo.state, sector: window.jogo.level.sector }));
  if (sector < 5 && next.sector !== sector + 1) {
    problems.push(`setor ${sector}: não avançou para o próximo (estado ${next.state})`);
    break;
  }
  if (sector === 5 && next.state !== 'VICTORY') {
    problems.push(`setor 5: esperado VICTORY, obtido ${next.state}`);
  }
}

if (await page.evaluate(() => window.jogo.state) === 'VICTORY') {
  log('✓ jogo concluído: tela de vitória alcançada');
  await shot('05-vitoria');
}

await browser.close();
server.close();

if (problems.length) {
  console.error('\n[FALHA]');
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  process.exit(1);
}
console.log('\n[OK] Teste de fumaça concluído sem erros.\n');
