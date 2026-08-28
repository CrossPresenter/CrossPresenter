# CrossPresenter

A cross-platform presentation application built with Electron, React (Vite), and TypeScript. It displays lyrics, scripture, media, and other content on one or more external/projector displays while you control everything from your main screen.

> Website: [https://crosspresenter.vercel.app](https://crosspresenter.vercel.app)

## Download

Grab the latest installer from the [Releases](https://github.com/CrossPresenter/CrossPresenter/releases) page.

- **Windows installer**: `CrossPresenter Setup 0.0.1.exe`

## Features

- Present lyrics, Bible passages, and media to one or more external displays
- Song bank with search (supports Tamil + English fuzzy match)
- Bible viewer (NASB / Tamil) with book/chapter navigation
- Image & video backgrounds with loop / ping-pong playback
- Camera input (built-in, USB, or phone camera over the local network)
- Media resizing panels, custom themes, and typography controls
- Recording and NDI output support

## Getting Started

```bash
# Install dependencies
npm install

# Run in development (Vite + Electron)
npm run electron:dev

# Type-check / lint
npm run typecheck
npm run lint
```

## Build

```bash
# Build the renderer bundle
npm run build

# Build the Windows installer (writes to dist_electron/)
npm run build:exe
```

## Project Structure

- `src/` — React renderer (app UI)
- `electron/` — Electron main process & preload
- `public/` — static assets (Bible data, splash)
- `website/` — the marketing/download website (deployed to Vercel)
