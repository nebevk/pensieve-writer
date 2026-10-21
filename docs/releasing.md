# Releasing Pensieve

Installed copies of Pensieve update themselves from this repository's GitHub Releases. A few hours after a
release (or at once with Settings → General → Check for updates), Eva sees a quiet pill in the window bar:
"Nova različica 0.2.0 · Posodobi". One click saves her writing, downloads the update, installs it and
opens Pensieve again. Her projects (Documents\Pensieve) and settings stay where they are.

## Making a release

Once, on the computer that builds, install the GitHub CLI and sign in to GitHub with it (it asks a few
questions: GitHub.com, HTTPS, and to log in with a web browser):

```
winget install --id GitHub.cli
gh auth login
```

Then a release is one command, with a higher version and a line for the update's notes:

```
npm run release -- 0.5.0 --notes "Word's alignment keys, and Word documents brought in where they act." --publish
```

It asks first what could stop it halfway, before the long build: the GitHub CLI signed in, everything
committed, the version new, the type check and the tests (the browser checks take too long, so run them
before: `npm run test:browser`). Then it:

1. sets the version in `src-tauri/tauri.conf.json`, `package.json`, `package-lock.json` and
   `src-tauri/Cargo.toml`;
2. builds the installer, signs it, and puts three files in `release/v0.5.0/`: `Pensieve_0.5.0_x64-setup.exe`,
   its `.sig`, and `latest.json` (what installed copies read, with the `--notes` line);
3. commits the version change alone ("chore: release 0.5.0"), tags it `v0.5.0`, and pushes both;
4. publishes the GitHub release with the three files, as the latest (installed copies only see the latest
   published one). Its text is `release/v0.5.0/notes.md` when that was written before, else the `--notes`
   line;
5. moves `master` up to the release, only ever forward.

A version already built and tagged but not published (one stopped halfway, say) is published as it is with
`npm run release -- 0.5.0 --publish`.

Without `--publish` the script builds and signs only, and prints how to commit, tag and publish by hand: open
the link it prints, attach the three files, write what changed, and publish it as a normal release.

A version must be higher than the one installed, or installed copies won't take it.

## Hushed Tales

Hushed Tales, the version for the owner's friends (IMP-29), is the same code built under its own name, with its own
identifier, and quotes about writing on Home instead of the Bible verses (`VITE_EDITION=hushed`,
`src-tauri/tauri.hushed.conf.json`). It is released from a Pensieve release, so friends have what Eva has:

```
git checkout v0.5.6
npm run release -- --edition hushed --notes "…" --publish
```

It builds the Pensieve release checked out (its tag at HEAD, nothing changed) as Hushed Tales, signs it with the same
key, and publishes the installer (`HushedTales_<version>_x64-setup.exe`, without the space GitHub would make a dot),
its `.sig` and `latest.json` in the repository `nebevk/hushed-tales`, which its installed copies read for updates.
Nothing is committed or tagged here, and master stays where it is. `release/hushed/v<version>/notes.md`, written
before, becomes the release's text. Without `--publish` it builds and signs only.

## The signing key

Every update is signed, and Pensieve installs only updates signed with this key. It lives outside the
repository, on the owner's computer:

- `C:\Users\Nejc\.tauri\pensieve.key`: the private key. Never commit it or share it.
- `C:\Users\Nejc\.tauri\pensieve.key.password`: its password.
- `C:\Users\Nejc\.tauri\pensieve.key.pub`: the public key, also in `tauri.conf.json` (`plugins.updater.pubkey`).

Keep a copy of the key and its password somewhere safe (a password manager, say). If they are lost, no
installed copy can be updated any more: Eva would install the next version by hand once, from an installer
built with a new key.

## Notes

- This is the only way releases are made: on the owner's computer, where the key is. GitHub builds none: a
  workflow that built one for each pushed version tag was removed on 12 October, as it would have needed
  the key on GitHub. `--publish` only uploads what was built here. GitHub's CI only checks
  each push to `master` (type check, tests, `cargo check`).
- `npm run tauri build` still builds an installer without the update files (no key needed). Only
  `npm run release` adds `--config src-tauri/tauri.release.conf.json`, which turns them on.
- The repository is public, so the installers on GitHub Releases can be downloaded by anyone. They hold the
  app only, none of Eva's writing.
- `npm run tauri dev` never looks for updates.
- A copy installed from a build made before 8 October 2026 has no updater: install a newer one by hand once.
