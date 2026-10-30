/**
 * TypeScript mirror of the Rust data model in `src-tauri/src/model.rs`.
 *
 * The Rust structs serialise as camelCase, so these types describe the wire
 * format exactly and no adapter layer is needed. Keep the two files in step:
 * a mismatch here surfaces as a silent `undefined` rather than a type error,
 * because the payload crosses the IPC boundary as JSON.
 */

export type TextAlign = "left" | "center" | "right" | "justify";
export type VerticalAlign = "top" | "middle" | "bottom";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  lineHeight: number;
  letterSpacing: number;
  /** CSS `text-shadow`; empty string disables it. */
  shadow: string;
  /** Outline width in px; 0 disables the stroke. */
  strokeWidth: number;
  strokeColor: string;
}

/** Normalised rect — every field is 0..1 of the canvas. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A styled character range inside a text layer; `end` is exclusive. */
export interface TextSpan {
  start: number;
  end: number;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  color?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
}

export interface TextLayer {
  type: "text";
  id: string;
  rect: Rect;
  text: string;
  style: TextStyle;
  spans: TextSpan[];
  autoFit: boolean;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface ImageLayer {
  type: "image";
  id: string;
  rect: Rect;
  src: string;
  opacity: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface ShapeLayer {
  type: "shape";
  id: string;
  rect: Rect;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  opacity: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer;

export type Background =
  | { kind: "color"; color: string }
  | { kind: "image"; src: string; fit: string }
  | { kind: "video"; src: string; fit: string; loopPlayback: boolean; muted: boolean }
  | { kind: "gradient"; from: string; to: string; angle: number };

export type Transition =
  | "cut"
  | "fade"
  | "crossFade"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "zoom"
  | "dissolve";

export const TRANSITIONS: { value: Transition; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "crossFade", label: "Cross Fade" },
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "zoom", label: "Zoom" },
  { value: "dissolve", label: "Dissolve" },
];

export interface Slide {
  id: string;
  label: string;
  layers: Layer[];
  background: Background | null;
  transition: Transition;
  notes: string;
  groupColor: string;
}

export type ItemKind = "song" | "presentation" | "media" | "bible" | "announcement" | "web";

export interface SongMeta {
  author: string;
  copyright: string;
  ccli: string;
  key: string;
  tempo: string;
  themes: string[];
  arrangement: string[];
  source: string;
}

export interface ServiceItem {
  id: string;
  kind: ItemKind;
  title: string;
  slides: Slide[];
  meta: SongMeta;
  background: Background | null;
  color: string;
  sourcePath: string;
}

export type Deck = "media" | "bg" | "graphics" | "browser";
export type MediaKind = "image" | "video" | "audio" | "presentation" | "url";

export interface MediaAsset {
  id: string;
  deck: Deck;
  kind: MediaKind;
  name: string;
  /** Absolute local path, or the URL itself when `kind === "url"`. */
  path: string;
  /** Data-URI thumbnail produced in Rust. */
  thumbnail: string;
  width: number;
  height: number;
  durationSeconds: number;
  sizeBytes: number;
}

export interface FontFace {
  family: string;
  fileName: string;
  weight: string;
  style: string;
}

export interface Show {
  schemaVersion: number;
  title: string;
  items: ServiceItem[];
  media: MediaAsset[];
  fonts: FontFace[];
  savedAt: string;
  appVersion: string;
}

// ---------------------------------------------------------------------------
// Command payloads
// ---------------------------------------------------------------------------

export interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
  isProjecting: boolean;
}

export interface ExportReport {
  path: string;
  bytesWritten: number;
  mediaEmbedded: number;
  fontsEmbedded: number;
  missingAssets: string[];
}

export interface ImportReport {
  show: Show;
  cacheDir: string;
  mediaExtracted: number;
  fontsExtracted: number;
}

export interface ImportError {
  path: string;
  message: string;
}

export interface ImportSongsReport {
  items: ServiceItem[];
  errors: ImportError[];
  filesScanned: number;
  songsImported: number;
}

export interface FormatSupport {
  app: string;
  extensions: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Bible module
// ---------------------------------------------------------------------------

export interface BibleBook {
  name: string;
  /** `chapters[c][v]` — chapter `c + 1`, verse `v + 1`, both zero-based. */
  chapters: string[][];
}

export interface BibleTranslation {
  id: string;
  name: string;
  language: string;
  books: BibleBook[];
}

export interface BibleTranslationSummary {
  id: string;
  name: string;
  language: string;
  bookCount: number;
}

// ---------------------------------------------------------------------------
// Live output protocol
// ---------------------------------------------------------------------------

/**
 * The complete visual state of the live output. The operator window emits this
 * as a single event; live windows are otherwise stateless, which keeps them
 * cheap to open and impossible to desync.
 */
export interface LiveState {
  /** Null renders black — used by the [ Black ] quick action. */
  slide: Slide | null;
  /** Item-level background, applied when the slide defines none. */
  itemBackground: Background | null;
  /** Blanks all text while leaving the background running. */
  textCleared: boolean;
  /** Blanks the background while leaving text visible. */
  backgroundCleared: boolean;
  /** Full black output. */
  black: boolean;
  transition: Transition;
  /** URL currently streamed from the Browser deck, if any. */
  webUrl: string | null;
}

export const LIVE_EVENT = "crosspresenter://live-state";
export const LIVE_REQUEST_EVENT = "crosspresenter://live-request-state";

export const EMPTY_LIVE_STATE: LiveState = {
  slide: null,
  itemBackground: null,
  textCleared: false,
  backgroundCleared: false,
  black: false,
  transition: "fade",
  webUrl: null,
};
