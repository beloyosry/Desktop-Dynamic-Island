// Reuse one context for overlapping sounds, then release the audio device when quiet.
let audioCtx: AudioContext | null = null;
let voices = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
export function releaseIdleAudio() {
  if (voices || !audioCtx) return;
  clearTimeout(releaseTimer);
  const context = audioCtx;
  audioCtx = null;
  void context.close().catch(() => {});
}
export function playTones(
  notes: number[][],
  {
    peak = 0.25,
    attack = 0.02,
    decay = 0.35,
    type = 'sine',
  }: { peak?: number; attack?: number; decay?: number; type?: OscillatorType } = {},
) {
  try {
    clearTimeout(releaseTimer);
    audioCtx ||= new AudioContext();
    const context = audioCtx;
    void context.resume().catch(() => {});
    const t0 = audioCtx.currentTime;
    for (const [d, f] of notes) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(peak, t0 + d + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + decay);
      o.connect(g).connect(audioCtx.destination);
      voices++;
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        voices--;
        if (voices) return;
        releaseTimer = setTimeout(() => {
          if (voices || audioCtx !== context) return;
          audioCtx = null;
          void context.close().catch(() => {});
        }, 5000);
      };
      o.start(t0 + d);
      o.stop(t0 + d + decay + 0.05);
    }
  } catch {}
}
