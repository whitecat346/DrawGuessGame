let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOptions {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
}

function tone({ freq, start, duration, type = "square", volume = 0.18, slideTo }: ToneOptions) {
  const audio = getContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + start);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), audio.currentTime + start + duration);
  }
  gain.gain.setValueAtTime(0.0001, audio.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.02);
}

export const sounds = {
  click() {
    tone({ freq: 220, start: 0, duration: 0.08, type: "square", volume: 0.08 });
  },
  tick() {
    tone({ freq: 880, start: 0, duration: 0.05, type: "square", volume: 0.12 });
  },
  correct() {
    tone({ freq: 523, start: 0, duration: 0.12, type: "square", volume: 0.18 });
    tone({ freq: 784, start: 0.1, duration: 0.2, type: "square", volume: 0.18 });
  },
  wrong() {
    tone({ freq: 180, start: 0, duration: 0.18, type: "sawtooth", volume: 0.1, slideTo: 90 });
  },
  roundEnd() {
    tone({ freq: 660, start: 0, duration: 0.15, type: "square", volume: 0.16 });
    tone({ freq: 440, start: 0.15, duration: 0.25, type: "square", volume: 0.16 });
  },
  kick() {
    tone({ freq: 320, start: 0, duration: 0.12, type: "sawtooth", volume: 0.16, slideTo: 120 });
    tone({ freq: 220, start: 0.12, duration: 0.25, type: "sawtooth", volume: 0.14, slideTo: 80 });
  },
  hint() {
    tone({ freq: 700, start: 0, duration: 0.1, type: "triangle", volume: 0.12 });
    tone({ freq: 900, start: 0.1, duration: 0.12, type: "triangle", volume: 0.12 });
  },
};
