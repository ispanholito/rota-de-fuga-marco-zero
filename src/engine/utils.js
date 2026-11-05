/**
 * Utilitários gerais do motor.
 * Rota de Fuga: Marco Zero — PAC Extensionista / Engenharia de Software.
 */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Gerador pseudoaleatório determinístico (Mulberry32).
 * Usado para gerar texturas sempre idênticas entre execuções — assim o
 * "ruído" da arte não muda a cada recarga da página.
 */
export function makeRng(seed = 1337) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Colisão retângulo x retângulo (AABB). */
export function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Distância euclidiana entre dois pontos. */
export const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

/** Cria um canvas fora da tela (usado para pré-renderizar sprites e tiles). */
export function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

/** Formata segundos como MM:SS. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
