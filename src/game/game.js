/**
 * Máquina de estados do jogo e laço principal.
 *
 * Estados: MENU -> BRIEFING -> PLAYING <-> TERMINAL -> (GAMEOVER | próximo setor) -> VICTORY
 *
 * O laço usa delta time fixado em no máximo 50 ms por quadro, para que uma
 * eventual travada do navegador não teleporte o jogador através das paredes.
 */

import { LEVELS } from '../data/levels.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { Threat } from './threat.js';
import { Terminal, Journal } from './terminal.js';
import { Renderer } from './renderer.js';
import { buildSprites } from './sprites.js';
import { AudioEngine } from '../engine/audio.js';
import { Input } from '../engine/input.js';

const State = {
  MENU: 'MENU',
  BRIEFING: 'BRIEFING',
  PLAYING: 'PLAYING',
  TERMINAL: 'TERMINAL',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
};

export class Game {
  constructor(canvas, dom) {
    buildSprites();
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.audio = new AudioEngine();
    this.dom = dom;

    this.state = State.MENU;
    this.levelIndex = 0;
    this.stats = { totalTime: 0, solved: 0, wrong: 0 };
    this.toast = null;
    this.toastTimer = 0;
    this.stateTime = 0;
    this.terminalFeedback = null;
    this.gameOverReason = '';
    this.lastTime = performance.now();
    this.fpsAcc = 0;
    this.fpsFrames = 0;

    this._syncPanel();
  }

  // ------------------------------------------------------------ ciclo de vida
  start() {
    requestAnimationFrame((t) => this._frame(t));
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = new Level(LEVELS[index]);
    this.journal = new Journal();
    this.player = new Player(this.level);
    this.threat = new Threat(LEVELS[index].threatTime);
    this.terminal = new Terminal(this.level, this.journal);
    this.state = State.BRIEFING;
    this.stateTime = 0;
    this.toast = null;
    this.terminalFeedback = null;
    this._syncPanel();
  }

  restart() {
    this.stats = { totalTime: 0, solved: 0, wrong: 0 };
    this.loadLevel(0);
  }

  // ------------------------------------------------------------ laço principal
  _frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this._update(dt);
    this._render(dt);
    this.input.endFrame();

    // contador de FPS (amostrado a cada meio segundo)
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.dom.fps.textContent = `${Math.round(this.fpsFrames / this.fpsAcc)} FPS`;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    this.stateTime += dt;
    this.audio.update(dt);

    // O áudio só pode iniciar após uma interação do usuário.
    if (this.input.anyPressed()) this.audio.start();
    if (this.input.wasPressed('KeyM')) {
      const on = this.audio.toggle();
      this._say(on ? 'Áudio ligado.' : 'Áudio desligado.', '#7d8f79');
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = null;
    }

    switch (this.state) {
      case State.MENU:
        if (this.input.anyPressed() && !this.input.wasPressed('KeyM')) this.loadLevel(0);
        break;

      case State.BRIEFING:
        if (this.stateTime > 1.2 && (this.input.wasPressed('Enter') || this.input.wasPressed('Space'))) {
          this.state = State.PLAYING;
          this.stateTime = 0;
          this._say(`Setor ${this.level.sector}. Localize as variáveis e o terminal.`);
        }
        break;

      case State.PLAYING:
        this._updatePlaying(dt);
        break;

      case State.TERMINAL:
        this._updateTerminal(dt);
        break;

      case State.GAMEOVER:
      case State.VICTORY:
        if (this.input.wasPressed('Enter')) this.restart();
        break;

      default:
        break;
    }
  }

  _updatePlaying(dt) {
    this.stats.totalTime += dt;

    const result = this.player.update(dt, this.input, this.level, this.audio);
    if (result.dead) {
      this._gameOver('Contaminação letal. A barra RAD saturou e o corpo cedeu.');
      return;
    }

    const threatResult = this.threat.update(dt, { inCover: this.player.inCover }, this.audio);
    if (threatResult.breached) {
      this._gameOver('Os saqueadores arrombaram a comporta antes de você abrir a saída.');
      return;
    }

    // interação (E)
    if (this.input.wasPressed('KeyE')) {
      const target = this.level.interactableAt(this.player.x, this.player.y);
      if (target && target.type === 'prop') {
        this._collect(target.prop);
      } else if (target && target.type === 'terminal') {
        this._openTerminal();
      }
    }

    // saída do setor
    if (this.level.atExit(this.player.x, this.player.y)) this._nextLevel();

    this._syncPanel();
  }

  _updateTerminal(dt) {
    this.player.hacking = true;
    this.stats.totalTime += dt;
    // O tempo continua correndo enquanto o jogador calcula — é o coração da tensão.
    // Usa o delta real do quadro: um passo fixo de 1/60 s fazia o relógio correr
    // 2x mais rápido em monitores de 120 Hz e 3x em 180 Hz.
    const threatResult = this.threat.update(dt, { inCover: true }, this.audio);
    if (threatResult.breached) {
      this._closeTerminal();
      this._gameOver('Eles chegaram enquanto você ainda digitava o código.');
      return;
    }
    if (this.input.wasPressed('Escape')) this._closeTerminal();
    this._syncPanel();
  }

  // ------------------------------------------------------------ ações
  _collect(prop) {
    prop.collected = true;
    this.journal.add(prop.clue.key, prop.clue.value);
    this.audio.pickup();
    this._say(prop.clue.text, '#c8f5bd', 5.5);
    this.player.hacking = false;
    this._syncPanel();
  }

  _openTerminal() {
    this.terminal.openTerminal();
    this.state = State.TERMINAL;
    this.terminalFeedback = null;
    this.player.hacking = true;
    this.audio.keyboardClick();
    this.input.setTextMode(true, (value) => this._submitCode(value));
  }

  _closeTerminal() {
    this.terminal.close();
    this.input.setTextMode(false);
    this.player.hacking = false;
    this.state = State.PLAYING;
  }

  _submitCode(value) {
    const result = this.terminal.submit(value);
    this.audio.keyboardClick();

    if (result.status === 'ok') {
      this.stats.solved++;
      this.audio.hydraulicUnlock();
      this.terminalFeedback = { text: result.message, ok: true };
      setTimeout(() => {
        if (this.state === State.TERMINAL) this._closeTerminal();
        this._say('Comporta destrancada. Vá para a saída — leste do setor.', '#39ff14', 5);
      }, 900);
    } else if (result.status === 'wrong') {
      this.stats.wrong++;
      this.threat.penalize(10);
      this.audio.error();
      this.renderer.kick(9);
      this.terminalFeedback = { text: result.message, ok: false };
      this.input.textBuffer = '';
    } else {
      this.audio.error();
      this.terminalFeedback = { text: result.message, ok: false };
      this.input.textBuffer = '';
    }
  }

  _nextLevel() {
    this.audio.hydraulicUnlock();
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = State.VICTORY;
      this.stateTime = 0;
      this.audio.pulseBpm = 0;
      this.audio.geigerRate = 0;
      this.audio.victory();
    } else {
      this.loadLevel(this.levelIndex + 1);
    }
  }

  _gameOver(reason) {
    this.gameOverReason = reason;
    this.state = State.GAMEOVER;
    this.stateTime = 0;
    this.audio.pulseBpm = 0;
    this.audio.geigerRate = 0;
    this.input.setTextMode(false);
    this.renderer.kick(14);
  }

  _say(text, color = '#c8f5bd', seconds = 3.5) {
    this.toast = { text, color };
    this.toastTimer = seconds;
    this.dom.status.textContent = text.length > 70 ? `${text.slice(0, 70)}...` : text;
  }

  // ------------------------------------------------------------ painel lateral (DOM)
  _syncPanel() {
    const { dom } = this;
    if (!this.level) return;

    dom.sectorLabel.textContent = `SETOR ${this.level.sector}`;
    dom.journalSector.textContent = this.level.name;

    const entries = this.journal.entries();
    dom.journalVars.innerHTML = entries.length
      ? entries.map((e) => `<li>${e.key} = ${e.value}</li>`).join('')
      : '<li class="empty">nenhuma variável coletada</li>';

    const missing = this.terminal.missingVariables();
    dom.journalGoal.textContent = this.level.doorUnlocked
      ? 'Comporta liberada. Alcance a saída a leste.'
      : missing.length
        ? `Localizar variável ${missing.join(', ')} e acessar o terminal.`
        : `Resolver ${this.level.def.puzzle.display} no terminal.`;

    const state = this.threat.state.toLowerCase();
    dom.threatState.className = `threat ${state}`;
    dom.threatState.textContent = this.threat.label();
    dom.threatBar.style.width = `${this.threat.ratio * 100}%`;
    dom.threatBar.style.background = this.threat.ratio < 0.35 ? '#ff3b30' : '#39ff14';
  }

  // ------------------------------------------------------------ desenho
  _render(dt) {
    switch (this.state) {
      case State.MENU:
        this.renderer.drawMenu();
        break;
      case State.BRIEFING:
        this.renderer.drawBriefing(this.level, this.stateTime);
        break;
      case State.PLAYING:
        this.renderer.drawWorld(this._renderState(), dt);
        break;
      case State.TERMINAL:
        this.renderer.drawWorld(this._renderState(), dt);
        this.renderer.drawTerminal({
          ...this._renderState(),
          inputBuffer: this.input.textBuffer,
          terminalFeedback: this.terminalFeedback,
        });
        break;
      case State.GAMEOVER:
        this.renderer.drawGameOver(this.gameOverReason, this.level.sector);
        break;
      case State.VICTORY:
        this.renderer.drawVictory(this.stats);
        break;
      default:
        break;
    }
  }

  _renderState() {
    return {
      level: this.level,
      player: this.player,
      threat: this.threat,
      terminal: this.terminal,
      toast: this.toast,
    };
  }
}
