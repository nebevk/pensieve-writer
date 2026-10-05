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

// Each recording carries a quarter second of its own sound before and after the loop, because lossy
// codecs blur a file's first and last moments. Only the middle is looped, so the seam stays clean.
const EDGE = 0.25;
const FADE_IN = 1.5;
const FADE_OUT = 0.8;
// The recordings are evened out to the same loudness, so the slider sets their level directly.
// The generated stand-in is much louder per sample and plays quieter.
const RECORDED_GAIN = 1;
const GENERATED_GAIN = 0.15;

type Playing = { source: AudioBufferSourceNode; gain: GainNode; level: number };

/**
 * Plays a seamless loop from /ambience/{kind}.ogg (rain, fire, cafe, piano), fading in and out.
 * Without the file, the same names play a soft generated bed. The volume changes without
 * restarting, and the audio device is released while nothing plays.
 */
export function createAmbience() {
  let context: AudioContext | null = null;
  let playing: Playing | null = null;
  let generation = 0;
  let volume = 0;
  let decoded: { kind: AmbienceKind; buffer: AudioBuffer; level: number; edge: number } | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  async function load(audio: AudioContext, kind: AmbienceKind) {
    // Keep only the sound in use: a decoded minute of stereo is about 23 MB.
    if (decoded?.kind === kind) return decoded;
    let buffer: AudioBuffer | null = null;
    try {
      const response = await fetch(`/ambience/${kind}.ogg`);
      if (response.ok) buffer = await audio.decodeAudioData(await response.arrayBuffer());
    } catch {
      buffer = null;
    }
    if (buffer) return (decoded = { kind, buffer, level: RECORDED_GAIN, edge: EDGE });
    const generated = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    fillNoise(generated.getChannelData(0), kind);
    return (decoded = { kind, buffer: generated, level: GENERATED_GAIN, edge: 0 });
  }

  function fadeOut(sound: Playing, audio: AudioContext) {
    const now = audio.currentTime;
    sound.gain.gain.cancelScheduledValues(now);
    sound.gain.gain.setValueAtTime(sound.gain.gain.value, now);
    sound.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    sound.source.stop(now + FADE_OUT + 0.05);
  }

  function stop() {
    generation += 1;
    const audio = context;
    if (!audio || !playing) return;
    fadeOut(playing, audio);
    playing = null;
    // Let the fade finish, then free the audio device.
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!playing && audio.state === "running") void audio.suspend();
    }, (FADE_OUT + 0.3) * 1000);
  }

  async function start(kind: AmbienceKind, level: number) {
    stop();
    const token = generation;
    volume = Math.max(0, level);
    // "playback" asks for larger audio buffers (less work for an older laptop), and 32 kHz keeps a
    // decoded loop at two thirds of the size; ambience loses nothing it needs.
    const audio = (context ??= new AudioContext({ latencyHint: "playback", sampleRate: 32000 }));
    if (idleTimer) clearTimeout(idleTimer);
    if (audio.state === "suspended") await audio.resume();
    const sound = await load(audio, kind);
    if (token !== generation) return;
    const source = audio.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = true;
    if (sound.edge) {
      source.loopStart = sound.edge;
      source.loopEnd = sound.buffer.duration - sound.edge;
    }
    const gain = audio.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(audio.destination);
    source.start(0, sound.edge);
    gain.gain.linearRampToValueAtTime(volume * sound.level, audio.currentTime + FADE_IN);
    playing = { source, gain, level: sound.level };
  }

  /** Follows the volume slider smoothly, without starting the sound again. */
  function setVolume(level: number) {
    volume = Math.max(0, level);
    if (!context || !playing) return;
    const now = context.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setTargetAtTime(volume * playing.level, now, 0.08);
  }

  return { start, stop, setVolume };
}
