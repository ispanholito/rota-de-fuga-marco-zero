/**
 * Validador de mapas — executado com `npm run validate` (ou `node tools/validate-levels.mjs`).
 *
 * Verifica, para cada setor:
 *   1. dimensões corretas (30 x 17);
 *   2. existência de exatamente um spawn, um terminal e uma comporta;
 *   3. se todas as pistas declaradas existem no mapa;
 *   4. se pistas, terminal e comporta são alcançáveis a pé a partir do spawn
 *      (busca em largura sobre os tiles caminháveis);
 *   5. se a resposta declarada do puzzle confere com o cálculo das variáveis.
 *
 * Este script é a rede de segurança do level design: um mapa mal digitado
 * (uma pista trancada atrás de uma parede) quebraria o jogo silenciosamente.
 */

import { LEVELS, MAP_W, MAP_H } from '../src/data/levels.js';

const BLOCKING = new Set(['#', 'C', '~', 'T', 'D']);
let failures = 0;

const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg) => console.log(`  ✓ ${msg}`);

/** Confere a expressão do puzzle contra os valores das variáveis. */
function expectedAnswer(level) {
  const v = Object.fromEntries(level.clues.map((c) => [c.key, c.value]));
  switch (level.sector) {
    case 1: return v.A + v.B;
    case 2: return v.A * v.B - 15;
    case 3: return (v.B - v.A) / 2;
    case 4: return v.A ** 2 - v.B * 4;
    case 5: return (v.A * v.B) / 3 + v.C;
    default: return null;
  }
}

for (const level of LEVELS) {
  console.log(`\nSETOR ${level.sector} — ${level.name}`);

  // 1. dimensões
  if (level.map.length !== MAP_H) {
    fail(`altura ${level.map.length}, esperado ${MAP_H}`);
  }
  const badRows = level.map
    .map((row, i) => (row.length !== MAP_W ? `linha ${i}: ${row.length} col` : null))
    .filter(Boolean);
  if (badRows.length) fail(`largura incorreta -> ${badRows.join(', ')}`);
  else ok(`dimensões ${MAP_W}x${MAP_H}`);

  // 2. elementos obrigatórios
  const flat = level.map.join('');
  const count = (ch) => flat.split(ch).length - 1;
  for (const [ch, label] of [['P', 'spawn'], ['T', 'terminal'], ['D', 'comporta']]) {
    if (count(ch) !== 1) fail(`${label}: encontrado ${count(ch)}x, esperado 1`);
  }

  // 3. pistas declaradas x pistas no mapa
  level.clues.forEach((clue, i) => {
    const ch = String(i + 1);
    if (count(ch) !== 1) fail(`pista ${clue.key} ('${ch}') aparece ${count(ch)}x no mapa`);
  });

  // 4. alcançabilidade
  const grid = level.map.map((r) => r.split(''));
  let start = null;
  const targets = new Map();
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x];
      if (ch === 'P') start = { x, y };
      if ('123456789TD'.includes(ch)) targets.set(`${x},${y}`, ch);
    }
  }

  if (!start) {
    fail('sem posição inicial');
  } else {
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    const reached = new Set();
    while (queue.length) {
      const { x, y } = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[ny].length) continue;
        if (seen.has(key)) continue;
        const ch = grid[ny][nx];
        // Alvos são alcançáveis se o jogador puder ficar ADJACENTE a eles;
        // por isso são marcados como atingidos, mas não entram na fila.
        if (targets.has(key)) { reached.add(key); seen.add(key); continue; }
        if (BLOCKING.has(ch)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    const unreachable = [...targets.entries()]
      .filter(([key]) => !reached.has(key))
      .map(([key, ch]) => `'${ch}' em (${key})`);
    if (unreachable.length) fail(`inalcançável: ${unreachable.join(', ')}`);
    else ok(`todos os ${targets.size} pontos de interesse são alcançáveis`);
  }

  // 5. coerência do puzzle
  const expected = expectedAnswer(level);
  if (expected !== level.puzzle.answer) {
    fail(`puzzle "${level.puzzle.display}": resposta declarada ${level.puzzle.answer}, calculado ${expected}`);
  } else {
    ok(`puzzle "${level.puzzle.display}" = ${expected}`);
  }
}

console.log(failures === 0
  ? '\n[OK] Todos os setores passaram na validação.\n'
  : `\n[FALHA] ${failures} problema(s) encontrado(s).\n`);

process.exit(failures === 0 ? 0 : 1);
