# Browser checks

Checks that use Pensieve as Eva does: they open the built app in headless Edge, click, type and look,
and say what passed. Each `*-check.mjs` checks one feature (find, Home, the library, Zen, notes, ideas…)
and ends with `ALL PASSED` or `N FAILED`.

```
npm run test:browser                  every check but the speed ones (about 45 minutes)
npm run test:browser -- find home     only the checks whose names have these words
npm run test:browser -- --speed       the speed checks too: typing timed with the processor slowed four times
npm run test:browser -- --no-build    the build already in build/, as it is
npm run test:browser -- --hushed      Hushed Tales' own checks (*-hushed-check.mjs), against its build in build-hushed/
npm run test:browser -- --verbose     every line a check says, the passing ones too (their times, say)
```

`run.mjs` builds the app, serves `build/` on a free port, starts its own headless Edge on another, runs
the checks one after another and stops both. Screenshots some checks take land in `shots/` (not kept in git).

## Timing typing

`typing-speed-check.mjs` types as Eva does (ARCH-11): in the long test book, on sheets, with comments
beside the text, at 1366 × 768 with the processor slowed four times, in bursts with pauses of a third of a
second to two and a half. Each key is timed from the moment it is pressed until the page shows its letter, by the
browser's Event Timing, against the 40 ms of the speed requirement. With `--verbose` it says how the keys
went (in a burst, first after a pause, meeting a save), the slowest of them, and the app's code in the frames
over 50 ms. Every key's times are left in `shots/typing-speed.json`.

For a sense of scale: a bare editable box, on an empty page, shows a key in 16 ms there. The browser rounds
its times to 8 ms, so they come as 40, 48, 56…, and two runs differ by about 8 ms: to compare two ways of
doing a thing, switch between them within one run rather than between runs.

The checks' Edge draws without the GPU. Typing at the very end of a long chapter on sheets, it shows the frames
seconds late although the page is idle; with the GPU on it doesn't, so it is the software drawing, not
Pensieve. The typing check types in the middle of a chapter.

## How they work

- `fake-tauri.js` stands in for the desktop window: the SQL plugin answers from [sql.js](https://sql.js.org)
  (one in-memory database per project file, kept between page loads when a check asks), and the app's own
  commands (folders, files, dialogs, the library) work on a pretend disk. The real window, Windows, Word,
  updates and Google Drive are not reached; see "Check by hand on the laptop" in `docs/backlog.md`. For
  the speed checks, `page.harness({ worker: true })` runs sql.js in a worker, as the real database runs in
  Rust, so a save doesn't count its SQL against the page; books aren't kept between page loads then, and a
  check reads them through the SQL plugin, not `books`.
- `cdp.mjs` drives Edge through its debugging port: `connect()`, `page.harness()` (loads the stand-in into
  every page), `page.open()`, `page.run()` (JavaScript in the page), `page.click()`, `page.type()`,
  `page.key()`, `page.shoot()`. Errors on the page are collected in `page.problems`.
- `serve.mjs` serves a build as the window would load it, with the window's content security policy from
  `tauri.conf.json`; anything it refuses is an error on the page, so the check fails. `tree-unfold.mjs` opens
  the library's tree.
- `fixtures/` has a Word file and the long test book as an older Pensieve saved it.

## A new check

Copy one close to it (say `find-check.mjs`): take the port from `process.argv[2]`, call `check(name, ok,
detail)` for each thing, end with `page.problems.length === 0` and the `ALL PASSED` / `N FAILED` line. Run it
alone with `npm run test:browser -- its-name`.
