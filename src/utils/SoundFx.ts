/**
 * Procedural Web Audio Sound Synthesizer for Retro Puzzle Games
 * Zero external dependencies, provides immediate responsive audio for cursors, swaps, matches, combos, and chains.
 */
export class SoundFx {
  private static ctx: AudioContext | null = null;
  public static enabled: boolean = true;
  public static volume: number = 0.35;

  private static getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Short click when moving cursor */
  public static playCursor(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);

    gain.gain.setValueAtTime(this.volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** Crisp mechanical tactile switch click on swap commit */
  public static playSwapCommit(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Stage 1: Tactile click transient impulse
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'square';
    oscClick.frequency.setValueAtTime(1450, now);
    oscClick.frequency.exponentialRampToValueAtTime(750, now + 0.015);
    gainClick.gain.setValueAtTime(this.volume * 0.45, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.018);

    // Stage 2: Resonant glass snap tone
    const oscTone = ctx.createOscillator();
    const gainTone = ctx.createGain();
    oscTone.type = 'triangle';
    oscTone.frequency.setValueAtTime(420, now + 0.004);
    oscTone.frequency.exponentialRampToValueAtTime(840, now + 0.045);
    gainTone.gain.setValueAtTime(this.volume * 0.35, now + 0.004);
    gainTone.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    oscTone.connect(gainTone);
    gainTone.connect(ctx.destination);
    oscTone.start(now + 0.004);
    oscTone.stop(now + 0.05);
  }

  /** Quick snap/whoosh when swapping two tiles */
  public static playSwap(): void {
    this.playSwapCommit();
  }

  /** Soft thud when a panel lands after falling */
  public static playLand(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

    gain.gain.setValueAtTime(this.volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Pop sound when an individual matched panel pops */
  public static playPop(pitchOffset: number = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    const baseFreq = 520 * Math.pow(1.05946, pitchOffset);
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);

    gain.gain.setValueAtTime(this.volume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Sparkling chime when a match is detected */
  public static playMatch(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.035;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(this.volume * 0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.12);
    });
  }

  /** Bright ascending chime for menu decisions / confirmations */
  public static playDecide(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [587.33, 880.0]; // D5 -> A5
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.05;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.45, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.14);
    });
  }

  /** Subtle low buzzer / refusal sound for locked items or invalid actions */
  public static playCancel(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(this.volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Ascending chime for chain combos (x2, x3, x4...) and 4+ combos.
   * Pitch shifts up by exactly +1 semitone per cascade level (f = f0 * 2^(n / 12)).
   */
  public static playCombo(chainLevel: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Base root frequency at C5 (523.25 Hz), shifted by +1 semitone per cascade level
    const semitoneShift = Math.max(0, chainLevel - 1);
    const rootFreq = 523.25 * Math.pow(2, semitoneShift / 12);
    // Ascending major arpeggio: Root, 3rd (5:4), 5th (3:2), Octave (2:1), 10th (5:2)
    const arpeggio = [
      rootFreq,
      rootFreq * 1.25,
      rootFreq * 1.5,
      rootFreq * 2.0,
      rootFreq * 2.5
    ];

    arpeggio.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.035;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, startTime + 0.22);

      gain.gain.setValueAtTime(this.volume * 0.45, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  /** Subtle tick when manually fast-lifting the stack */
  public static playLiftTick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.03);

    gain.gain.setValueAtTime(this.volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /** Pulse warning beep when stack reaches the danger ceiling */
  public static playDangerBeep(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(700, now + 0.08);

    gain.gain.setValueAtTime(this.volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Dramatic top-out / defeat sound */
  public static playTopOut(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [260, 220, 180, 140, 90].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.1;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, startTime + 0.15);

      gain.gain.setValueAtTime(this.volume * 0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  /** Heavy squishy thud when a garbage block lands */
  public static playGarbageLand(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(this.volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Magical sparkling chimes when a garbage block transforms into colored slimes */
  public static playGarbageTransform(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = [440, 554.37, 659.25, 880, 1108.73]; // A4, C#5, E5, A5, C#6

    scale.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + 0.18);

      gain.gain.setValueAtTime(this.volume * 0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  /** Triumphant Victory Fanfare */
  public static playVictory(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Classic victory fanfare sequence: C, C, C, G, A#, C
    const melody = [
      { note: 523.25, time: 0.0, dur: 0.12 },
      { note: 523.25, time: 0.14, dur: 0.12 },
      { note: 523.25, time: 0.28, dur: 0.12 },
      { note: 523.25, time: 0.42, dur: 0.3 },
      { note: 415.3, time: 0.74, dur: 0.25 },
      { note: 466.16, time: 1.0, dur: 0.25 },
      { note: 523.25, time: 1.28, dur: 0.6 }
    ];

    melody.forEach((item) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + item.time;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.note, startTime);

      gain.gain.setValueAtTime(this.volume * 0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + item.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + item.dur);
    });
  }

  /** Synthesize an explosive rock electric guitar power chord (Root + 5th + Octave with distortion drive) */
  public static playPowerChord(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Power chord notes: E3 (164.81), B3 (246.94), E4 (329.63), E5 (659.25)
    const chordFreqs = [164.81, 246.94, 329.63, 659.25];

    let waveShaper: WaveShaperNode | null = null;
    try {
      if (typeof ctx.createWaveShaper === 'function') {
        waveShaper = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = ((Math.PI + 4) * x) / (Math.PI + 4 * Math.abs(x));
        }
        waveShaper.curve = curve;
      }
    } catch {
      waveShaper = null;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.55, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    if (waveShaper) {
      waveShaper.connect(masterGain);
    }
    masterGain.connect(ctx.destination);

    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const strumDelay = idx * 0.012;
      const startTime = now + strumDelay;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.99, startTime + 0.6);

      noteGain.gain.setValueAtTime(0.35, startTime);
      noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);

      osc.connect(noteGain);
      if (waveShaper) {
        noteGain.connect(waveShaper);
      } else {
        noteGain.connect(masterGain);
      }

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }
}
