/**
 * PC-speaker style blips synthesised on the fly. Square waves through a short
 * envelope - no audio files, which keeps the whole game a single bundle.
 */
type Cue = 'walk' | 'climb' | 'land' | 'pickup' | 'drop' | 'blocked' | 'win';

interface Note {
  freq: number;
  ms: number;
  gain: number;
}

const CUES: Record<Cue, Note[]> = {
  walk: [{ freq: 180, ms: 22, gain: 0.05 }],
  climb: [{ freq: 320, ms: 40, gain: 0.06 }],
  land: [{ freq: 110, ms: 55, gain: 0.08 }],
  pickup: [{ freq: 520, ms: 45, gain: 0.07 }],
  drop: [{ freq: 240, ms: 55, gain: 0.07 }],
  blocked: [{ freq: 90, ms: 70, gain: 0.05 }],
  win: [
    { freq: 523, ms: 90, gain: 0.09 },
    { freq: 659, ms: 90, gain: 0.09 },
    { freq: 784, ms: 90, gain: 0.09 },
    { freq: 1047, ms: 200, gain: 0.09 },
  ],
};

export class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Browsers require a gesture before audio starts; call from the first input. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null; // Audio is a nicety; never let it break the game.
    }
  }

  play(cue: Cue): void {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    let t = ctx.currentTime;

    for (const note of CUES[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, t);

      const dur = note.ms / 1000;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(note.gain, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur;
    }
  }
}
