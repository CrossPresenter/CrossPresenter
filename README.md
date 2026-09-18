# CrossPresenter

A cross-platform presentation application built with Tauri (Rust) and React/TypeScript. It displays lyrics, scripture, media, and other content on one or more external/projector displays while you control everything from your main screen.

> Website: [https://crosspresenter.vercel.app](https://crosspresenter.vercel.app)

## Download

Grab the latest installer from the [Releases](https://github.com/CrossPresenter/CrossPresenter/releases) page.

## Features

- Present lyrics, Bible passages, and media to one or more external displays
- Song bank with search (supports Tamil + English fuzzy match)
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
