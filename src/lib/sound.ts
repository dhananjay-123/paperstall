"use client";

// A soft "ka-ching" synthesised with Web Audio: no audio files, nothing copyrighted.
export function kaching() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const bell = (freq: number, at: number, dur: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + at);
      g.gain.setValueAtTime(0, now + at);
      g.gain.linearRampToValueAtTime(gain, now + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.05);
    };
    // "ka": a short low tick; "ching": two bright partials.
    bell(220, 0, 0.08, 0.12);
    bell(1568, 0.09, 0.7, 0.16);
    bell(2093, 0.1, 0.9, 0.1);
    setTimeout(() => void ctx.close(), 1400);
  } catch {
    // No audio available: the visual receipt still plays.
  }
}
