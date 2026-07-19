export class AudioEngine {
  constructor(muted = false) {
    this.muted = muted;
    this.context = null;
    this.master = null;
    this.storm = null;
  }

  ensure() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.02);
  }

  tone(frequency = 220, duration = 0.08, type = "square", volume = 0.04, end = 0.72) {
    if (this.muted || !this.ensure()) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * end), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  chord(notes, duration = 0.32, volume = 0.025) {
    notes.forEach((note, index) => setTimeout(() => this.tone(note, duration, "triangle", volume, 1.01), index * 45));
  }

  cue(name) {
    const cues = {
      launch: () => this.tone(105, 0.2, "sawtooth", 0.07, 1.8),
      flip: () => this.tone(145, 0.04, "square", 0.025),
      bumper: () => this.tone(235 + Math.random() * 90, 0.09, "square", 0.04),
      landmark: () => this.chord([330, 440, 660], 0.18, 0.035),
      jackpot: () => this.chord([220, 330, 440, 660], 0.3, 0.045),
      super: () => this.chord([262, 330, 392, 523, 784], 0.62, 0.055),
      drain: () => this.tone(115, 0.5, "sawtooth", 0.045, 0.38),
      tilt: () => this.tone(82, 0.7, "square", 0.055, 0.7),
      rollover: () => this.tone(680, 0.08, "sine", 0.035, 1.2),
    };
    cues[name]?.();
  }
}
