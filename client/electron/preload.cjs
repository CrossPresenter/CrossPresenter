const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  sendStateUpdate: (state) => ipcRenderer.send('update-presenter-state', state),
  onStateUpdate: (callback) => ipcRenderer.on('presenter-state-updated', (event, state) => callback(state)),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  onDisplaysChanged: (callback) => {
    ipcRenderer.removeAllListeners('displays-changed');
    ipcRenderer.on('displays-changed', (event, displays) => callback(displays));
  },
  setPresenterDisplays: (displayIds) => ipcRenderer.send('set-presenter-displays', displayIds),
  setStageDisplay: (displayId) => ipcRenderer.send('set-stage-display', displayId),
  storeGet: (key) => ipcRenderer.sendSync('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  getSyncRole: () => ipcRenderer.invoke('get-sync-role'),
  onSyncRoleChanged: (callback) => {
    ipcRenderer.removeAllListeners('sync-role-changed');
    ipcRenderer.on('sync-role-changed', (event, isMaster) => callback(isMaster));
  },
  sendSyncTime: (time) => ipcRenderer.send('youtube-sync-time', time),
  onSyncTimeUpdated: (callback) => {
    ipcRenderer.removeAllListeners('youtube-sync-time-updated');
    ipcRenderer.on('youtube-sync-time-updated', (event, time) => callback(time));
  },
  sendSyncDuration: (duration) => ipcRenderer.send('youtube-sync-duration', duration),
  onSyncDurationUpdated: (callback) => {
    ipcRenderer.removeAllListeners('youtube-sync-duration-updated');
    ipcRenderer.on('youtube-sync-duration-updated', (event, duration) => callback(duration));
  },
  onAppClosing: (callback) => {
    ipcRenderer.removeAllListeners('app-closing');
    ipcRenderer.on('app-closing', () => callback());
  },
  confirmQuit: () => ipcRenderer.send('confirm-quit'),
  getVersesDB: (book, chapter) => ipcRenderer.sendSync('query-verses', { book, chapter }),
  getVerseTextDB: (book, chapter, verse) => ipcRenderer.sendSync('query-verse-text', { book, chapter, verse }),
  getBibleJSON: (name) => ipcRenderer.invoke('get-bible-json', name),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  setNDIEnabled: (enabled) => ipcRenderer.send('ndi-enabled', enabled),
  getRemoteInfo: () => ipcRenderer.invoke('get-remote-info'),
  onRemoteCommand: (callback) => {
    ipcRenderer.removeAllListeners('remote-command');
    ipcRenderer.on('remote-command', (event, command) => callback(command));
  }
});
