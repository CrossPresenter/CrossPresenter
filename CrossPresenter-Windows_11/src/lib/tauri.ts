/**
 * Typed wrappers over the Rust command layer.
 *
 * Every call into the backend goes through this file, so the argument names
 * (which Tauri matches against the Rust parameter names, converted from
 * snake_case) are declared exactly once instead of being retyped at each call
 * site where a typo would fail silently at runtime.
 */

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

import {
  LIVE_EVENT,
  LIVE_REQUEST_EVENT,
  type BibleTranslation,
  type BibleTranslationSummary,
  type ExportReport,
  type FormatSupport,
  type ImportReport,
  type ImportSongsReport,
  type LiveState,
  type MonitorInfo,
  type Show,
  type Slide,
} from "./types";

/**
 * True when running inside the Tauri shell. The frontend is also servable in a
 * plain browser during UI work, where every backend call would otherwise throw;
 * the guards below degrade to inert no-ops instead.
 */
export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Monitors and projection
// ---------------------------------------------------------------------------

export function listMonitors(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>("list_monitors");
}

/** Every monitor except the primary — the operator's own screen is never a target. */
export function listProjectionTargets(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>("list_projection_targets");
}

export function openLiveOutput(monitorId: string): Promise<string> {
  return invoke<string>("open_live_output", { monitorId });
}

export function closeLiveOutput(monitorId: string): Promise<void> {
  return invoke<void>("close_live_output", { monitorId });
}

export function closeAllLiveOutputs(): Promise<number> {
  return invoke<number>("close_all_live_outputs");
}

export function activeLiveOutputs(): Promise<string[]> {
  return invoke<string[]>("active_live_outputs");
}

export function openBrowserWindow(url: string, assetId: string): Promise<string> {
  return invoke<string>("open_browser_window", { url, assetId });
}

export function closeBrowserWindow(assetId: string): Promise<void> {
  return invoke<void>("close_browser_window", { assetId });
}

// ---------------------------------------------------------------------------
// .cpshow archive engine
// ---------------------------------------------------------------------------

export function exportShow(show: Show, destPath: string): Promise<ExportReport> {
  return invoke<ExportReport>("export_show", { show, destPath });
}

export function importShow(sourcePath: string): Promise<ImportReport> {
  return invoke<ImportReport>("import_show", { sourcePath });
}

// ---------------------------------------------------------------------------
// Song import engine
// ---------------------------------------------------------------------------

export function importSongs(
  paths: string[],
  linesPerSlide?: number,
): Promise<ImportSongsReport> {
  return invoke<ImportSongsReport>("import_songs", { paths, linesPerSlide });
}

export function listSupportedSongFormats(): Promise<FormatSupport[]> {
  return invoke<FormatSupport[]>("list_supported_song_formats");
}

// ---------------------------------------------------------------------------
// PPTX text extraction
// ---------------------------------------------------------------------------

/** Unzips a `.pptx` and returns one auto-fit text slide per presentation slide. */
export function extractPptxSlides(path: string): Promise<Slide[]> {
  return invoke<Slide[]>("extract_pptx_slides", { path });
}

// ---------------------------------------------------------------------------
// Bible module
// ---------------------------------------------------------------------------

export function importBibleTranslation(sourcePath: string): Promise<BibleTranslationSummary> {
  return invoke<BibleTranslationSummary>("import_bible_translation", { sourcePath });
}

export function listBibleTranslations(): Promise<BibleTranslationSummary[]> {
  return invoke<BibleTranslationSummary[]>("list_bible_translations");
}

export function getBibleTranslation(id: string): Promise<BibleTranslation> {
  return invoke<BibleTranslation>("get_bible_translation", { id });
}

export function removeBibleTranslation(id: string): Promise<void> {
  return invoke<void>("remove_bible_translation", { id });
}

// ---------------------------------------------------------------------------
// File pickers
// ---------------------------------------------------------------------------

/**
 * All pickers run on the OS's own dialog thread via the dialog plugin, so the
 * webview keeps painting while the operator browses — no frozen window.
 */

const SONG_EXTENSIONS = [
  "db", "sdb", "sqlite", "sqlite3", "mdb",
  "xml", "osz", "qsp", "proclaim",
  "json", "vps", "fsh",
];

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mkv", "mov", "m4v", "avi"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];

export async function pickSongFiles(): Promise<string[]> {
  const picked = await openDialog({
    multiple: true,
    directory: false,
    title: "Import songs",
    filters: [
      { name: "Song libraries", extensions: SONG_EXTENSIONS },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return normalisePicked(picked);
}

/** Whole-library import: point at a folder and let Rust walk it in parallel. */
export async function pickSongFolder(): Promise<string[]> {
  const picked = await openDialog({
    multiple: false,
    directory: true,
    title: "Import a song library folder",
  });
  return normalisePicked(picked);
}

export async function pickMediaFiles(): Promise<string[]> {
  const picked = await openDialog({
    multiple: true,
    directory: false,
    title: "Add media",
    filters: [
      {
        name: "Media",
        extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS],
      },
      { name: "Images", extensions: IMAGE_EXTENSIONS },
      { name: "Video", extensions: VIDEO_EXTENSIONS },
      { name: "Audio", extensions: AUDIO_EXTENSIONS },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return normalisePicked(picked);
}

export async function pickBibleFile(): Promise<string | null> {
  const picked = await openDialog({
    multiple: false,
    directory: false,
    title: "Import a Bible translation",
    filters: [
      { name: "Zefania XML", extensions: ["xml"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  const list = normalisePicked(picked);
  return list[0] ?? null;
}

export async function pickPresentations(): Promise<string[]> {
  const picked = await openDialog({
    multiple: true,
    directory: false,
    title: "Add presentations",
    filters: [{ name: "PowerPoint", extensions: ["pptx", "ppsx"] }],
  });
  return normalisePicked(picked);
}

export async function pickShowToImport(): Promise<string | null> {
  const picked = await openDialog({
    multiple: false,
    directory: false,
    title: "Import .cpshow",
    filters: [{ name: "CrossPresenter show", extensions: ["cpshow"] }],
  });
  const list = normalisePicked(picked);
  return list[0] ?? null;
}

export async function pickShowDestination(suggestedName: string): Promise<string | null> {
  const path = await saveDialog({
    title: "Export .cpshow",
    defaultPath: `${sanitiseFileName(suggestedName) || "Service"}.cpshow`,
    filters: [{ name: "CrossPresenter show", extensions: ["cpshow"] }],
  });
  return path ?? null;
}

/** The dialog plugin returns `string | string[] | null` depending on options. */
function normalisePicked(picked: string | string[] | null): string[] {
  if (picked === null) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export function sanitiseFileName(name: string): string {
  // Only the characters Windows forbids outright. Spaces and dashes are kept:
  // "Sunday Morning - 12 Oct" is a name an operator would actually type.
  return name.replace(/[<>:"/\\|?*]+/g, "").trim();
}

// ---------------------------------------------------------------------------
// Asset URLs
// ---------------------------------------------------------------------------

/**
 * Turn an absolute local path into a URL the webview can load.
 *
 * Media is streamed through Tauri's asset protocol rather than being read into
 * JS and base64'd: the bytes stay on the native side and decoding happens on
 * the GPU path, which is the difference between a 4K background video playing
 * smoothly and stuttering.
 */
export function assetUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  // Already a URL or inline data — pass through untouched.
  if (/^(https?|data|blob|asset):/i.test(pathOrUrl)) return pathOrUrl;
  if (!IS_TAURI) return pathOrUrl;
  return convertFileSrc(pathOrUrl);
}

// ---------------------------------------------------------------------------
// Live output protocol
// ---------------------------------------------------------------------------

/**
 * Push the complete live state to every projection window.
 *
 * State is broadcast as one whole-value event rather than a stream of deltas.
 * A live window can therefore be opened at any moment and be correct after a
 * single message, and there is no ordering between partial updates to get
 * wrong mid-service.
 */
export function publishLiveState(state: LiveState): void {
  if (!IS_TAURI) return;
  // `void emit(...)` alone leaves a rejected broadcast to become an unhandled
  // rejection, which the crash overlay would paint over the whole UI. Swallow
  // it deliberately.
  emit(LIVE_EVENT, state).catch((err) => {
    console.warn("publish live state failed", err);
  });
}

export function onLiveState(handler: (state: LiveState) => void): Promise<UnlistenFn> {
  return listen<LiveState>(LIVE_EVENT, (event) => handler(event.payload));
}

/**
 * Asked by a live window as it mounts: it has no state of its own, so it
 * requests a resend rather than showing a black frame until the operator's next
 * action.
 */
export function requestLiveState(): void {
  if (!IS_TAURI) return;
  emit(LIVE_REQUEST_EVENT, {}).catch((err) => {
    console.warn("request live state failed", err);
  });
}

export function onLiveStateRequest(handler: () => void): Promise<UnlistenFn> {
  return listen(LIVE_REQUEST_EVENT, () => handler());
}

// ---------------------------------------------------------------------------
// Window identity
// ---------------------------------------------------------------------------

export type WindowRole = "operator" | "live" | "stage" | "browser";

/**
 * Which window this bundle is running in.
 *
 * Operator, live and stage views all share one Vite bundle and are told apart
 * by window label prefix. One entry point means one warm JS context and no
 * second HTML document to keep in sync.
 */
export function windowRole(): WindowRole {
  if (!IS_TAURI) {
    // Browser preview: `?role=live` makes the output view reachable for UI work.
    const role = new URLSearchParams(window.location.search).get("role");
    if (role === "live" || role === "stage" || role === "browser") return role;
    return "operator";
  }
  const label = getCurrentWindow().label;
  if (label.startsWith("live-")) return "live";
  if (label.startsWith("stage-")) return "stage";
  if (label.startsWith("browser-")) return "browser";
  return "operator";
}

/** Human-readable message from a rejected `invoke`. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
