/**
 * A soft "whoosh" for turning a flashcard (owner, 2026-10-18): a short burst of noise through a
 * band-pass filter that sweeps down, made in the browser — no sound file to download. Quiet, and
 * silent where Web Audio isn't available.
 */
let context: AudioContext | null = null;

export function playSwipeSound() {
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    // Phones start the audio suspended until a tap; a swipe or a button press is one.
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const length = 0.28;

    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = noise;

    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + length);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.stop(now + length);
  } catch {
    // No sound is fine.
  }
}
