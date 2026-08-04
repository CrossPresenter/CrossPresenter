import { app, BrowserWindow, screen, ipcMain, dialog, session, desktopCapturer } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let db = null;
let isMyBibleFormat = false;
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
  try { if (fs.existsSync(NASB_TXT_PROD)) return NASB_TXT_PROD; } catch (e) {}
  try { if (fs.existsSync(NASB_TXT_DEV)) return NASB_TXT_DEV; } catch (e) {}
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
            isMyBibleFormat = true;
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
let stageWindow = null; // displayId -> BrowserWindow for Stage output
let isQuitting = false;
let syncMasterWebContentsId = null;

// Disable Chrome's strict autoplay policy so presenter windows can play videos programmatically
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function updateSyncMaster() {
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

function createWindows() {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  // Intercept YouTube requests to bypass Error 153 and match the exact Origin to avoid Error 152
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.youtube.com/*', 'https://*.youtube-nocookie.com/*', 'https://*.googlevideo.com/*'] },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'https://www.youtube.com';
      details.requestHeaders['Referer'] = 'https://www.youtube.com/';
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // Strip response headers that block YouTube iframe embedding
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.youtube.com/*', 'https://*.youtube-nocookie.com/*', 'https://*.googlevideo.com/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      callback({ cancel: false, responseHeaders: headers });
    }
  );

  // 1. Create Splash Screen Window
  const splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev) {
    // Vite serves public files at the root URL
    splashWindow.loadURL('http://localhost:5173/splash.html');
  } else {
    splashWindow.loadFile(path.join(__dirname, '../dist/splash.html'));
  }

  // 2. Create Main Window (Hidden)
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      sandbox: true,
      webviewTag: true
    }
  });

  // Spoof a standard Chrome User-Agent so YouTube doesn't flag the Electron runtime
  mainWindow.webContents.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/#/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/' });
  }

  // 3. Handoff logic
  mainWindow.once('ready-to-show', () => {
    // Guarantee minimum splash time (3 seconds) for the animation
    setTimeout(() => {
      if (!splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (!mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.maximize();
        if (isDev) mainWindow.webContents.openDevTools();
        updateSyncMaster();
      }
    }, 3000);
  });

  mainWindow.on('close', (e) => {
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
            webviewTag: true
          }
        });

        if (isDev) {
          pWin.loadURL('http://localhost:5173/#/presenter');
        } else {
          pWin.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/presenter' });
        }
        
        pWin.webContents.on('console-message', (event, level, message) => {
          console.log(`[Presenter Console] ${message}`);
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

// Stage output: fullscreen a "Stage" view (current+next slide, notes, clock,
// timer) onto a selected display. Never the projector feed.
ipcMain.on('set-stage-display', (event, displayId) => {
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
    stageWindow = null;
  }

  if (displayId === null || displayId === undefined) {
    return;
  }

  const targetDisplay = screen.getAllDisplays().find(d => d.id === displayId);
  if (!targetDisplay) return;

  stageWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    title: 'CrossPresenter Stage',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true
    }
  });

  if (isDev) {
    stageWindow.loadURL('http://localhost:5173/#/stage');
  } else {
    stageWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/stage' });
  }

  stageWindow.webContents.on('did-finish-load', () => {
    if (lastPresenterState) {
      stageWindow.webContents.send('presenter-state-updated', lastPresenterState);
    }
  });

  stageWindow.on('closed', () => {
    stageWindow = null;
  });
});

ipcMain.on('update-presenter-state', (event, state) => {
  lastPresenterState = state;
  presenterWindows.forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('presenter-state-updated', state);
    }
  });
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.webContents.send('presenter-state-updated', state);
  }
  if (ndiWindow && !ndiWindow.isDestroyed()) {
    ndiWindow.webContents.send('presenter-state-updated', state);
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

ipcMain.handle('get-desktop-sources', async () => {
  return await desktopCapturer.getSources({ types: ['window', 'screen'] });
});

ipcMain.handle('get-sync-role', (event) => {
  return event.sender.id === syncMasterWebContentsId;
});

ipcMain.on('youtube-sync-time', (event, time) => {
  if (event.sender.id !== syncMasterWebContentsId) return;

  // Always broadcast to mainWindow so the UI (slider/duration) can update!
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('youtube-sync-time-updated', time);
  }

  // Broadcast to all presenter windows that are slaves
  presenterWindows.forEach(win => {
    if (!win.isDestroyed() && win.webContents.id !== syncMasterWebContentsId) {
      win.webContents.send('youtube-sync-time-updated', time);
    }
  });

  // NDI output window is always a slave
  if (ndiWindow && !ndiWindow.isDestroyed() && ndiWindow.webContents.id !== syncMasterWebContentsId) {
    ndiWindow.webContents.send('youtube-sync-time-updated', time);
  }
});

ipcMain.on('youtube-sync-duration', (event, duration) => {
  if (event.sender.id !== syncMasterWebContentsId) return;

  // Always broadcast to mainWindow so the UI (slider/duration) can update!
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('youtube-sync-duration-updated', duration);
  }

  // Broadcast to all presenter windows that are slaves
  presenterWindows.forEach(win => {
    if (!win.isDestroyed() && win.webContents.id !== syncMasterWebContentsId) {
      win.webContents.send('youtube-sync-duration-updated', duration);
    }
  });

  // NDI output window is always a slave
  if (ndiWindow && !ndiWindow.isDestroyed() && ndiWindow.webContents.id !== syncMasterWebContentsId) {
    ndiWindow.webContents.send('youtube-sync-duration-updated', duration);
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

ipcMain.on('confirm-quit', () => {
  isQuitting = true;
  disableNDI();
  if (remoteServer) {
    try { remoteServer.close(); } catch { /* ignore */ }
    remoteServer = null;
  }
  presenterWindows.forEach(win => {
    if (!win.isDestroyed()) win.close();
  });
  presenterWindows.clear();
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
  }
  stageWindow = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  app.quit();
});

// ---- Phone/tablet remote controller ----
const REMOTE_TOKEN = crypto.randomBytes(6).toString('hex');
let remoteServer = null;
let remoteHtml = '';

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

function getRemoteInfo() {
  const addrs = getLanAddresses();
  const privateAddr = addrs.find(isPrivateIp) || addrs[0] || '127.0.0.1';
  const port = remoteServer && remoteServer.address() ? remoteServer.address().port : 4670;
  const base = `http://${privateAddr}:${port}`;
  return { url: `${base}/?t=${REMOTE_TOKEN}`, token: REMOTE_TOKEN, port, addresses: addrs };
}

function startRemoteServer() {
  if (remoteServer) return;
  try {
    remoteHtml = fs.readFileSync(path.join(__dirname, 'remote.html'), 'utf-8');
  } catch (e) {
    console.error('Failed to load remote.html', e);
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

ipcMain.handle('get-remote-info', () => getRemoteInfo());

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
  createWindows();
  startRemoteServer();
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
