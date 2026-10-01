type AmbienceKind = "rain" | "fire";

export function createAmbience() {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let source: AudioBufferSourceNode | null = null;

  function stop() {
    try {
      source?.stop();
    } catch {
      // Already stopped.
    }
    source = null;
    gain = null;
    void context?.close();
    context = null;
  }

  function start(kind: AmbienceKind, volume: number) {
    stop();
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "rain") {
        last = (last + white * 0.02) / 1.02;
        data[index] = last;
      } else {
        data[index] = Math.random() > 0.985 ? white : white * 0.015;
      }
    }
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    const amp = ctx.createGain();
    amp.gain.value = 0;
    node.connect(amp);
    amp.connect(ctx.destination);
    node.start();
    amp.gain.linearRampToValueAtTime(Math.max(0, volume) * 0.15, ctx.currentTime + 0.6);
    context = ctx;
    gain = amp;
    source = node;
  }

  return { start, stop };
}
