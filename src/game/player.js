/**
 * Engenheiro sobrevivente — movimentação, colisão e contaminação.
 *
 * Regras vindas do GDD:
 *  - sem ataques: as únicas respostas ao perigo são desviar e se esconder;
 *  - andar colado a caixotes reduz a velocidade em 50%, mas zera o ruído
 *    (o que desacelera a aproximação dos saqueadores);
 *  - pisar em radiação carrega a barra RAD; com a barra saturada o
 *    personagem perde vida e fica mais lento.
 */

import { TILE } from './sprites.js';
import { T } from './level.js';
import { clamp } from '../engine/utils.js';

const SPEED = 118;          // px/s
const HITBOX = 18;          // largura/altura da caixa de colisão
const RAD_GAIN = 26;        // pontos de RAD por segundo dentro da poça
const RAD_DECAY = 9;        // recuperação por segundo fora da poça
const HP_DRAIN = 9;         // dano por segundo com RAD saturada

export class Player {
  constructor(level) {
    this.x = level.spawn.x;
    this.y = level.spawn.y;
    this.dir = 'down';
    this.frame = 0;
    this.animTime = 0;
    this.moving = false;
    this.hacking = false;
    this.hp = 100;
    this.rad = 0;
    this.inCover = false;
    this.stepTimer = 0;
  }

  get gx() { return Math.floor(this.x / TILE); }
  get gy() { return Math.floor(this.y / TILE); }

  /** Velocidade efetiva considerando cobertura e contaminação. */
  currentSpeed() {
    let speed = SPEED;
    if (this.inCover) speed *= 0.5;      // furtividade: devagar e silencioso
    if (this.rad >= 100) speed *= 0.55;  // saturação: visão e passos degradados
    return speed;
  }

  update(dt, input, level, audio) {
    const axis = this.hacking ? { x: 0, y: 0 } : input.axis();
    this.inCover = level.hasCoverNear(this.gx, this.gy);

    const speed = this.currentSpeed();
    const half = HITBOX / 2;

    // --- movimento com resolução de colisão eixo a eixo ---
    if (axis.x) {
      const nx = this.x + axis.x * speed * dt;
      if (!level.rectCollides(nx - half, this.y - half, HITBOX, HITBOX)) this.x = nx;
      this.dir = axis.x > 0 ? 'right' : 'left';
    }
    if (axis.y) {
      const ny = this.y + axis.y * speed * dt;
      if (!level.rectCollides(this.x - half, ny - half, HITBOX, HITBOX)) this.y = ny;
      this.dir = axis.y > 0 ? 'down' : 'up';
    }

    this.moving = Boolean(axis.x || axis.y);

    // --- animação (Eng_Idle / Eng_Walk / Eng_Hack) ---
    if (this.hacking) {
      this.frame = 3;
    } else if (this.moving) {
      this.animTime += dt;
      const cycle = 0.3;
      this.frame = Math.floor(this.animTime / cycle) % 2 === 0 ? 1 : 2;

      // passos audíveis apenas fora de cobertura
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        if (!this.inCover) audio.footstep();
      }
    } else {
      this.animTime = 0;
      this.frame = 0;
    }

    // --- radiação ---
    const onRad = level.tileAtPixel(this.x, this.y) === T.RAD;
    if (onRad) this.rad = clamp(this.rad + RAD_GAIN * dt, 0, 100);
    else this.rad = clamp(this.rad - RAD_DECAY * dt, 0, 100);

    if (this.rad >= 100) this.hp = clamp(this.hp - HP_DRAIN * dt, 0, 100);

    // intensidade do contador Geiger para o motor de áudio
    audio.geigerRate = onRad ? 1 : level.radiationNear(this.x, this.y);

    return { onRad, dead: this.hp <= 0 };
  }
}
