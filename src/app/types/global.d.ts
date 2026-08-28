export interface ElectronAPI {
  getPathForFile: (file: File) => string;
  sendStateUpdate: (state: any) => void;
  onStateUpdate: (callback: (state: any) => void) => void;
  getDisplays: () => Promise<any[]>;
  getAppPath: () => Promise<string>;
  onDisplaysChanged: (callback: (displays: any[]) => void) => void;
  setPresenterDisplays: (displayIds: number[]) => void;
  storeGet: (key: string) => string | null;
  storeSet: (key: string, value: string) => void;
  storeDelete: (key: string) => void;
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
  getPhoneCamStatus: () => Promise<{ connected: boolean; lastFrameAt: number }>;
  onRemoteCommand: (callback: (command: any) => void) => void;
  onRecorderFrame: (callback: (frame: { seq: number; data: Uint8Array }) => void) => void;
  startRecorder: (quality: string) => void;
  stopRecorder: () => void;
  recorderChunk: (chunk: ArrayBuffer | Uint8Array) => void;
  saveRecording: (defaultName: string) => Promise<{ canceled: boolean; path: string | null }>;
  cancelRecording: () => void;
}
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          useragent?: string;
          httpreferrer?: string;
          allowpopups?: boolean;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}