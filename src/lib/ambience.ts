type AmbienceKind = "rain" | "fire" | "cafe" | "piano";

function fillNoise(data: Float32Array, kind: AmbienceKind) {
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "rain") {
      last = (last + white * 0.02) / 1.02;
      data[index] = last;
    } else if (kind === "fire") {
      data[index] = Math.random() > 0.985 ? white : white * 0.015;
    } else if (kind === "cafe") {
      last = (last + white * 0.08) / 1.08;
      data[index] = last * 0.35 + (Math.random() > 0.997 ? white * 0.4 : 0);
    } else {
      const step = index % Math.floor(data.length / 8);
      data[index] = step < 800 ? Math.sin(index / 40) * Math.exp(-step / 700) * 0.2 : white * 0.004;
    }
  }
}

/**
 * Prefers a short loop at /ambience/{kind}.ogg (rain, fire, cafe, piano).
 * Until those recordings are added, the same names play a soft generated bed.
 */
export function createAmbience() {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let generation = 0;

  function stop() {
    generation += 1;
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

  async function start(kind: AmbienceKind, volume: number) {
    stop();
    const token = generation;
    const ctx = new AudioContext();
    let buffer: AudioBuffer | null = null;
    try {
      const response = await fetch(`/ambience/${kind}.ogg`);
      if (response.ok) {
        buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      }
    } catch {
      buffer = null;
    }
    if (token !== generation) {
      void ctx.close();
      return;
    }
    if (!buffer) {
      buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      fillNoise(buffer.getChannelData(0), kind);
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
