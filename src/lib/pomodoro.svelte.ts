/**
 * A pomodoro timer in the floating bar (owner, 8 October): 25 minutes of writing, a soft chime, 5
 * minutes of break, a chime again, and it rests. One timer for the whole window, so it keeps going
 * across views and Zen, and the time is worked out from the clock, so a busy moment doesn't slow it.
 */
export const FOCUS_MINUTES = 25;
export const BREAK_MINUTES = 5;

export type PomodoroPhase = "idle" | "focus" | "break";

export const pomodoro = $state<{ phase: PomodoroPhase; endsAt: number; pausedLeft: number; now: number }>({
  phase: "idle",
  endsAt: 0,
  // While paused, how long was left; 0 while it runs.
  pausedLeft: 0,
  now: Date.now(),
});

let ticker: ReturnType<typeof setInterval> | null = null;
let audio: AudioContext | null = null;
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

function run(phase: Exclude<PomodoroPhase, "idle">, minutes: number) {
  pomodoro.phase = phase;
  pomodoro.now = Date.now();
  pomodoro.endsAt = pomodoro.now + minutes * 60_000;
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
      run("break", BREAK_MINUTES);
      onTurn?.("break");
    } else {
      stopPomodoro();
      onTurn?.("idle");
    }
  }, 1000);
}

export function startPomodoro() {
  // Made here, in her click, so the window lets it sound later.
  audio ??= new AudioContext({ latencyHint: "playback" });
  void audio.resume().catch(() => undefined);
  run("focus", FOCUS_MINUTES);
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

/** Two soft notes, well under the ambience's ceiling, then the audio device is let go. */
function chime() {
  if (!audio) return;
  const context = audio;
  void context.resume().catch(() => undefined);
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
  setTimeout(() => {
    if (context.state === "running") void context.suspend();
  }, 2200);
}
