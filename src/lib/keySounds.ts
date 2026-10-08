/**
 * Keys that sound as they are typed on the page (owner, 8 October): an old typewriter, or a soft
 * keyboard; off to start with (Settings → Sound). The sounds are made once, as a few tiny clips, when
 * the first key wants one; after that a key only starts a clip, a few microseconds of work, so typing
 * never waits for it.
 */
export type KeySoundStyle = "off" | "typewriter" | "soft";

type Clips = { keys: AudioBuffer[]; space: AudioBuffer; enter: AudioBuffer };

// The slider shows 0 to 100; its 100 plays at half, as the ambience does.
const CEILING = 0.5;

let context: AudioContext | null = null;
let output: GainNode | null = null;
let made: { style: Exclude<KeySoundStyle, "off">; clips: Clips } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let turn = 0;

/** A clip of `seconds`, each sample from `at(time, index)`. */
function clip(audio: AudioContext, seconds: number, at: (time: number) => number): AudioBuffer {
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = at(index / audio.sampleRate);
  return buffer;
}

/** White noise smoothed toward its last value: lower `keep` keeps more of the high, clicky part. */
function noise(keep: number) {
  let last = 0;
  return () => {
    last = last * keep + (Math.random() * 2 - 1) * (1 - keep);
    return last;
  };
}

function make(audio: AudioContext, style: Exclude<KeySoundStyle, "off">): Clips {
  if (style === "typewriter") {
    // A sharp strike over a short wooden thump; a few of them, so no two keys sound quite alike.
    const key = (pitch: number) => {
      const hiss = noise(0.35);
      return clip(audio, 0.07, (time) => hiss() * Math.exp(-time * 160) * 0.9 + Math.sin(2 * Math.PI * pitch * time) * Math.exp(-time * 55) * 0.45);
    };
    const thud = noise(0.8);
    return {
      keys: [key(170), key(190), key(150), key(205)],
      space: clip(audio, 0.11, (time) => thud() * Math.exp(-time * 70) * 1.2 + Math.sin(2 * Math.PI * 110 * time) * Math.exp(-time * 40) * 0.5),
      // The carriage's bell.
      enter: clip(audio, 1.1, (time) => (Math.sin(2 * Math.PI * 2093 * time) * 0.5 + Math.sin(2 * Math.PI * 4186 * time) * 0.2) * Math.exp(-time * 4.5) * Math.min(1, time * 400)),
    };
  }
  // A soft keyboard: muted ticks.
  const key = (keep: number) => {
    const tap = noise(keep);
    return clip(audio, 0.04, (time) => tap() * Math.exp(-time * 220) * 1.6);
  };
  return { keys: [key(0.75), key(0.78), key(0.72)], space: key(0.86), enter: key(0.84) };
}

/** The sound for a key pressed on the page; nothing for the keys that don't write (arrows, Ctrl+…). */
export function keySound(event: KeyboardEvent, style: KeySoundStyle, volume: number) {
  if (style === "off" || event.repeat || event.ctrlKey || event.metaKey || (event.altKey && !event.getModifierState("AltGraph"))) return;
  const kind = event.key === "Enter" ? "enter" : event.key === " " ? "space" : event.key.length === 1 || event.key === "Backspace" || event.key === "Delete" || event.key === "Tab" ? "key" : null;
  if (!kind) return;
  context ??= new AudioContext({ latencyHint: "interactive" });
  if (!output) {
    output = context.createGain();
    output.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  if (made?.style !== style) made = { style, clips: make(context, style) };
  output.gain.value = Math.min(1, Math.max(0, volume)) * CEILING;
  const clips = made.clips;
  turn = (turn + 1) % clips.keys.length;
  const source = context.createBufferSource();
  source.buffer = kind === "key" ? clips.keys[turn] : clips[kind];
  // A little play in the pitch, as no two strikes are alike.
  if (kind === "key") source.playbackRate.value = 0.94 + Math.random() * 0.12;
  source.connect(output);
  source.start();
  // The audio device is let go a little after the typing stops.
  if (idleTimer) clearTimeout(idleTimer);
  const audio = context;
  idleTimer = setTimeout(() => {
    if (audio.state === "running") void audio.suspend();
  }, 4000);
}
