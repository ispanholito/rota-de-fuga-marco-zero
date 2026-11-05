/**
 * Áudio sintetizado em tempo real (Web Audio API).
 *
 * Decisão de projeto: nenhum arquivo de áudio externo é usado. Todos os sons
 * exigidos pelo GDD são gerados proceduralmente por osciladores e ruído, o que
 * (a) elimina dependências de download e questões de licenciamento e
 * (b) permite modular a trilha em tempo real conforme a ameaça se aproxima
 *     (o "BPM que acelera" descrito no documento de design).
 *
 * Mapa de sons do GDD -> implementação:
 *   Bunker_Ambient_OST  -> drone industrial (2 osciladores em detune + filtro)
 *   Siren_Tension_BPM   -> pulso rítmico que acelera conforme o estado da ameaça
 *   Geiger_Click_FX     -> estalos de ruído branco, taxa ~ proximidade da radiação
 *   Keyboard_Click_FX   -> clique seco (ruído curto + filtro passa-alta)
 *   Hydraulic_Lock_FX   -> varredura descendente + sopro de ar (porta abrindo)
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.geigerRate = 0;      // 0..1 — proximidade da radiação
    this._geigerAcc = 0;
    this._pulseAcc = 0;
    this.pulseBpm = 0;        // 0 = sem pulso de tensão
  }

  /** O navegador só permite criar áudio após um gesto do usuário. */
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    this._startAmbient();
    this.started = true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.45 : 0, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  /** Drone contínuo de ambientação. */
  _startAmbient() {
    const { ctx } = this;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    [55, 55.7, 82.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.25 : 0.5;
      osc.connect(g).connect(filter);
      osc.start();
    });

    filter.connect(gain).connect(this.master);
    this.ambientGain = gain;
  }

  /** Ruído branco curto — base dos efeitos percussivos. */
  _noiseBurst(duration, { hp = 0, lp = 20000, volume = 0.3 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames); // decaimento linear
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    let node = src;
    if (hp) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      node = node.connect(f);
    }
    if (lp < 20000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node = node.connect(f);
    }
    const g = ctx.createGain();
    g.gain.value = volume;
    node.connect(g).connect(this.master);
    src.start();
  }

  /** Tom simples com envelope, usado em bipes e varreduras. */
  _tone(freq, duration, { type = 'square', volume = 0.2, sweepTo = null } = {}) {
    if (!this.ctx || !this.enabled) return;
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + duration);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // -------- efeitos nomeados (correspondem à tabela de áudio do GDD) --------

  keyboardClick() { this._noiseBurst(0.035, { hp: 2200, volume: 0.28 }); }

  footstep() { this._noiseBurst(0.07, { hp: 180, lp: 1400, volume: 0.10 }); }

  pickup() {
    this._tone(880, 0.08, { type: 'square', volume: 0.12 });
    setTimeout(() => this._tone(1320, 0.1, { type: 'square', volume: 0.10 }), 70);
  }

  error() {
    this._tone(180, 0.35, { type: 'sawtooth', volume: 0.22, sweepTo: 90 });
    this._noiseBurst(0.2, { hp: 900, volume: 0.15 });
  }

  hydraulicUnlock() {
    this._tone(420, 0.55, { type: 'triangle', volume: 0.2, sweepTo: 110 });
    this._noiseBurst(0.9, { hp: 300, lp: 3000, volume: 0.22 });
  }

  doorSlam() { this._noiseBurst(0.45, { hp: 60, lp: 700, volume: 0.35 }); }

  breach() {
    this._tone(120, 1.2, { type: 'sawtooth', volume: 0.3, sweepTo: 40 });
    this._noiseBurst(1.0, { lp: 900, volume: 0.4 });
  }

  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.28, { type: 'triangle', volume: 0.16 }), i * 150));
  }

  /** Pulso rítmico de tensão (substitui a trilha quando o tempo aperta). */
  _tensionPulse() {
    this._tone(70, 0.16, { type: 'sine', volume: 0.25 });
    this._noiseBurst(0.12, { hp: 120, lp: 800, volume: 0.12 });
  }

  /**
   * Atualização por quadro: dispara estalos do contador Geiger conforme a
   * proximidade da radiação e o pulso de tensão conforme o BPM atual.
   */
  update(dt) {
    if (!this.ctx || !this.enabled) return;

    if (this.geigerRate > 0.01) {
      this._geigerAcc += dt * (2 + this.geigerRate * 22);
      while (this._geigerAcc >= 1) {
        this._geigerAcc -= 1;
        this._noiseBurst(0.02, { hp: 3000, volume: 0.05 + this.geigerRate * 0.12 });
      }
    }

    if (this.pulseBpm > 0) {
      this._pulseAcc += dt * (this.pulseBpm / 60);
      while (this._pulseAcc >= 1) {
        this._pulseAcc -= 1;
        this._tensionPulse();
      }
    }

    // O drone fica mais presente conforme a pressão aumenta.
    if (this.ambientGain) {
      const target = 0.06 + Math.min(0.06, this.pulseBpm / 2400);
      this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
    }
  }
}
