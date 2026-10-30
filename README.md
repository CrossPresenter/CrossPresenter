# CrossPresenter

A cross-platform presentation application built with Tauri (Rust) and React/TypeScript. It displays lyrics, scripture, media, and other content on one or more external/projector displays while you control everything from your main screen.

> Website: [https://crosspresenter.vercel.app](https://crosspresenter.vercel.app)

## Download

Grab the latest installer from the [Releases](https://github.com/CrossPresenter/CrossPresenter/releases) page.

## Features

- Present lyrics, Bible passages, and media to one or more external displays
- Song bank with multilingual search (fuzzy match across any script, including Tamil)
- Bible viewer (NASB / Tamil) with book/chapter navigation
- Image & video backgrounds with loop / ping-pong playback
- Camera input (built-in, USB, or phone camera over the local network)
- Media resizing panels, custom themes, and typography controls
- Recording and NDI output support

## Project Structure

The app is maintained as three independent, platform-specific Tauri project trees rather than one shared codebase, since native integrations (starting with NDI output) are expected to diverge per platform:

- `CrossPresenter-Windows_11/` — Windows build (produces `.msi` / NSIS installers)
- `CrossPresenter-MacOS/` — macOS build (produces `.dmg` / `.app`)
- `Crosspresenter-Linux/` — Linux build (produces AppImage / `.deb`)
- `website/` — the marketing/download website (deployed to Vercel)

Each platform folder is a self-contained Tauri v2 project: `src/` (React UI) + `src-tauri/` (Rust backend — archive/.cpshow engine, song importers, PPTX parsing, Bible module, monitor handling).

## Getting Started

Run these inside the platform folder matching your OS, e.g. `CrossPresenter-Windows_11/`:

```bash
# Install dependencies
npm install

# Run in development
npm run start

# Type-check
npm run build
```

## Build

```bash
# Build the platform installer (writes to src-tauri/target/release/bundle/)
npm run bundle
```

CI (`.github/workflows/build.yml`) builds all three platforms on their native GitHub Actions runners on every push to `main`.

## Releasing an update

Windows releases are built on the operator's laptop (a release build with LTO is the slow part, and CI would only add queue time). From `CrossPresenter-Windows_11/`:

```bash
npm run release                              # patch bump, e.g. 1.0.0 → 1.0.1
npm run release -- --bump minor              # or major
npm run release -- --version 1.2.0 --notes "Fixed song search"
```

The script bumps the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src/lib/defaults.ts`, builds a **signed** NSIS installer + MSI, commits and pushes the version bump, then publishes a GitHub Release containing the installer, its `.sig` file and `latest.json`.

Signing is required for the in-app updater. The private key is kept outside the repo at `%USERPROFILE%\.tauri\crosspresenter.key` (password in `crosspresenter.password`, or set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). Only the public key lives in `tauri.conf.json`.

Installed apps check `https://github.com/CrossPresenter/CrossPresenter/releases/latest/download/latest.json` at launch and every four hours. When a newer version is published, the operator sees an in-app prompt with the release notes, then downloads (with a progress bar) and installs passively before the app restarts. Settings → **Check for updates** runs the same check on demand; **Later** hides that version until the next explicit check.

> Pushing to `main` runs the cross-platform CI build for verification. It does not publish a release — only `npm run release` does.
