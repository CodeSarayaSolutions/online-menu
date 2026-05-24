/** Programmatic chime via Web Audio API — no external audio files. */

export function playBarChime(subtle = false) {
  if (typeof window === "undefined") return;

  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const volume = subtle ? 0.08 : 0.15;
    const freqs = subtle ? [880, 1100] : [660, 880, 1100];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = now + i * 0.12;
      const end = start + (subtle ? 0.1 : 0.14);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.start(start);
      osc.stop(end + 0.05);
    });

    setTimeout(() => void ctx.close(), 800);
  } catch {
    // AudioContext may be blocked until user gesture — fail silently
  }
}

export function isBarSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("bar_sound_muted") === "1";
}

export function setBarSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("bar_sound_muted", muted ? "1" : "0");
}
