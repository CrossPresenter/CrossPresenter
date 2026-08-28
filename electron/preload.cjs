const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  sendStateUpdate: (state) => ipcRenderer.send('update-presenter-state', state),
  onStateUpdate: (callback) => ipcRenderer.on('presenter-state-updated', (event, state) => callback(state)),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  onDisplaysChanged: (callback) => {
    ipcRenderer.removeAllListeners('displays-changed');
    ipcRenderer.on('displays-changed', (event, displays) => callback(displays));
  },
  setPresenterDisplays: (displayIds) => ipcRenderer.send('set-presenter-displays', displayIds),
  storeGet: (key) => ipcRenderer.sendSync('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key) => ipcRenderer.sendSync('store-delete', key),
  getSyncRole: () => ipcRenderer.invoke('get-sync-role'),
  onSyncRoleChanged: (callback) => {
    ipcRenderer.removeAllListeners('sync-role-changed');
    ipcRenderer.on('sync-role-changed', (event, isMaster) => callback(isMaster));
  },
  sendSyncTime: (time) => ipcRenderer.send('sync-time', time),
  onSyncTimeUpdated: (callback) => {
    ipcRenderer.removeAllListeners('sync-time-updated');
    ipcRenderer.on('sync-time-updated', (event, time) => callback(time));
  },
  sendSyncDuration: (duration) => ipcRenderer.send('sync-duration', duration),
  onSyncDurationUpdated: (callback) => {
    ipcRenderer.removeAllListeners('sync-duration-updated');
    ipcRenderer.on('sync-duration-updated', (event, duration) => callback(duration));
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
  getPhoneCamStatus: () => ipcRenderer.invoke('get-phone-cam-status'),
  onRemoteCommand: (callback) => {
    ipcRenderer.removeAllListeners('remote-command');
    ipcRenderer.on('remote-command', (event, command) => callback(command));
  },
  onRecorderFrame: (callback) => {
    ipcRenderer.removeAllListeners('recorder-frame');
    ipcRenderer.on('recorder-frame', (event, frame) => callback(frame));
  },
  startRecorder: (quality) => ipcRenderer.send('recorder-start', quality),
  stopRecorder: () => ipcRenderer.send('recorder-stop'),
  recorderChunk: (chunk) => ipcRenderer.send('recorder-chunk', chunk),
  saveRecording: (defaultName) => ipcRenderer.invoke('save-recording', defaultName),
  cancelRecording: () => ipcRenderer.send('recorder-cancel')
});
