/**
 * Renderização — mundo, iluminação, HUD, terminal CRT e telas de estado.
 *
 * A atmosfera pedida pelo GDD (claustrofobia, escuridão, monitor verde-fósforo)
 * é obtida por três camadas sobrepostas ao mundo:
 *   1. máscara de escuridão recortada pelo facho da lanterna;
 *   2. tinta verde/vermelha conforme radiação e nível de ameaça;
 *   3. scanlines e vinheta simulando um monitor CRT antigo.
 */

import { Sprites, TILE } from './sprites.js';
import { T } from './level.js';
import { clamp, formatTime, offscreen } from '../engine/utils.js';

const W = 960;
const H = 544;
const HUD_H = 34;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.light = offscreen(W, H);   // camada de escuridão/iluminação
    this.time = 0;
    this.shake = 0;
  }

  /** Sacode a tela (erro de código, invasão). */
  kick(amount = 6) { this.shake = amount; }

  // ------------------------------------------------------------- utilidades
  _text(text, x, y, { size = 16, color = '#39ff14', align = 'left', glow = true, font = 'monospace' } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _bar(x, y, w, h, ratio, color, label) {
    const { ctx } = this;
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(ratio, 0, 1)), h - 4);
    if (label) this._text(label, x - 6, y + h - 2, { size: 11, color: '#7d8f79', align: 'right', glow: false });
  }

  // ------------------------------------------------------------- mundo
  drawWorld(state, dt) {
    const { ctx } = this;
    this.time += dt;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - dt * 22);
    }

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    const { level, player } = state;
    const radFrame = Math.floor(this.time * 3) % 2;

    // --- tiles ---
    for (let gy = 0; gy < level.height; gy++) {
      for (let gx = 0; gx < level.width; gx++) {
        const tile = level.tiles[gy][gx];
        const v = level.variants[gy][gx];
        const px = gx * TILE;
        const py = gy * TILE;
        switch (tile) {
          case T.WALL:
            ctx.drawImage(Sprites.walls[v % Sprites.walls.length], px, py);
            break;
          case T.CRATE:
            ctx.drawImage(Sprites.floors[v], px, py);
            ctx.drawImage(Sprites.crate, px, py);
            break;
          case T.RUBBLE:
            ctx.drawImage(Sprites.floors[v], px, py);
            ctx.drawImage(Sprites.rubble, px, py);
            break;
          case T.RAD:
            ctx.drawImage(Sprites.rad[radFrame], px, py);
            break;
          case T.TERMINAL:
            ctx.drawImage(Sprites.floors[v], px, py);
            ctx.drawImage(state.terminal.solved ? Sprites.terminalOff : Sprites.terminalOn, px, py);
            break;
          case T.DOOR:
            ctx.drawImage(level.doorUnlocked ? Sprites.doorOpen : Sprites.doorLocked, px, py);
            break;
          case T.PROP:
            ctx.drawImage(Sprites.floors[v], px, py);
            break;
          default:
            ctx.drawImage(Sprites.floors[v], px, py);
        }
      }
    }

    // --- props com pista ---
    for (const prop of level.props) {
      const kind = prop.clue.prop;
      const sprite = prop.collected ? Sprites.propsUsed[kind] : Sprites.props[kind];
      ctx.drawImage(sprite, prop.x, prop.y);
      if (!prop.collected) {
        // contorno pulsante indicando que o objeto é interativo
        const a = 0.35 + Math.sin(this.time * 4 + prop.gx) * 0.25;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1;
        ctx.strokeRect(prop.x + 1.5, prop.y + 1.5, TILE - 3, TILE - 3);
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(prop.x + TILE / 2 - 2, prop.y - 4, 4, 3);
        ctx.restore();
      }
    }

    // --- jogador ---
    const sprite = Sprites.engineer[player.dir][player.frame];
    ctx.drawImage(sprite, Math.round(player.x - TILE / 2), Math.round(player.y - TILE / 2 - 4));

    // --- iluminação ---
    this._drawLighting(state);

    // --- prompt de interação ---
    const target = level.interactableAt(player.x, player.y);
    if (target && !state.terminal.open) {
      const label = target.type === 'terminal' ? '[E] acessar terminal' : '[E] inspecionar';
      const tx = target.type === 'terminal' ? level.terminal.x + TILE / 2 : target.prop.x + TILE / 2;
      const ty = target.type === 'terminal' ? level.terminal.y : target.prop.y;
      this._text(label, tx, ty - 8, { size: 12, align: 'center' });
    }

    // --- comporta liberada ---
    if (level.doorUnlocked && level.door) {
      this._text('SAÍDA', level.door.x + TILE / 2, level.door.y - 6,
        { size: 12, align: 'center', color: '#39ff14' });
    }

    ctx.restore();

    this.drawHud(state);
    if (state.toast) this.drawToast(state.toast);
    this.drawCrtOverlay(state);
  }

  /** Escuridão do bunker recortada pelo facho da lanterna. */
  _drawLighting(state) {
    const { player, level, threat } = state;
    const lc = this.light.ctx;

    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(0,0,0,0.82)';
    lc.fillRect(0, 0, W, H);

    lc.globalCompositeOperation = 'destination-out';

    // facho principal (raio pulsa levemente)
    const radius = 210 + Math.sin(this.time * 2.4) * 6 - (player.rad >= 100 ? 45 : 0);
    let g = lc.createRadialGradient(player.x, player.y, 16, player.x, player.y, radius);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.94)');
    g.addColorStop(0.78, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath();
    lc.arc(player.x, player.y, radius, 0, Math.PI * 2);
    lc.fill();

    // brilho próprio dos terminais e das poças de radiação
    const glows = [];
    if (level.terminal) glows.push({ x: level.terminal.x + 16, y: level.terminal.y + 16, r: 96 });
    for (let gy = 0; gy < level.height; gy++) {
      for (let gx = 0; gx < level.width; gx++) {
        if (level.tiles[gy][gx] === T.RAD) glows.push({ x: gx * TILE + 16, y: gy * TILE + 16, r: 52 });
      }
    }
    for (const glow of glows) {
      g = lc.createRadialGradient(glow.x, glow.y, 2, glow.x, glow.y, glow.r);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath();
      lc.arc(glow.x, glow.y, glow.r, 0, Math.PI * 2);
      lc.fill();
    }

    lc.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.light.canvas, 0, 0);

    // tinta ambiente: verde quando contaminado, vermelho quando invadido
    const { ctx } = this;
    if (player.rad > 40) {
      ctx.fillStyle = `rgba(57,255,20,${(player.rad - 40) / 100 * 0.16})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (threat && threat.ratio < 0.35) {
      const intensity = (0.35 - threat.ratio) / 0.35;
      ctx.fillStyle = `rgba(255,40,20,${intensity * 0.13 * (0.6 + Math.sin(this.time * 6) * 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ------------------------------------------------------------- HUD
  drawHud(state) {
    const { ctx } = this;
    const { player, threat, level } = state;

    ctx.fillStyle = 'rgba(6,8,6,0.82)';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.strokeStyle = '#233020';
    ctx.beginPath();
    ctx.moveTo(0, HUD_H + 0.5);
    ctx.lineTo(W, HUD_H + 0.5);
    ctx.stroke();

    this._text(`SETOR ${level.sector} // ${level.name}`, 12, 22, { size: 13 });

    this._bar(320, 10, 120, 14, player.hp / 100, '#39ff14', 'HP');
    this._bar(500, 10, 120, 14, player.rad / 100,
      player.rad >= 100 ? '#ff3b30' : '#cc5500', 'RAD');

    this._text(`PISTAS ${level.collectedClues}/${level.totalClues}`, 660, 22,
      { size: 13, color: '#7d8f79', glow: false });

    const critical = threat.ratio < 0.35;
    this._text(formatTime(threat.remaining), W - 14, 22, {
      size: 16,
      align: 'right',
      color: critical ? '#ff3b30' : '#39ff14',
    });

    if (player.inCover) {
      this._text('EM COBERTURA', 12, H - 12, { size: 12, color: '#4f9f4a' });
    }
  }

  /** Caixa de texto no rodapé (documentos inspecionados, avisos). */
  drawToast(toast) {
    const { ctx } = this;
    const boxH = 62;
    const y = H - boxH - 10;
    ctx.fillStyle = 'rgba(4,10,4,0.92)';
    ctx.fillRect(20, y, W - 40, boxH);
    ctx.strokeStyle = '#2f6b26';
    ctx.strokeRect(20.5, y + 0.5, W - 41, boxH - 1);

    const words = toast.text.split(' ');
    const lines = [];
    let line = '';
    ctx.font = '14px monospace';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > W - 80) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    lines.slice(0, 3).forEach((l, i) => {
      this._text(l, 36, y + 26 + i * 18, { size: 14, color: toast.color || '#c8f5bd', glow: false });
    });
  }

  /** Scanlines + vinheta — o mundo visto por um monitor antigo. */
  drawCrtOverlay(state) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();

    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (state && state.player && state.player.rad >= 100) {
      // distorção horizontal quando a barra RAD satura
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#39ff14';
      const y = (this.time * 260) % H;
      ctx.fillRect(0, y, W, 6);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------- terminal
  drawTerminal(state) {
    const { ctx } = this;
    const terminal = state.terminal;

    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillRect(0, 0, W, H);

    const bx = 150;
    const by = 60;
    const bw = W - 300;
    const bh = H - 130;

    ctx.fillStyle = '#04120544';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    terminal.log.forEach((line, i) => {
      this._text(line, bx + 28, by + 40 + i * 20, { size: 15 });
    });

    // campo de entrada
    const inputY = by + bh - 58;
    ctx.strokeStyle = '#1f7a12';
    ctx.strokeRect(bx + 28, inputY - 22, bw - 56, 32);
    const cursor = Math.floor(this.time * 2) % 2 ? '_' : ' ';
    this._text(`> ${state.inputBuffer}${cursor}`, bx + 40, inputY, { size: 18 });

    this._text('ENTER confirma   //   ESC cancela', bx + 28, by + bh - 16,
      { size: 12, color: '#4f7a48', glow: false });

    if (state.terminalFeedback) {
      this._text(state.terminalFeedback.text, W / 2, by + bh + 30, {
        size: 15,
        align: 'center',
        color: state.terminalFeedback.ok ? '#39ff14' : '#ff3b30',
      });
    }

    this.drawCrtOverlay(state);
  }

  // ------------------------------------------------------------- telas
  _screenBase(title, subtitle, color = '#39ff14') {
    const { ctx } = this;
    ctx.fillStyle = '#050705';
    ctx.fillRect(0, 0, W, H);
    this._text(title, W / 2, 150, { size: 44, align: 'center', color });
    if (subtitle) {
      this._text(subtitle, W / 2, 190, { size: 15, align: 'center', color: '#7d8f79', glow: false });
    }
  }

  drawMenu() {
    this._screenBase('ROTA DE FUGA', 'MARCO ZERO');
    const lines = [
      'Você é um engenheiro civil. Não tem arma, não sabe lutar.',
      'Tem um diário, uma lanterna e a matemática dos militares.',
      '',
      'Vasculhe cada setor, encontre as variáveis, resolva a expressão',
      'no terminal e cruze a comporta antes que os saqueadores cheguem.',
      '',
      'WASD/setas mover   ·   E interagir   ·   ENTER confirmar   ·   M áudio',
    ];
    lines.forEach((l, i) => {
      this._text(l, W / 2, 250 + i * 24, { size: 15, align: 'center', color: '#9fb39a', glow: false });
    });
    const blink = Math.floor(this.time * 1.6) % 2;
    if (blink) {
      this._text('[ PRESSIONE QUALQUER TECLA PARA INICIAR ]', W / 2, 470,
        { size: 17, align: 'center' });
    }
    this.drawCrtOverlay(null);
  }

  drawBriefing(level, elapsed) {
    const { ctx } = this;
    ctx.fillStyle = '#050705';
    ctx.fillRect(0, 0, W, H);

    this._text(`SETOR ${level.sector}`, W / 2, 180, { size: 20, align: 'center', color: '#cc5500' });
    this._text(level.name, W / 2, 225, { size: 34, align: 'center' });

    // efeito de máquina de escrever no texto de briefing
    const chars = Math.floor(elapsed * 48);
    const text = level.def.brief.slice(0, chars);
    const words = text.split(' ');
    const lines = [];
    let line = '';
    ctx.font = '15px monospace';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 560) { lines.push(line); line = word; } else { line = test; }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => {
      this._text(l, W / 2, 300 + i * 24, { size: 15, align: 'center', color: '#9fb39a', glow: false });
    });

    if (elapsed > 1.2) {
      const blink = Math.floor(this.time * 1.8) % 2;
      if (blink) this._text('[ ENTER PARA ENTRAR NO SETOR ]', W / 2, 460, { size: 16, align: 'center' });
    }
    this.drawCrtOverlay(null);
  }

  drawGameOver(reason, sector) {
    this._screenBase('SINAL PERDIDO', null, '#ff3b30');
    this._text(reason, W / 2, 230, { size: 17, align: 'center', color: '#c9a09a', glow: false });
    this._text(`Setor ${sector}`, W / 2, 270, { size: 14, align: 'center', color: '#6f7d6c', glow: false });
    const blink = Math.floor(this.time * 1.6) % 2;
    if (blink) this._text('[ ENTER PARA TENTAR NOVAMENTE ]', W / 2, 400, { size: 16, align: 'center' });
    this.drawCrtOverlay(null);
  }

  drawVictory(stats) {
    this._screenBase('MARCO ZERO', 'COMPORTA FINAL LIBERADA');
    const lines = [
      'O duto de ventilação profunda se abre para o ar frio da superfície.',
      'Atrás de você, as luzes do bunker se apagam setor por setor.',
      '',
      `Tempo total de fuga: ${formatTime(stats.totalTime)}`,
      `Códigos decifrados: ${stats.solved}/5`,
      `Tentativas incorretas: ${stats.wrong}`,
    ];
    lines.forEach((l, i) => {
      this._text(l, W / 2, 260 + i * 26, { size: 15, align: 'center', color: '#9fb39a', glow: false });
    });
    const blink = Math.floor(this.time * 1.6) % 2;
    if (blink) this._text('[ ENTER PARA JOGAR NOVAMENTE ]', W / 2, 470, { size: 16, align: 'center' });
    this.drawCrtOverlay(null);
  }
}
