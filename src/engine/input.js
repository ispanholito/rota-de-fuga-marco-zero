/**
 * Camada de entrada (teclado).
 *
 * Mantém dois conjuntos:
 *  - `down`: teclas atualmente pressionadas (movimentação contínua);
 *  - `pressed`: teclas pressionadas neste quadro (ações pontuais, ex.: E, Enter).
 *
 * O jogo também consome texto digitado enquanto o terminal CRT está aberto;
 * por isso existe o modo "captura de texto" (setTextMode).
 */

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.textMode = false;
    this.textBuffer = '';
    this.onTextSubmit = null;

    target.addEventListener('keydown', (e) => this._onKeyDown(e));
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Se a janela perde o foco, solta todas as teclas (evita "andar sozinho").
    window.addEventListener('blur', () => this.down.clear());
  }

  _onKeyDown(e) {
    // Evita que as setas e a barra de espaço rolem a página.
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();

    if (!e.repeat) this.pressed.add(e.code);
    this.down.add(e.code);

    if (this.textMode) this._handleText(e);
  }

  _handleText(e) {
    if (e.key === 'Backspace') {
      this.textBuffer = this.textBuffer.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      if (this.onTextSubmit) this.onTextSubmit(this.textBuffer.trim());
      return;
    }
    // Aceita apenas dígitos e o sinal negativo (respostas podem ser negativas).
    if (/^[0-9]$/.test(e.key) && this.textBuffer.length < 8) {
      this.textBuffer += e.key;
    } else if (e.key === '-' && this.textBuffer.length === 0) {
      this.textBuffer = '-';
    }
  }

  /** Ativa/desativa a captura de dígitos do terminal. */
  setTextMode(active, onSubmit = null) {
    this.textMode = active;
    this.textBuffer = '';
    this.onTextSubmit = onSubmit;
  }

  /** Direção de movimento como vetor normalizado. */
  axis() {
    let x = 0;
    let y = 0;
    for (const code of this.down) {
      switch (MOVE_KEYS[code]) {
        case 'up': y -= 1; break;
        case 'down': y += 1; break;
        case 'left': x -= 1; break;
        case 'right': x += 1; break;
        default: break;
      }
    }
    if (x && y) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  anyPressed() {
    return this.pressed.size > 0;
  }

  /** Limpa as teclas do quadro. Chamado no fim de cada update. */
  endFrame() {
    this.pressed.clear();
  }
}
