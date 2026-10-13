# Browser checks

Checks that use Pensieve as Eva does: they open the built app in headless Edge, click, type and look,
and say what passed. Each `*-check.mjs` checks one feature (find, Home, the library, Zen, notes, ideas…)
and ends with `ALL PASSED` or `N FAILED`.

```
npm run test:browser                  every check but the speed ones (about 45 minutes)
npm run test:browser -- find home     only the checks whose names have these words
npm run test:browser -- --speed       the speed checks too: typing timed with the processor slowed four times
npm run test:browser -- --no-build    the build already in build/, as it is
```

`run.mjs` builds the app, serves `build/` on a free port, starts its own headless Edge on another, runs
the checks one after another and stops both. Screenshots some checks take land in `shots/` (not kept in git).

## How they work

- `fake-tauri.js` stands in for the desktop window: the SQL plugin answers from [sql.js](https://sql.js.org)
  (one in-memory database per project file, kept between page loads when a check asks), and the app's own
  commands (folders, files, dialogs, the library) work on a pretend disk. The real window, Windows, Word,
  updates and Google Drive are not reached; see "Check by hand on the laptop" in `docs/backlog.md`.
- `cdp.mjs` drives Edge through its debugging port: `connect()`, `page.harness()` (loads the stand-in into
  every page), `page.open()`, `page.run()` (JavaScript in the page), `page.click()`, `page.type()`,
  `page.key()`, `page.shoot()`. Errors on the page are collected in `page.problems`.
- `serve.mjs` serves a build as the window would load it; `tree-unfold.mjs` opens the library's tree.
- `fixtures/` has a Word file and the long test book as an older Pensieve saved it.

## A new check

Copy one close to it (say `find-check.mjs`): take the port from `process.argv[2]`, call `check(name, ok,
detail)` for each thing, end with `page.problems.length === 0` and the `ALL PASSED` / `N FAILED` line. Run it
alone with `npm run test:browser -- its-name`.
