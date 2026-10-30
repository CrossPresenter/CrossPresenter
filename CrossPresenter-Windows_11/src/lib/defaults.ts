/**
 * Factory defaults for documents, slides and layers.
 *
 * These mirror the `Default` impls in `src-tauri/src/model.rs`. They exist on
 * the frontend as well because slides created in the editor never round-trip
 * through Rust before being displayed — the operator must see the new slide on
 * the same frame they created it.
 */

import { nanoid } from "nanoid";

import type {
  Background,
  Rect,
  ServiceItem,
  Show,
  Slide,
  SongMeta,
  TextLayer,
  TextStyle,
} from "./types";

export const SHOW_SCHEMA_VERSION = 2;
export const APP_VERSION = "1.0.1";

/** Design-time canvas the normalised rects are authored against (16:9). */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;

/**
 * Font sizes are stored in canvas pixels against a 1080p-tall canvas, and
 * scaled by the ratio of actual render height to `CANVAS_HEIGHT`. A slide
 * therefore looks identical on a 720p confidence monitor and a 4K projector.
 */
export const DEFAULT_FONT_SIZE = 64;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 240;

export const FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Helvetica",
  "Segoe UI",
  "Calibri",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Palatino Linotype",
  "Cambria",
  "Impact",
  "Franklin Gothic Medium",
  "Courier New",
  "Consolas",
  "Noto Sans Tamil",
  "Latha",
  "Nirmala UI",
];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Inter",
  fontSize: DEFAULT_FONT_SIZE,
  color: "#FFFFFF",
  bold: true,
  italic: false,
  underline: false,
  uppercase: false,
  align: "center",
  verticalAlign: "middle",
  lineHeight: 1.22,
  letterSpacing: 0,
  // A drop shadow is on by default: projected text lands on unpredictable
  // backgrounds, and this is what keeps it legible over a bright photo.
  shadow: "0 3px 12px rgba(0,0,0,0.65)",
  strokeWidth: 0,
  strokeColor: "#000000",
};

export const DEFAULT_RECT: Rect = { x: 0.06, y: 0.12, width: 0.88, height: 0.76 };

export const BLACK_BACKGROUND: Background = { kind: "color", color: "#000000" };

export function defaultSongMeta(): SongMeta {
  return {
    author: "",
    copyright: "",
    ccli: "",
    key: "",
    tempo: "",
    themes: [],
    arrangement: [],
    source: "",
  };
}

export function newTextLayer(text = "", rect: Rect = DEFAULT_RECT): TextLayer {
  return {
    type: "text",
    id: nanoid(10),
    rect: { ...rect },
    text,
    style: { ...DEFAULT_TEXT_STYLE },
    spans: [],
    autoFit: true,
    rotation: 0,
    visible: true,
    locked: false,
  };
}

export function newSlide(text = "", label = ""): Slide {
  return {
    id: nanoid(10),
    label,
    layers: text || label ? [newTextLayer(text)] : [newTextLayer("")],
    background: null,
    transition: "fade",
    notes: "",
    groupColor: "#475569",
  };
}

export function newServiceItem(partial: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id: nanoid(10),
    kind: "song",
    title: "Untitled",
    slides: [],
    meta: defaultSongMeta(),
    background: null,
    color: "#3B82F6",
    sourcePath: "",
    ...partial,
  };
}

/**
 * A brand-new document.
 *
 * Deliberately empty — no sample songs, no demo presentation, no placeholder
 * lyrics. An operator opening the app five minutes before a service should see
 * their own service order, not content they have to delete first.
 */
export function emptyShow(): Show {
  return {
    schemaVersion: SHOW_SCHEMA_VERSION,
    title: "Untitled Service",
    items: [],
    media: [],
    fonts: [],
    savedAt: "",
    appVersion: APP_VERSION,
  };
}

/** Human label for a service item kind, used in the queue and empty states. */
export const KIND_LABELS: Record<ServiceItem["kind"], string> = {
  song: "Song",
  presentation: "Presentation",
  media: "Media",
  bible: "Bible",
  announcement: "Announcement",
  web: "Web",
};

export const KIND_COLORS: Record<ServiceItem["kind"], string> = {
  song: "#3B82F6",
  presentation: "#F59E0B",
  media: "#8B5CF6",
  bible: "#10B981",
  announcement: "#EC4899",
  web: "#06B6D4",
};
