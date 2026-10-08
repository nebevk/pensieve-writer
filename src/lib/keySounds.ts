/**
 * Keys that sound as they are typed on the page (owner, 8 October): a typewriter, a mechanical keyboard
 * or a soft one, from recordings the owner chose (static/keys/CREDITS.txt); off to start with (Settings →
 * Ambience). Each style is one small file of its keys back to back, with clips.json saying where each
 * key's sound is, so every key on a keyboard sounds like itself. It is loaded once, as soon as a sound is
 * chosen; after that a key only starts a slice of it, a few microseconds of work, so typing never waits.
 */
export type KeySoundStyle = "off" | "typewriter" | "mechanical" | "soft";

type Slice = [start: number, length: number];
type Listing = { sprite: string; keys: Record<string, Slice>; space: Slice; enter: Slice; backspace: Slice };
type Sounds = { buffer: AudioBuffer; listing: Listing; letters: Slice[] };

// The slider shows 0 to 100; its 100 plays at half, as the ambience does.
const CEILING = 0.5;

// A key's place on the keyboard, as the recordings' maps number them (the PC's scan codes), from the
// browser's name for that place: the same on a Slovenian keyboard, where č, š and ž sit on ;, [ and \.
const SCAN: Record<string, number> = {
  Backquote: 41, Minus: 12, Equal: 13, Tab: 15, BracketLeft: 26, BracketRight: 27, Semicolon: 39, Quote: 40,
  Backslash: 43, IntlBackslash: 86, Comma: 51, Period: 52, Slash: 53,
};
"1234567890".split("").forEach((digit, index) => (SCAN[`Digit${digit}`] = index + 2));
"QWERTYUIOP".split("").forEach((letter, index) => (SCAN[`Key${letter}`] = index + 16));
"ASDFGHJKL".split("").forEach((letter, index) => (SCAN[`Key${letter}`] = index + 30));
"ZXCVBNM".split("").forEach((letter, index) => (SCAN[`Key${letter}`] = index + 44));

let context: AudioContext | null = null;
let output: GainNode | null = null;
let ready: { style: Exclude<KeySoundStyle, "off">; sounds: Sounds | null } | null = null;
let loading: { style: Exclude<KeySoundStyle, "off">; done: Promise<void> } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let turn = 0;

function audio(): AudioContext {
  // Made before her first key, it waits (the window's autoplay rule) and sounds from that key on.
  context ??= new AudioContext({ latencyHint: "interactive" });
  if (!output) {
    output = context.createGain();
    output.connect(context.destination);
  }
  return context;
}

async function load(target: AudioContext, style: Exclude<KeySoundStyle, "off">): Promise<Sounds | null> {
  try {
    const listing = (await (await fetch(`/keys/${style}/clips.json`)).json()) as Listing;
    const response = await fetch(`/keys/${style}/${listing.sprite}`);
    if (!response.ok) return null;
    const buffer = await target.decodeAudioData(await response.arrayBuffer());
    return { buffer, listing, letters: Object.values(listing.keys) };
  } catch {
    return null;
  }
}

/** Gets a style's sounds ready, so the first key already sounds. */
export function prepareKeySounds(style: KeySoundStyle): Promise<void> {
  if (style === "off" || ready?.style === style) return Promise.resolve();
  if (loading?.style === style) return loading.done;
  const target = audio();
  const done = load(target, style).then((sounds) => {
    ready = { style, sounds };
  });
  loading = { style, done };
  return done;
}

/** The sound for a key pressed on the page; nothing for the keys that don't write (arrows, Ctrl+…). */
export function keySound(event: KeyboardEvent, style: KeySoundStyle, volume: number) {
  if (style === "off" || event.repeat || event.ctrlKey || event.metaKey || (event.altKey && !event.getModifierState("AltGraph"))) return;
  const kind = event.key === "Enter" ? "enter" : event.key === " " ? "space" : event.key === "Backspace" || event.key === "Delete" ? "backspace" : event.key.length === 1 || event.key === "Tab" ? "key" : null;
  if (!kind) return;
  const target = audio();
  if (target.state === "suspended") void target.resume().catch(() => undefined);
  // Not ready yet (the first key after choosing): this one stays quiet, the next ones sound.
  if (ready?.style !== style) {
    void prepareKeySounds(style);
    return;
  }
  const sounds = ready.sounds;
  if (!sounds) return;
  const { listing } = sounds;
  let slice: Slice;
  if (kind !== "key") slice = listing[kind];
  else {
    // The key's own sound, or (the typewriter, or a key the keyboard didn't record) one of its letters.
    const own = listing.keys[String(SCAN[event.code])];
    turn = (turn + 1) % sounds.letters.length;
    slice = own ?? listing.keys["*"] ?? sounds.letters[turn];
  }
  if (output) output.gain.value = Math.min(1, Math.max(0, volume)) * CEILING;
  const source = target.createBufferSource();
  source.buffer = sounds.buffer;
  // A typewriter has one key sound; a touch of play in its pitch keeps a run of them from sounding alike.
  if (kind === "key" && sounds.letters.length === 1) source.playbackRate.value = 0.96 + Math.random() * 0.08;
  source.connect(output ?? target.destination);
  source.start(0, slice[0], slice[1]);
  // The audio device is let go a little after the typing stops.
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (target.state === "running") void target.suspend();
  }, 4000);
}
