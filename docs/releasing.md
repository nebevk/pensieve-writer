# Releasing Pensieve

Installed copies of Pensieve update themselves from this repository's GitHub Releases. A few hours after a
release (or at once with Settings → General → Check for updates), Eva sees a quiet pill in the window bar:
"Nova različica 0.2.0 · Posodobi". One click saves her writing, downloads the update, installs it and
opens Pensieve again. Her projects (Documents\Pensieve) and settings stay where they are.

## Making a release

1. Make sure the work is committed and the app runs (`npm run check`, `npx vitest run`).
2. Build it, signed, with a higher version:

   ```
   npm run release -- 0.2.0 --notes "Files in the library, a Sunset theme."
   ```

   This sets the version in `src-tauri/tauri.conf.json`, `package.json`, `package-lock.json` and
   `src-tauri/Cargo.toml`, builds the installer, signs it, and puts three files in `release/v0.2.0/`:
   `Pensieve_0.2.0_x64-setup.exe`, its `.sig`, and `latest.json` (what installed copies read).
3. Commit and push the version change: `git commit -am "chore: release 0.2.0"` and `git push`.
4. Publish: open the link the script prints (a new release with the tag `v0.2.0`), attach the three files,
   write what changed, and publish it as a normal release (not a draft or a pre-release: installed copies
   only see the latest published one).

   With the GitHub CLI signed in (`gh auth login`), `npm run release -- 0.2.0 --notes "…" --publish` does
   step 4 itself once everything is committed and pushed.

A version must be higher than the one installed, or installed copies won't take it.

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

- `npm run tauri build` still builds an installer without the update files (no key needed). Only
  `npm run release` adds `--config src-tauri/tauri.release.conf.json`, which turns them on.
- The repository is public, so the installers on GitHub Releases can be downloaded by anyone. They hold the
  app only, none of Eva's writing.
- `npm run tauri dev` never looks for updates.
- A copy installed from a build made before 8 October 2026 has no updater: install a newer one by hand once.
