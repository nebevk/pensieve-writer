/**
 * A pomodoro timer in the floating bar (owner, 8 October): writing for a while (25 minutes to start
 * with; Settings → Writing & goals), a soft chime, a break (5 minutes), a chime again, and it rests. It
 * ticks for a moment as it starts, as a kitchen timer does. One timer for the whole window, so it keeps
 * going across views and Zen, and the time is worked out from the clock, so a busy moment doesn't slow it.
 */
export type PomodoroPhase = "idle" | "focus" | "break";

export const pomodoro = $state<{
  phase: PomodoroPhase;
  endsAt: number;
  pausedLeft: number;
  now: number;
  focus: number;
  rest: number;
}>({
  phase: "idle",
  endsAt: 0,
  // While paused, how long was left; 0 while it runs.
  pausedLeft: 0,
  now: Date.now(),
  // This round's minutes of writing and of break, as set when it started.
  focus: 25,
  rest: 5,
});

let ticker: ReturnType<typeof setInterval> | null = null;
let audio: AudioContext | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let onTurn: ((phase: PomodoroPhase) => void) | null = null;

/** What the page does when writing turns to a break, or a break ends (a notice, say). */
export function onPomodoroTurn(listener: (phase: PomodoroPhase) => void) {
  onTurn = listener;
}

/** Milliseconds left in this phase. */
export function pomodoroLeft(): number {
  if (pomodoro.phase === "idle") return 0;
  if (pomodoro.pausedLeft) return pomodoro.pausedLeft;
  return Math.max(0, pomodoro.endsAt - pomodoro.now);
}

/** "24:59" */
export function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function run(phase: Exclude<PomodoroPhase, "idle">) {
  pomodoro.phase = phase;
  pomodoro.now = Date.now();
  pomodoro.endsAt = pomodoro.now + (phase === "focus" ? pomodoro.focus : pomodoro.rest) * 60_000;
  pomodoro.pausedLeft = 0;
  tick();
}

function tick() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    pomodoro.now = Date.now();
    if (pomodoro.phase === "idle" || pomodoro.pausedLeft || pomodoro.now < pomodoro.endsAt) return;
    chime();
    if (pomodoro.phase === "focus") {
      run("break");
      onTurn?.("break");
    } else {
      stopPomodoro();
      onTurn?.("idle");
    }
  }, 1000);
}

/** Writing for `focus` minutes, then a break of `rest`. */
export function startPomodoro(focus: number, rest: number) {
  // Made here, in her click, so the window lets it sound later.
  audio ??= new AudioContext({ latencyHint: "playback" });
  pomodoro.focus = focus;
  pomodoro.rest = rest;
  windUp();
  run("focus");
}

/** This phase again from its start: the writing time or the break, full length. */
export function resetPomodoro() {
  if (pomodoro.phase === "idle") return;
  if (pomodoro.phase === "focus") windUp();
  run(pomodoro.phase);
}

export function pausePomodoro() {
  if (pomodoro.phase === "idle" || pomodoro.pausedLeft) return;
  pomodoro.pausedLeft = Math.max(1000, pomodoro.endsAt - Date.now());
}

export function resumePomodoro() {
  if (!pomodoro.pausedLeft) return;
  pomodoro.now = Date.now();
  pomodoro.endsAt = pomodoro.now + pomodoro.pausedLeft;
  pomodoro.pausedLeft = 0;
}

export function stopPomodoro() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  pomodoro.phase = "idle";
  pomodoro.pausedLeft = 0;
}

/** The audio device, woken for a sound and let go a moment after it, as the ambience does. */
function sounding(seconds: number): AudioContext | null {
  if (!audio) return null;
  const context = audio;
  void context.resume().catch(() => undefined);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (context.state === "running") void context.suspend();
  }, (seconds + 0.8) * 1000);
  return context;
}

/** A clock's tick-tock for a couple of seconds, quiet, as the writing time begins. */
function windUp() {
  const context = sounding(2.6);
  if (!context) return;
  const start = context.currentTime + 0.05;
  for (let beat = 0; beat < 6; beat += 1) {
    const at = start + beat * 0.42;
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.type = "triangle";
    // Tick, tock: the second a little lower.
    tone.frequency.value = beat % 2 === 0 ? 2100 : 1600;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.07, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    tone.connect(gain);
    gain.connect(context.destination);
    tone.start(at);
    tone.stop(at + 0.06);
  }
}

/** Two soft notes, well under the ambience's ceiling. */
function chime() {
  const context = sounding(1.9);
  if (!context) return;
  const start = context.currentTime + 0.05;
  [659.25, 880].forEach((frequency, index) => {
    const tone = context.createOscillator();
    const gain = context.createGain();
    const at = start + index * 0.32;
    tone.type = "sine";
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.08, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    tone.connect(gain);
    gain.connect(context.destination);
    tone.start(at);
    tone.stop(at + 1.5);
  });
}
