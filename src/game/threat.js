/**
 * Sistema de Ameaça — o "cronômetro invisível" descrito no GDD.
 *
 * Não existe inimigo desenhado em tela: a pressão é sonora e temporal.
 * A máquina de estados segue o documento:
 *   AFAR     — ruídos distantes, tempo seguro para explorar;
 *   APPROACH — passos no corredor, trilha acelera;
 *   BREACH   — invasão do setor: fim de jogo.
 *
 * Duas ações do jogador alteram o cronômetro:
 *   - permanecer em cobertura (colado a caixotes) desacelera o avanço;
 *   - errar o código no terminal dispara o alarme e adianta a ameaça.
 */

export const ThreatState = {
  AFAR: 'AFAR',
  APPROACH: 'APPROACH',
  BREACH: 'BREACH',
};

export class Threat {
  constructor(totalTime) {
    this.total = totalTime;
    this.remaining = totalTime;
    this.state = ThreatState.AFAR;
    this.slamTimer = 4;
  }

  get ratio() { return Math.max(0, this.remaining / this.total); }

  /** Penalidade por código incorreto: o alarme entrega a posição do jogador. */
  penalize(seconds = 10) {
    this.remaining = Math.max(0, this.remaining - seconds);
  }

  update(dt, { inCover }, audio) {
    // Em cobertura o jogador faz menos ruído, e os saqueadores demoram mais.
    const rate = inCover ? 0.6 : 1;
    this.remaining = Math.max(0, this.remaining - dt * rate);

    const previous = this.state;
    if (this.remaining <= 0) this.state = ThreatState.BREACH;
    else if (this.ratio < 0.35) this.state = ThreatState.APPROACH;
    else this.state = ThreatState.AFAR;

    // Trilha de tensão: BPM cresce conforme o tempo se esgota.
    if (this.state === ThreatState.AFAR) audio.pulseBpm = 0;
    else if (this.state === ThreatState.APPROACH) audio.pulseBpm = 70 + (1 - this.ratio / 0.35) * 70;
    else audio.pulseBpm = 0;

    // Batidas ocasionais nas comportas anteriores — ficam mais frequentes.
    this.slamTimer -= dt;
    if (this.slamTimer <= 0) {
      this.slamTimer = 2 + this.ratio * 9;
      if (this.state !== ThreatState.BREACH) audio.doorSlam();
    }

    if (previous !== ThreatState.BREACH && this.state === ThreatState.BREACH) {
      audio.breach();
      return { breached: true };
    }
    return { breached: false };
  }

  /** Texto exibido no painel lateral. */
  label() {
    switch (this.state) {
      case ThreatState.APPROACH: return 'APROXIMANDO';
      case ThreatState.BREACH: return 'INVASÃO';
      default: return 'DISTANTE';
    }
  }
}
