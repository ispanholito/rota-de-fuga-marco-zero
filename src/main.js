/**
 * Ponto de entrada — Rota de Fuga: Marco Zero
 * PAC Extensionista / Engenharia de Software — Centro Universitário Católica de SC.
 *
 * Liga o DOM da página ao objeto Game e inicia o laço de renderização.
 */

import { Game } from './game/game.js';

const dom = {
  canvas: document.getElementById('screen'),
  sectorLabel: document.getElementById('sector-label'),
  journalSector: document.getElementById('journal-sector'),
  journalVars: document.getElementById('journal-vars'),
  journalGoal: document.getElementById('journal-goal'),
  threatState: document.getElementById('threat-state'),
  threatBar: document.querySelector('#threat-bar i'),
  status: document.getElementById('status-msg'),
  fps: document.getElementById('fps'),
};

const game = new Game(dom.canvas, dom);
game.start();

// Exposto para depuração no console do navegador (ex.: window.jogo.stats).
window.jogo = game;
