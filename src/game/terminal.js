/**
 * Terminal de Criptografia — o sistema central de puzzle.
 *
 * Entradas : variáveis coletadas no setor + dígitos digitados pelo jogador.
 * Processo : compara o valor digitado com a resposta da expressão do setor.
 * Saídas   : destranca a comporta, ou dispara o alarme (penalidade de tempo).
 *
 * A interface é diegética: o jogador "usa" um console CRT dentro do mundo,
 * e não um menu de quiz sobreposto ao jogo.
 */

export class Terminal {
  constructor(level, journal) {
    this.level = level;
    this.journal = journal;
    this.open = false;
    this.attempts = 0;
    this.solved = false;
    this.log = [];
    this.cursorBlink = 0;
  }

  get puzzle() { return this.level.def.puzzle; }

  /** Monta as linhas de texto exibidas no monitor. */
  openTerminal() {
    this.open = true;
    this.log = [
      this.puzzle.terminalHeader,
      '',
      'STATUS......: TRANCADA',
      'CRIPTOGRAFIA: ATIVA',
      '',
      `EXPRESSÃO DE ACESSO: ${this.puzzle.display}`,
    ];

    const known = this.journal.entries();
    if (known.length) {
      this.log.push('', 'VARIÁVEIS RECONHECIDAS:');
      known.forEach(({ key, value }) => this.log.push(`  ${key} = ${value}`));
    } else {
      this.log.push('', 'NENHUMA VARIÁVEL RECONHECIDA.',
        'VASCULHE O SETOR ANTES DE TENTAR O CÓDIGO.');
    }

    const missing = this.missingVariables();
    if (missing.length) {
      this.log.push('', `PENDENTE: ${missing.join(', ')}`);
    } else {
      this.log.push('', 'DADOS SUFICIENTES. INSIRA O RESULTADO.');
    }
  }

  close() {
    this.open = false;
  }

  missingVariables() {
    const known = new Set(this.journal.entries().map((e) => e.key));
    return this.level.def.clues.map((c) => c.key).filter((k) => !known.has(k));
  }

  /**
   * Avalia o código digitado.
   * @returns {{status: 'ok'|'wrong'|'empty'|'incomplete', message: string}}
   */
  submit(raw) {
    const text = String(raw).trim();
    if (text === '' || text === '-') {
      return { status: 'empty', message: 'CAMPO VAZIO. DIGITE O RESULTADO.' };
    }
    if (this.missingVariables().length) {
      return {
        status: 'incomplete',
        message: `DADOS INSUFICIENTES: FALTA ${this.missingVariables().join(', ')}.`,
      };
    }

    this.attempts++;
    const value = Number(text);
    if (Number.isFinite(value) && value === this.puzzle.answer) {
      this.solved = true;
      this.level.doorUnlocked = true;
      return { status: 'ok', message: 'CÓDIGO ACEITO. TRINCOS LIBERADOS.' };
    }
    return {
      status: 'wrong',
      message: `CÓDIGO REJEITADO (${text}). ALARME ACIONADO.`,
    };
  }
}

/** Diário do engenheiro: registro automático das variáveis encontradas. */
export class Journal {
  constructor() {
    this.map = new Map();
    this.lastAdded = null;
  }

  add(key, value) {
    this.map.set(key, value);
    this.lastAdded = key;
  }

  has(key) { return this.map.has(key); }

  entries() {
    return [...this.map.entries()].map(([key, value]) => ({ key, value }));
  }

  clear() {
    this.map.clear();
    this.lastAdded = null;
  }
}
