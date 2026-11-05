/**
 * Setor carregado em memória: converte o mapa em texto numa grade de tiles
 * consultável e expõe as funções de colisão usadas pelo jogador.
 */

import { TILE } from './sprites.js';
import { makeRng } from '../engine/utils.js';

export const T = {
  FLOOR: 0,
  WALL: 1,
  CRATE: 2,
  RUBBLE: 3,
  RAD: 4,
  TERMINAL: 5,
  DOOR: 6,
  PROP: 7,
};

const CHAR_TO_TILE = {
  '#': T.WALL,
  '.': T.FLOOR,
  C: T.CRATE,
  '~': T.RUBBLE,
  R: T.RAD,
  T: T.TERMINAL,
  D: T.DOOR,
  P: T.FLOOR,
};

/** Tiles que impedem a passagem (a comporta é tratada à parte). */
const SOLID = new Set([T.WALL, T.CRATE, T.RUBBLE, T.TERMINAL, T.PROP]);

export class Level {
  constructor(def) {
    this.def = def;
    this.sector = def.sector;
    this.name = def.name;
    this.width = def.map[0].length;
    this.height = def.map.length;
    this.tiles = [];
    this.props = [];          // objetos com pistas
    this.spawn = { x: TILE * 1.5, y: TILE * 1.5 };
    this.terminal = null;
    this.door = null;
    this.doorUnlocked = false;
    this.variants = [];       // variação visual do piso/parede por tile

    const rng = makeRng(def.sector * 7919);

    for (let y = 0; y < this.height; y++) {
      const row = [];
      const vrow = [];
      for (let x = 0; x < this.width; x++) {
        const ch = def.map[y][x];
        vrow.push(Math.floor(rng() * 4));

        if (ch === 'P') {
          this.spawn = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
          row.push(T.FLOOR);
        } else if (/[1-9]/.test(ch)) {
          const clue = def.clues[Number(ch) - 1];
          this.props.push({
            gx: x,
            gy: y,
            x: x * TILE,
            y: y * TILE,
            clue,
            collected: false,
          });
          row.push(T.PROP);
        } else {
          const tile = CHAR_TO_TILE[ch];
          if (tile === undefined) {
            throw new Error(`Setor ${def.sector}: caractere de mapa desconhecido "${ch}" em (${x},${y})`);
          }
          if (tile === T.TERMINAL) this.terminal = { gx: x, gy: y, x: x * TILE, y: y * TILE };
          if (tile === T.DOOR) this.door = { gx: x, gy: y, x: x * TILE, y: y * TILE };
          row.push(tile);
        }
      }
      this.tiles.push(row);
      this.variants.push(vrow);
    }
  }

  tileAt(gx, gy) {
    if (gx < 0 || gy < 0 || gy >= this.height || gx >= this.width) return T.WALL;
    return this.tiles[gy][gx];
  }

  /** Tile na coordenada em pixels. */
  tileAtPixel(x, y) {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** A comporta só deixa passar depois que o código correto é inserido. */
  isSolidTile(tile) {
    if (tile === T.DOOR) return !this.doorUnlocked;
    return SOLID.has(tile);
  }

  /** Testa um retângulo (hitbox do jogador) contra a grade. */
  rectCollides(x, y, w, h) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        if (this.isSolidTile(this.tileAt(gx, gy))) return true;
      }
    }
    return false;
  }

  /** Intensidade de radiação sentida numa posição (0..1), usada pelo Geiger. */
  radiationNear(px, py, radiusTiles = 3) {
    const gx = Math.floor(px / TILE);
    const gy = Math.floor(py / TILE);
    let best = 0;
    for (let y = gy - radiusTiles; y <= gy + radiusTiles; y++) {
      for (let x = gx - radiusTiles; x <= gx + radiusTiles; x++) {
        if (this.tileAt(x, y) !== T.RAD) continue;
        const d = Math.hypot(x - gx, y - gy);
        best = Math.max(best, 1 - d / (radiusTiles + 1));
      }
    }
    return best;
  }

  /** Há um caixote adjacente? (furtividade: mais lento, porém silencioso) */
  hasCoverNear(gx, gy) {
    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let x = gx - 1; x <= gx + 1; x++) {
        if (this.tileAt(x, y) === T.CRATE) return true;
      }
    }
    return false;
  }

  /** Objeto interativo (prop ou terminal) ao alcance do jogador. */
  interactableAt(px, py, reach = TILE * 1.35) {
    const cx = px;
    const cy = py;
    let closest = null;
    let bestDist = Infinity;

    for (const prop of this.props) {
      if (prop.collected) continue;
      const d = Math.hypot(prop.x + TILE / 2 - cx, prop.y + TILE / 2 - cy);
      if (d < reach && d < bestDist) { bestDist = d; closest = { type: 'prop', prop }; }
    }
    if (this.terminal) {
      const d = Math.hypot(this.terminal.x + TILE / 2 - cx, this.terminal.y + TILE / 2 - cy);
      if (d < reach && d < bestDist) { bestDist = d; closest = { type: 'terminal' }; }
    }
    return closest;
  }

  /** O jogador alcançou a comporta destrancada? */
  atExit(px, py) {
    if (!this.doorUnlocked || !this.door) return false;
    return Math.hypot(this.door.x + TILE / 2 - px, this.door.y + TILE / 2 - py) < TILE * 0.9;
  }

  get totalClues() { return this.props.length; }
  get collectedClues() { return this.props.filter((p) => p.collected).length; }
}
