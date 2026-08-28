import { app, BrowserWindow, screen, ipcMain, dialog, session, desktopCapturer, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let db = null;
let bibleIndex = {}; // "Book": { chapter: { verse: text } }, loaded once for fast synchronous reads

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges",
  "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes",
  "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
  "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

// Bundled NASB seed file. In dev Vite serves it from public/, in the packaged
// app it is copied into dist/. Reading via fs (not fetch) works on file://.
const NASB_TXT_DEV = path.join(__dirname, '../public/bibles/nasb_txt.txt');
const NASB_TXT_PROD = path.join(__dirname, '../dist/bibles/nasb_txt.txt');

function findNasbTxt() {
  try { if (fs.existsSync(NASB_TXT_PROD)) return NASB_TXT_PROD; } catch {}
  try { if (fs.existsSync(NASB_TXT_DEV)) return NASB_TXT_DEV; } catch {}
  return null;
}

function parseNasbTxt(content) {
  const index = {};
  const blocks = content.split(/\r?\n\.\r?\n/);
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].trim();
    if (!text) continue;
    const m = text.match(/(.*?)\s+--\s+(.+?)\s+(\d+):(\d+)$/s);
    if (!m) continue;
    const chapter = parseInt(m[3], 10);
    const verse = parseInt(m[4], 10);
    if (!chapter || !verse) continue;
    const canon = BIBLE_BOOKS.find(b => b.toLowerCase() === m[2].trim().toLowerCase());
    if (!canon) continue;
    if (!index[canon]) index[canon] = {};
    if (!index[canon][chapter]) index[canon][chapter] = {};
    index[canon][chapter][verse] = m[1].trim();
  }
  return index;
}

function rowsToIndex(rows) {
  const index = {};
  rows.forEach(r => {
    if (!index[r.book]) index[r.book] = {};
    if (!index[r.book][r.chapter]) index[r.book][r.chapter] = {};
    index[r.book][r.chapter][r.verse] = r.text;
  });
  return index;
}

function loadNasbIndex() {
  db.all('SELECT book, chapter, verse, text FROM verses', (err, rows) => {
    if (!err && rows && rows.length > 0) {
      bibleIndex = rowsToIndex(rows);
      return;
    }
    // Nothing seeded yet: ship the bundled text file into memory + db.
    const file = findNasbTxt();
    if (!file) return;
    try {
      const index = parseNasbTxt(fs.readFileSync(file, 'utf-8'));
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR IGNORE INTO verses (book, chapter, verse, text) VALUES (?, ?, ?, ?)');
        Object.keys(index).forEach(book => {
          Object.keys(index[book]).forEach(ch => {
            Object.keys(index[book][ch]).forEach(v => {
              stmt.run(book, Number(ch), Number(v), index[book][ch][v]);
            });
          });
        });
        stmt.finalize();
        db.run('COMMIT', () => {});
      });
      bibleIndex = index;
      console.log(`Seeded NASB into bibles.db (${Object.keys(index).length} books)`);
    } catch (e) {
      console.error('Failed to seed bundled NASB:', e);
    }
  });
}

function loadMyBibleIndex() {
  db.all('SELECT Book, Chapter, Verse, Scripture FROM Bible', (err, rows) => {
    if (err || !rows) return;
    const index = {};
    rows.forEach(r => {
      const book = BIBLE_BOOKS[r.Book - 1];
      if (!book) return;
      if (!index[book]) index[book] = {};
      if (!index[book][r.Chapter]) index[book][r.Chapter] = {};
      index[book][r.Chapter][r.Verse] = r.Scripture;
    });
    bibleIndex = index;
  });
}

function initDB() {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'bibles.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Failed to open SQLite db:", err);
      } else {
        // Detect if this is a MyBible schema
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Bible'", (e, row) => {
          if (row) {
            loadMyBibleIndex();
          } else {
            // Basic table schema for custom sqlite
            db.run(`CREATE TABLE IF NOT EXISTS verses (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              book TEXT,
              chapter INTEGER,
              verse INTEGER,
              text TEXT
            )`, () => loadNasbIndex());
          }
        });
      }
    });
  } catch(e) {
    console.error("Failed to init SQLite:", e);
  }
}


let mainWindow;
let presenterWindows = new Map(); // displayId -> BrowserWindow
let isQuitting = false;
let syncMasterWebContentsId = null;
let cursorWatchInterval = null;
let cursorWarpProc = null; // persistent PowerShell helper that warps the OS cursor

// ---- Cursor confinement (Windows) ----
// Electron 43 exposes no native cursor-clip/warp API, so we use screen coordinates
// plus a tiny persistent PowerShell shim that calls user32 SetCursorPos. While any
// presenter/output window is open we poll the cursor and, the moment it crosses off
// the main (control) display onto an external/projector display, we teleport it back
// to a point just inside the laptop display. Works regardless of window focus.

function powershellWarpScript() {
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    'Add-Type -AssemblyName System.Windows.Forms',
    'while ($line = [Console]::In.ReadLine()) {',
    '  $p = $line -split ","',
    '  if ($p.Length -ge 2) {',
    '    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]$p[0],[int]$p[1])',
    '  }',
    '}'
  ].join('\n');
}

function ensureWarpProc() {
  if (cursorWarpProc && !cursorWarpProc.killed) return cursorWarpProc;
  const warpScriptPath = path.join(app.getPath('temp'), 'crosspresenter-cursor-warp.ps1');
  try {
    fs.writeFileSync(warpScriptPath, powershellWarpScript(), 'utf-8');
  } catch (e) {
    // ignore
  }
  const { spawn } = require('child_process');
  cursorWarpProc = spawn('powershell', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', warpScriptPath
  ], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
  return cursorWarpProc;
}

function stopWarpProc() {
  if (cursorWarpProc && !cursorWarpProc.killed) {
    try { cursorWarpProc.stdin.end(); } catch { /* ignore */ }
    try { cursorWarpProc.kill(); } catch { /* ignore */ }
  }
  cursorWarpProc = null;
}

// Returns the display the control window lives on (the laptop), or null.
function mainDisplay() {
  try {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return null;
    return screen.getDisplayMatching(mainWindow.getBounds());
  } catch (e) {
    return null;
  }
}

function updateMouseCapture() {
  const active = presenterWindows.size > 0 && !!mainDisplay();

  if (active) {
    if (!cursorWatchInterval && !isQuitting) {
      const proc = ensureWarpProc();
      let lastX = null;
      let lastY = null;
      cursorWatchInterval = setInterval(() => {
        try {
          const home = mainDisplay();
          if (!home) return;
          const pt = screen.getCursorScreenPoint();
          if (pt.x === lastX && pt.y === lastY) return; // no movement
          lastX = pt.x; lastY = pt.y;
          const disp = screen.getDisplayNearestPoint(pt);
          if (disp && disp.id !== home.id) {
            // Warp to a point just inside the home display's work area edge.
            const w = home.workArea;
            const cx = Math.min(Math.max(pt.x, w.x + 1), w.x + w.width - 2);
            const cy = Math.min(Math.max(pt.y, w.y + 1), w.y + w.height - 2);
            if (proc && !proc.killed && proc.stdin && proc.stdin.writable) {
              proc.stdin.write(`${Math.round(cx)},${Math.round(cy)}\n`);
            }
          }
        } catch (e) {
          // ignore transient errors
        }
      }, 25);
    }
  } else if (cursorWatchInterval) {
    clearInterval(cursorWatchInterval);
    cursorWatchInterval = null;
    stopWarpProc();
  }
}

// Disable Chrome's strict autoplay policy so presenter windows can play videos programmatically
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---- Window state persistence ----
function windowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const file = windowStateFile();
    if (!fs.existsSync(file)) return null;
    const state = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (typeof state.width !== 'number' || typeof state.height !== 'number') return null;
    return state;
  } catch (e) {
    console.error('Failed to load window state:', e);
    return null;
  }
}

function isVisibleOnScreen(bounds) {
  return screen.getAllDisplays().some(d => {
    const w = d.workArea;
    return bounds.x < w.x + w.width && bounds.x + bounds.width > w.x &&
           bounds.y < w.y + w.height && bounds.y + bounds.height > w.y;
  });
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized()
    };
    fs.writeFileSync(windowStateFile(), JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function updateSyncMaster() {
  // Keep the cursor confined to the main (control) window while presenting.
  updateMouseCapture();

  let masterId = null;
  if (presenterWindows.size > 0) {
    const firstWin = presenterWindows.values().next().value;
    if (firstWin && !firstWin.isDestroyed()) {
      masterId = firstWin.webContents.id;
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    masterId = mainWindow.webContents.id;
  }

  if (syncMasterWebContentsId !== masterId) {
    syncMasterWebContentsId = masterId;
    
    // Broadcast the updated role to all windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-role-changed', mainWindow.webContents.id === syncMasterWebContentsId);
    }
    presenterWindows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('sync-role-changed', win.webContents.id === syncMasterWebContentsId);
      }
    });
  }
}


function sendDisplays() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const primaryDisplayId = screen.getPrimaryDisplay().id;
    const displays = screen.getAllDisplays()
      .filter(d => d.id !== primaryDisplayId)
      .map((d, index) => ({
        id: d.id,
        label: d.label || `External Monitor ${index + 1}`,
        bounds: d.bounds
      }));
    mainWindow.webContents.send('displays-changed', displays);
  }
}

function lockShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (!input || input.type !== 'keyDown') return;
    const k = String(input.key || '').toLowerCase();
    const ctrl = !!(input.control || input.meta);
    const shift = !!input.shift;
    const alt = !!input.alt;

    // New app reload shortcut: Ctrl+Shift+Alt+R
    if (ctrl && shift && alt && k === 'r') {
      event.preventDefault();
      win.webContents.reload();
      return;
    }

    // Block the rest: reload (Ctrl+R / F5 / Ctrl+Shift+R), devtools (F12 /
    // Ctrl+Shift+I/J), view source, print, open, save, new tab/window,
    // close tab/window.
    const blockedReload = k === 'f5' || (ctrl && !alt && k === 'r');
    const blockedDevtools = k === 'f12' || (ctrl && shift && (k === 'i' || k === 'j'));
    const blockedMenu = ctrl && ((k === 'u' && shift) || ['p', 'o', 's', 'n', 't', 'w', 'f', 'a'].includes(k));
    if (blockedReload || blockedDevtools || blockedMenu) {
      event.preventDefault();
    }
  });
}

function createWindows() {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  // Associate the app with its own taskbar icon (Windows uses the large 256px
  // frame from icon.ico instead of a generic/default icon).
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.crosspresenter.app');
  }

  // 1. Create the Splash Screen Window (only on the primary monitor; nothing is
  // shown on additional displays/projectors).
  const primaryDisplay = screen.getPrimaryDisplay();
  const splashWindows = (() => {
    const { workArea } = primaryDisplay;
    const splashWidth = Math.round(workArea.width * 0.6);
    const splashHeight = Math.round(workArea.height * 0.6);
    const win = new BrowserWindow({
      width: splashWidth,
      height: splashHeight,
      x: workArea.x + Math.round((workArea.width - splashWidth) / 2),
      y: workArea.y + Math.round((workArea.height - splashHeight) / 2),
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      icon: path.join(__dirname, '..', 'build', 'icon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        transparent: true
      }
    });

    // Only reveal the splash once its content has painted, so no white/blank
    // flash is seen before the logo appears.
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) win.show();
    });

    if (isDev) {
      // Vite serves public files at the root URL
      win.loadURL('http://localhost:5173/splash.html');
    } else {
      win.loadFile(path.join(__dirname, '../dist/splash.html'));
    }
    return [win];
  })();

  // 2. Create Main Window (Hidden)
  const savedState = loadWindowState();
  const winBounds = savedState && isVisibleOnScreen(savedState)
    ? { x: savedState.x, y: savedState.y, width: savedState.width, height: savedState.height }
    : { width: 1200, height: 800 };
  mainWindow = new BrowserWindow({
    ...winBounds,
    show: false, // Start hidden
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      sandbox: true,
      webviewTag: true
    }
  });

  // Spoof a standard Chrome User-Agent so sites don't flag the Electron runtime
  mainWindow.webContents.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  lockShortcuts(mainWindow);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/#/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/' });
  }

  // 3. Handoff logic
  mainWindow.once('ready-to-show', () => {
    // Guarantee minimum splash time (3 seconds) for the animation
    setTimeout(() => {
      for (const win of splashWindows) {
        if (!win.isDestroyed()) {
          win.close();
        }
      }
      if (!mainWindow.isDestroyed()) {
        mainWindow.show();
        // Always open the app at maximum size (fills the primary display work area).
        mainWindow.maximize();
        if (isDev) mainWindow.webContents.openDevTools();
        updateSyncMaster();
      }
    }, 3000);
  });

  mainWindow.on('close', (e) => {
    saveWindowState(mainWindow);
    if (!isQuitting) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'Do you really want to close CrossPresenter?'
      }).then(result => {
        if (result.response === 0) {
          // Tell the UI to show the shutdown animation
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('app-closing');
          }
        }
      });
    }
  });

  // Persist window size/position whenever it changes (debounced)
  let winStateTimer = null;
  const scheduleSaveWindowState = () => {
    if (winStateTimer) clearTimeout(winStateTimer);
    winStateTimer = setTimeout(() => saveWindowState(mainWindow), 300);
  };
  mainWindow.on('resize', scheduleSaveWindowState);
  mainWindow.on('move', scheduleSaveWindowState);
  mainWindow.on('maximize', scheduleSaveWindowState);
  mainWindow.on('unmaximize', scheduleSaveWindowState);

  // Start listening to screen changes
  screen.on('display-added', sendDisplays);
  screen.on('display-removed', sendDisplays);
  screen.on('display-metrics-changed', sendDisplays);
  
  mainWindow.webContents.on('did-finish-load', () => {
    sendDisplays();
  });
}

ipcMain.handle('get-displays', () => {
  const primaryDisplayId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays()
    .filter(d => d.id !== primaryDisplayId)
    .map((d, index) => ({
      id: d.id,
      label: d.label || `External Monitor ${index + 1}`,
      bounds: d.bounds
    }));
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.on('set-presenter-displays', (event, displayIds) => {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  
  // Close windows that are no longer selected
  for (const [id, win] of presenterWindows.entries()) {
    if (!displayIds.includes(id)) {
      if (!win.isDestroyed()) win.close();
      presenterWindows.delete(id);
    }
  }

  // Create windows for new selected displays
  const allDisplays = screen.getAllDisplays();
  displayIds.forEach(id => {
    if (!presenterWindows.has(id)) {
      const targetDisplay = allDisplays.find(d => d.id === id);
      if (targetDisplay) {
        const pWin = new BrowserWindow({
          x: targetDisplay.bounds.x,
          y: targetDisplay.bounds.y,
          width: targetDisplay.bounds.width,
          height: targetDisplay.bounds.height,
          fullscreen: true,
          frame: false,
          skipTaskbar: true,
          focusable: false, // Prevent focus stealing and cursor capturing
          title: 'CrossPresenter',
          webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            webviewTag: true,
            backgroundThrottling: false, // Keep rendering frames so the OS taskbar/peek preview captures the live canvas (not the desktop)
            paintWhenInvisible: true
          }
        });

        lockShortcuts(pWin);

        if (isDev) {
          pWin.loadURL('http://localhost:5173/#/presenter');
        } else {
          pWin.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/presenter' });
        }
        
        pWin.webContents.on('console-message', (event, level, message) => {
          console.log(`[Presenter Console] ${message}`);
        });

        pWin.webContents.on('did-finish-load', () => {
          if (lastPresenterState) {
            pWin.webContents.send('presenter-state-updated', lastPresenterState);
          }
        });
        
        pWin.on('closed', () => {
          presenterWindows.delete(id);
          updateSyncMaster();
        });

        presenterWindows.set(id, pWin);
      }
    }
  });

  updateSyncMaster();
});

ipcMain.on('update-presenter-state', (event, state) => {
  lastPresenterState = state;
  presenterWindows.forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('presenter-state-updated', state);
    }
  });
  if (ndiWindow && !ndiWindow.isDestroyed()) {
    ndiWindow.webContents.send('presenter-state-updated', state);
  }
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    recorderWindow.webContents.send('presenter-state-updated', state);
  }
});

// NDI Output: a hidden offscreen window renders the presenter route and the main
// process streams its pixels over NDI. The old renderer desktop-capture approach
// produced no frames on single-monitor setups and on self-capture, so this is done
// entirely in the main process via offscreen rendering + paint events.
let ndiSender = null;
let ndiWindow = null;
let ndiCaptureActive = false;
let ndiInvalidateTimer = null;
let ndiFrameCount = 0;
let lastPresenterState = null;

function loadNDIAddon() {
  if (ndiSender) return true;
  try {
    const addon = require('../ndi-addon/index.js');
    if (addon && addon.NDISender) {
      ndiSender = new addon.NDISender('CrossPresenter NDI');
      console.log('NDI Addon loaded: OpenBeam NDI source is live on the network');
      return true;
    }
  } catch (e) {
    console.warn('NDI Addon not found or failed to load:', e);
  }
  return false;
}

function createNDIWindow() {
  if (ndiWindow && !ndiWindow.isDestroyed()) return ndiWindow;

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  ndiWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    frame: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  ndiWindow.webContents.setFrameRate(30);

  ndiWindow.webContents.on('paint', (e, dirty, image) => {
    if (!ndiCaptureActive || !ndiSender || !ndiWindow || ndiWindow.isDestroyed()) return;
    try {
      const size = image.getSize();
      if (!size.width || !size.height) return;
      const bmp = image.toBitmap(); // BGRA byte order, matches addon BGRX FourCC
      ndiSender.sendFrame(bmp, size.width, size.height);
      ndiFrameCount++;
      if (ndiFrameCount % 60 === 0) {
        console.log(`[NDI] Sent ${ndiFrameCount} frames (${size.width}x${size.height})`);
      }
    } catch (err) {
      console.error('[NDI] send error:', err);
    }
  });

  if (isDev) {
    ndiWindow.loadURL('http://localhost:5173/#/presenter');
  } else {
    ndiWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/presenter' });
  }

  ndiWindow.webContents.on('did-finish-load', () => {
    if (lastPresenterState) {
      ndiWindow.webContents.send('presenter-state-updated', lastPresenterState);
    }
  });

  ndiWindow.on('closed', () => {
    ndiWindow = null;
  });

  return ndiWindow;
}

function enableNDI() {
  if (!loadNDIAddon()) return;
  createNDIWindow();
  ndiCaptureActive = true;
  if (!ndiInvalidateTimer) {
    ndiInvalidateTimer = setInterval(() => {
      if (ndiCaptureActive && ndiWindow && !ndiWindow.isDestroyed()) {
        ndiWindow.webContents.invalidate();
      }
    }, 33);
  }
}

function disableNDI() {
  ndiCaptureActive = false;
  if (ndiInvalidateTimer) {
    clearInterval(ndiInvalidateTimer);
    ndiInvalidateTimer = null;
  }
  if (ndiWindow && !ndiWindow.isDestroyed()) {
    ndiWindow.destroy();
  }
  ndiWindow = null;
  if (ndiSender) {
    try { ndiSender.destroy(); } catch {}
    ndiSender = null;
  }
  ndiFrameCount = 0;
}

ipcMain.on('ndi-enabled', (event, enabled) => {
  if (enabled) {
    enableNDI();
  } else {
    disableNDI();
  }
});

// ---- Live Video Recorder ----
// Records the live presenter output by rendering the presenter route in a hidden
// offscreen window (same approach as NDI) and piping its paint frames to the main
// UI, which encodes them (canvas.captureStream + MediaRecorder) with chosen audio.
let recorderWindow = null;
let recorderCaptureActive = false;
let recorderInvalidateTimer = null;
let recorderFrameCount = 0;
let recorderOutputWidth = 1280;
let recorderLastFrameSend = 0;
let recorderTempPath = null;

function createRecorderWindow() {
  if (recorderWindow && !recorderWindow.isDestroyed()) return recorderWindow;

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  recorderWindow = new BrowserWindow({
    width: recorderOutputWidth,
    height: Math.round((recorderOutputWidth * 9) / 16),
    show: false,
    frame: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  recorderWindow.webContents.setFrameRate(30);

  recorderWindow.webContents.on('paint', (e, dirty, image) => {
    if (!recorderCaptureActive || !recorderWindow || recorderWindow.isDestroyed()) return;
    const now = Date.now();
    if (now - recorderLastFrameSend < 40) return; // ~25 fps cap
    recorderLastFrameSend = now;
    try {
      const size = image.getSize();
      if (!size.width || !size.height) return;
      let frame = image;
      if (size.width > recorderOutputWidth) {
        frame = image.resize({ width: recorderOutputWidth });
      }
      const jpeg = frame.toJPEG(78);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recorder-frame', { seq: ++recorderFrameCount, data: jpeg });
      }
    } catch (err) {
      console.error('[Recorder] frame error:', err);
    }
  });

  if (isDev) {
    recorderWindow.loadURL('http://localhost:5173/#/presenter');
  } else {
    recorderWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/presenter' });
  }

  recorderWindow.webContents.on('did-finish-load', () => {
    if (lastPresenterState) {
      recorderWindow.webContents.send('presenter-state-updated', lastPresenterState);
    }
  });

  recorderWindow.on('closed', () => {
    recorderWindow = null;
  });

  return recorderWindow;
}

function startRecorderCapture(quality) {
  recorderOutputWidth = quality === '1080p' ? 1920 : 1280;
  recorderLastFrameSend = 0;
  recorderFrameCount = 0;
  createRecorderWindow();
  recorderCaptureActive = true;
  if (!recorderInvalidateTimer) {
    recorderInvalidateTimer = setInterval(() => {
      if (recorderCaptureActive && recorderWindow && !recorderWindow.isDestroyed()) {
        recorderWindow.webContents.invalidate();
      }
    }, 33);
  }
}

function stopRecorderCapture() {
  recorderCaptureActive = false;
  if (recorderInvalidateTimer) {
    clearInterval(recorderInvalidateTimer);
    recorderInvalidateTimer = null;
  }
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    recorderWindow.destroy();
  }
  recorderWindow = null;
}

ipcMain.on('recorder-start', (event, quality) => {
  startRecorderCapture(quality === '1080p' ? '1080p' : '720p');
});

ipcMain.on('recorder-stop', () => {
  stopRecorderCapture();
});

ipcMain.on('recorder-chunk', (event, chunk) => {
  try {
    if (!recorderTempPath) {
      recorderTempPath = path.join(app.getPath('temp'), `crosspresenter-rec-${Date.now()}.webm`);
    }
    fs.appendFileSync(recorderTempPath, Buffer.from(chunk));
  } catch (e) {
    console.error('[Recorder] failed to write chunk:', e);
  }
});

ipcMain.handle('save-recording', async (event, defaultName) => {
  if (!recorderTempPath) return { canceled: true, path: null };
  const tempPath = recorderTempPath;
  recorderTempPath = null;
  let defaultDir = app.getPath('videos');
  try {
    if (!fs.existsSync(defaultDir)) defaultDir = app.getPath('desktop');
  } catch {
    defaultDir = app.getPath('desktop');
  }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Live Recording',
    defaultPath: path.join(defaultDir, defaultName),
    filters: [{ name: 'WebM Video', extensions: ['webm'] }]
  });
  if (canceled || !filePath) {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return { canceled: true, path: null };
  }
  try {
    fs.copyFileSync(tempPath, filePath);
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return { canceled: false, path: filePath };
  } catch (e) {
    console.error('[Recorder] failed to save:', e);
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    return { canceled: false, path: null };
  }
});

ipcMain.on('recorder-cancel', () => {
  if (recorderTempPath) {
    try { fs.unlinkSync(recorderTempPath); } catch { /* ignore */ }
    recorderTempPath = null;
  }
});

ipcMain.handle('get-desktop-sources', async () => {
  return await desktopCapturer.getSources({ types: ['window', 'screen'] });
});

ipcMain.handle('get-sync-role', (event) => {
  return event.sender.id === syncMasterWebContentsId;
});

ipcMain.on('sync-time', (event, time) => {
  if (event.sender.id !== syncMasterWebContentsId) return;

  // Always broadcast to mainWindow so the UI (slider/duration) can update!
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-time-updated', time);
  }

  // Broadcast to all presenter windows that are slaves
  presenterWindows.forEach(win => {
    if (!win.isDestroyed() && win.webContents.id !== syncMasterWebContentsId) {
      win.webContents.send('sync-time-updated', time);
    }
  });

  // NDI output window is always a slave
  if (ndiWindow && !ndiWindow.isDestroyed() && ndiWindow.webContents.id !== syncMasterWebContentsId) {
    ndiWindow.webContents.send('sync-time-updated', time);
  }
  // Recorder output window is always a slave
  if (recorderWindow && !recorderWindow.isDestroyed() && recorderWindow.webContents.id !== syncMasterWebContentsId) {
    recorderWindow.webContents.send('sync-time-updated', time);
  }
});

ipcMain.on('sync-duration', (event, duration) => {
  if (event.sender.id !== syncMasterWebContentsId) return;

  // Always broadcast to mainWindow so the UI (slider/duration) can update!
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-duration-updated', duration);
  }

  // Broadcast to all presenter windows that are slaves
  presenterWindows.forEach(win => {
    if (!win.isDestroyed() && win.webContents.id !== syncMasterWebContentsId) {
      win.webContents.send('sync-duration-updated', duration);
    }
  });

  // NDI output window is always a slave
  if (ndiWindow && !ndiWindow.isDestroyed() && ndiWindow.webContents.id !== syncMasterWebContentsId) {
    ndiWindow.webContents.send('sync-duration-updated', duration);
  }
  // Recorder output window is always a slave
  if (recorderWindow && !recorderWindow.isDestroyed() && recorderWindow.webContents.id !== syncMasterWebContentsId) {
    recorderWindow.webContents.send('sync-duration-updated', duration);
  }
});

// SQLite Database Handlers
// Reads come from the in-memory bibleIndex so the synchronous event.returnValue
// can be set reliably (setting it inside an async callback is not guaranteed to
// be received by sendSync callers).
ipcMain.on('query-verses', (event, { book, chapter }) => {
  const ch = bibleIndex[book] && bibleIndex[book][chapter];
  event.returnValue = ch ? Object.keys(ch).map(Number).sort((a, b) => a - b) : [];
});

ipcMain.on('query-verse-text', (event, { book, chapter, verse }) => {
  event.returnValue = (bibleIndex[book] && bibleIndex[book][chapter] && bibleIndex[book][chapter][verse]) || '';
});

// Load a bundled translation into the renderer over IPC instead of fetch(),
// which does not work on file:// URLs in production.
ipcMain.handle('get-bible-json', (event, name) => {
  if (name !== 'tamil') return null;
  let file = path.join(__dirname, '../dist/bibles/tamil.json');
  if (!fs.existsSync(file)) file = path.join(__dirname, '../public/bibles/tamil.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`Failed to read bible json ${name}:`, e);
    return null;
  }
});

// Persistent Storage Handlers
// Backups: keep versioned copies of the service items file so a corrupt or
// missing main file can be auto-restored from the newest valid backup.
const BACKUP_KEYS = ['oflow_serviceItems'];
const MAX_BACKUPS = 10;

async function backupStoreKey(userDataPath, key, value) {
  try {
    const backupsDir = path.join(userDataPath, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const backupPath = path.join(backupsDir, `${key}-${Date.now()}.json`);
    await fs.promises.writeFile(backupPath, value, 'utf-8');

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith(`${key}-`) && f.endsWith('.json'))
      .map(f => ({ f, t: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    while (files.length > MAX_BACKUPS) {
      const oldest = files.pop();
      fs.unlinkSync(path.join(backupsDir, oldest.f));
    }
  } catch (error) {
    console.error(`Failed to back up store key ${key}:`, error);
  }
}

function newestBackup(userDataPath, key) {
  try {
    const backupsDir = path.join(userDataPath, 'backups');
    if (!fs.existsSync(backupsDir)) return null;
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith(`${key}-`) && f.endsWith('.json'))
      .map(f => ({ f, t: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (files.length === 0) return null;
    return fs.readFileSync(path.join(backupsDir, files[0].f), 'utf-8');
  } catch (error) {
    console.error(`Failed to read backup for store key ${key}:`, error);
    return null;
  }
}

ipcMain.on('store-get', (event, key) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, `${key}.json`);
    const isBackedUp = BACKUP_KEYS.includes(key);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      if (isBackedUp) {
        try {
          JSON.parse(data);
          event.returnValue = data;
        } catch {
          // Main file corrupt: restore newest valid backup
          const backup = newestBackup(userDataPath, key);
          if (backup) {
            console.error(`Store key ${key} is corrupt; restoring from newest backup`);
            fs.writeFileSync(filePath, backup, 'utf-8');
            event.returnValue = backup;
          } else {
            event.returnValue = null;
          }
        }
      } else {
        event.returnValue = data;
      }
    } else {
      // Missing main file: restore newest valid backup
      if (isBackedUp) {
        const backup = newestBackup(userDataPath, key);
        if (backup) {
          console.error(`Store key ${key} is missing; restoring from newest backup`);
          fs.writeFileSync(filePath, backup, 'utf-8');
          event.returnValue = backup;
        } else {
          event.returnValue = null;
        }
      } else {
        event.returnValue = null;
      }
    }
  } catch (error) {
    console.error(`Failed to read store key ${key}:`, error);
    event.returnValue = null;
  }
});

ipcMain.handle('store-set', async (event, key, value) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, `${key}.json`);
    // Create directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    await fs.promises.writeFile(filePath, value, 'utf-8');

    if (BACKUP_KEYS.includes(key)) {
      await backupStoreKey(userDataPath, key, value);
    }
    return true;
  } catch (error) {
    console.error(`Failed to write store key ${key}:`, error);
    return false;
  }
});

ipcMain.on('store-delete', (event, key) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const backupsDir = path.join(userDataPath, 'backups');
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith(`${key}-`) && f.endsWith('.json'));
      for (const f of files) {
        fs.unlinkSync(path.join(backupsDir, f));
      }
    }
    event.returnValue = true;
  } catch (error) {
    console.error(`Failed to delete store key ${key}:`, error);
    event.returnValue = false;
  }
});

ipcMain.on('confirm-quit', () => {
  isQuitting = true;
  disableNDI();
  stopRecorderCapture();
  if (recorderTempPath) {
    try { fs.unlinkSync(recorderTempPath); } catch { /* ignore */ }
    recorderTempPath = null;
  }
  phoneCamClients.forEach(res => {
    try { res.destroy(); } catch { /* ignore */ }
  });
  phoneCamClients.clear();
  if (phoneCamHttpsServer) {
    try { phoneCamHttpsServer.close(); } catch { /* ignore */ }
    phoneCamHttpsServer = null;
  }
  if (remoteServer) {
    try { remoteServer.close(); } catch { /* ignore */ }
    remoteServer = null;
  }
  presenterWindows.forEach(win => {
    if (!win.isDestroyed()) win.close();
  });
  presenterWindows.clear();
  if (cursorWatchInterval) {
    clearInterval(cursorWatchInterval);
    cursorWatchInterval = null;
  }
  stopWarpProc();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  app.quit();
});

// ---- Phone/tablet remote controller ----
const REMOTE_TOKEN = crypto.randomBytes(6).toString('hex');
let remoteServer = null;
let remoteHtml = '';

// ---- Phone camera (virtual camera over WiFi) ----
let phoneCamHtml = '';
let phoneCamFrame = null;          // latest JPEG Buffer
let phoneCamLastFrameAt = 0;
const phoneCamClients = new Set();
let phoneCamHttpsServer = null;
let phoneCamHttpsPort = 4671;
let phoneCamTlsOptions = null;

function sendPhoneCamFrame() {
  if (!phoneCamFrame) return;
  const part = Buffer.concat([
    Buffer.from('--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ' + phoneCamFrame.length + '\r\n\r\n'),
    phoneCamFrame,
    Buffer.from('\r\n')
  ]);
  for (const res of phoneCamClients) {
    if (res.destroyed || res.writableEnded) { phoneCamClients.delete(res); continue; }
    if (res.writableLength > 300000) continue; // slow client: skip this frame
    try { res.write(part); } catch { phoneCamClients.delete(res); }
  }
}

function handlePhoneFrame(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 3 * 1024 * 1024) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (buf.length > 0) {
      phoneCamFrame = buf;
      phoneCamLastFrameAt = Date.now();
      sendPhoneCamFrame();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, at: phoneCamLastFrameAt }));
  });
}

function handlePhoneMjpeg(req, res) {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive'
  });
  phoneCamClients.add(res);
  sendPhoneCamFrame();
  req.on('close', () => phoneCamClients.delete(res));
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

function isPrivateIp(ip) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

function getPrivateAddr() {
  const addrs = getLanAddresses();
  return addrs.find(isPrivateIp) || addrs[0] || '127.0.0.1';
}

function getRemoteInfo() {
  const privateAddr = getPrivateAddr();
  const addrs = getLanAddresses();
  const port = remoteServer && remoteServer.address() ? remoteServer.address().port : 4670;
  const base = `http://${privateAddr}:${port}`;
  return {
    url: `${base}/?t=${REMOTE_TOKEN}`,
    token: REMOTE_TOKEN,
    port,
    addresses: addrs,
    phonecamUrl: `https://${privateAddr}:${phoneCamHttpsPort}/phonecam?t=${REMOTE_TOKEN}`,
    phoneCamUrl: `http://127.0.0.1:${port}/api/phonecam.mjpeg?t=${REMOTE_TOKEN}`
  };
}

function startRemoteServer() {
  if (remoteServer) return;
  try {
    remoteHtml = fs.readFileSync(path.join(__dirname, 'remote.html'), 'utf-8');
  } catch (e) {
    console.error('Failed to load remote.html', e);
  }
  try {
    phoneCamHtml = fs.readFileSync(path.join(__dirname, 'phonecam.html'), 'utf-8');
  } catch (e) {
    console.error('Failed to load phonecam.html', e);
  }

  const server = http.createServer((req, res) => {
    let pathname;
    let token;
    try {
      const url = new URL(req.url, 'http://localhost');
      pathname = url.pathname;
      token = url.searchParams.get('t') || '';
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(remoteHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lastPresenterState));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/cmd') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.token !== REMOTE_TOKEN) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('remote-command', parsed.command);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'bad request' }));
        }
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/phonecam') {
      // Camera access requires a secure context, so redirect to the HTTPS server.
      res.writeHead(302, { 'Location': `https://${getPrivateAddr()}:${phoneCamHttpsPort}/phonecam?t=${token}` });
      res.end();
      return;
    }

    if (req.method === 'POST' && pathname === '/api/phoneframe') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }
      handlePhoneFrame(req, res);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/phonecam.mjpeg') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      handlePhoneMjpeg(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  let port = 4670;
  const tryListen = () => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < 4685) {
        port++;
        tryListen();
      } else {
        console.error('Remote server failed to start:', err);
      }
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`CrossPresenter Remote controller on port ${port}`);
    });
  };
  tryListen();
  remoteServer = server;
}

// HTTPS server for the phone camera page. The phone browser needs a secure
// context (https) to use getUserMedia; the PC app keeps using the plain-HTTP
// MJPEG endpoint above. Both share the same in-memory frame buffer.
function startPhoneCamServer() {
  if (phoneCamHttpsServer) return;
  try {
    const key = fs.readFileSync(path.join(__dirname, 'phonecam-key.pem'));
    const cert = fs.readFileSync(path.join(__dirname, 'phonecam-cert.pem'));
    phoneCamTlsOptions = { key, cert };
  } catch (e) {
    console.error('Failed to load phonecam TLS cert:', e);
    return;
  }

  const server = https.createServer(phoneCamTlsOptions, (req, res) => {
    let pathname;
    let token;
    try {
      const url = new URL(req.url, 'https://localhost');
      pathname = url.pathname;
      token = url.searchParams.get('t') || '';
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    if (pathname === '/phonecam') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(phoneCamHtml);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/phoneframe') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
      }
      handlePhoneFrame(req, res);
      return;
    }

    if (pathname === '/api/phonecam.mjpeg') {
      if (token !== REMOTE_TOKEN) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      handlePhoneMjpeg(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const tryListen = () => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && phoneCamHttpsPort < 4685) {
        phoneCamHttpsPort++;
        tryListen();
      } else {
        console.error('Phone camera server failed to start:', err);
      }
    });
    server.listen(phoneCamHttpsPort, '0.0.0.0', () => {
      console.log(`CrossPresenter Phone Camera on port ${phoneCamHttpsPort}`);
    });
  };
  tryListen();
  phoneCamHttpsServer = server;
}

ipcMain.handle('get-remote-info', () => getRemoteInfo());

ipcMain.handle('get-phone-cam-status', () => ({
  connected: phoneCamLastFrameAt > 0 && (Date.now() - phoneCamLastFrameAt) < 3000,
  lastFrameAt: phoneCamLastFrameAt
}));

// NDI and WebCodecs Handlers are higher up

app.whenReady().then(() => {
  // Migrate user data from previous app names (OpenFlow, OpenBeam) to the current.
  try {
    const appData = app.getPath('appData');
    const newPath = app.getPath('userData');
    const candidates = [path.join(appData, 'OpenFlow'), path.join(appData, 'OpenBeam')];
    if (!fs.existsSync(newPath)) {
      const oldPath = candidates.find(p => fs.existsSync(p));
      if (oldPath) {
        fs.renameSync(oldPath, newPath);
        console.log(`Migrated user data to ${newPath}`);
      }
    }
  } catch (e) {
    console.error('Failed to migrate user data:', e);
  }

  initDB();

  // No app menu bar (removes File/Edit/View/Window + their accelerators).
  Menu.setApplicationMenu(null);

  createWindows();
  startRemoteServer();
  startPhoneCamServer();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
