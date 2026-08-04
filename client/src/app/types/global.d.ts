export interface ElectronAPI {
  sendStateUpdate: (state: any) => void;
  onStateUpdate: (callback: (state: any) => void) => void;
  getDisplays: () => Promise<any[]>;
  getAppPath: () => Promise<string>;
  onDisplaysChanged: (callback: (displays: any[]) => void) => void;
  setPresenterDisplays: (displayIds: number[]) => void;
  setStageDisplay: (displayId: number | null) => void;
  storeGet: (key: string) => string | null;
  storeSet: (key: string, value: string) => void;
  getSyncRole: () => Promise<boolean>;
  onSyncRoleChanged: (callback: (master: boolean) => void) => void;
  sendSyncTime: (time: number) => void;
  onSyncTimeUpdated: (callback: (time: number) => void) => void;
  sendSyncDuration: (duration: number) => void;
  onSyncDurationUpdated: (callback: (duration: number) => void) => void;
  onAppClosing: (callback: () => void) => void;
  confirmQuit: () => void;
  getVersesDB: (book: string, chapter: number) => number[];
  getVerseTextDB: (book: string, chapter: number, verse: number) => string;
  getBibleJSON: (name: string) => Promise<any>;
  getDesktopSources: () => Promise<any[]>;
  setNDIEnabled: (enabled: boolean) => void;
  getRemoteInfo: () => Promise<any>;
  onRemoteCommand: (callback: (command: any) => void) => void;
}
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}