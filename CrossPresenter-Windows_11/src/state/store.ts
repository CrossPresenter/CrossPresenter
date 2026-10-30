/**
 * The single application store.
 *
 * Deliberately flat: one store, no context providers, no per-panel state.
 * Components subscribe to the narrowest slice they need, so projecting a slide
 * re-renders the preview and the two affected cards rather than the whole
 * console — which is what keeps the UI at refresh rate while a background video
 * is decoding.
 */

import { nanoid } from "nanoid";
import { create } from "zustand";

import {
  APP_VERSION,
  DEFAULT_TEXT_STYLE,
  KIND_COLORS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  defaultSongMeta,
  emptyShow,
  newServiceItem,
  newSlide,
  newTextLayer,
} from "../lib/defaults";
import {
  closeAllLiveOutputs,
  closeBrowserWindow,
  closeLiveOutput,
  errorMessage,
  exportShow,
  extractPptxSlides,
  importBibleTranslation,
  importShow,
  importSongs,
  listBibleTranslations,
  listProjectionTargets,
  listSongFiles,
  openBrowserWindow,
  openLiveOutput,
  pickBibleFile,
  pickMediaFiles,
  pickPresentations,
  pickShowDestination,
  pickShowToImport,
  pickSongFiles,
  pickSongFolder,
  publishLiveState,
  removeBibleTranslation,
} from "../lib/tauri";
import { createOverlay, overlayElapsedMs } from "../lib/overlays";
import {
  EMPTY_LIVE_STATE,
  type AudioPlayback,
  type Background,
  type BibleTranslationSummary,
  type Deck,
  type Layer,
  type LiveState,
  type MediaAsset,
  type MonitorInfo,
  type Overlay,
  type OverlayKind,
  type ServiceItem,
  type Show,
  type Slide,
  type TextLayer,
  type TextSpan,
  type TextStyle,
  type Transition,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Layout constraints — the spec's numbers, declared once
// ---------------------------------------------------------------------------

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 480;
export const RIGHT_PANEL_WIDTH = 320;
export const DECK_MIN = 120;
export const SERVICE_PANE_MIN = 140;

/** The deck viewer may grow to 60% of the viewport height and no further. */
export const deckMax = (): number => Math.round(window.innerHeight * 0.6);

export type ViewName = "main" | "edit" | "stage" | "bible";

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

/** Character range being edited, so the toolbar can style just the selection. */
export interface TextSelection {
  layerId: string;
  start: number;
  end: number;
}

interface LayoutPrefs {
  sidebarWidth: number;
  /** Height in px of the Service Order pane inside the left sidebar. */
  servicePaneHeight: number;
  /** Height in px of the Media Deck Viewer at the bottom of the workspace. */
  deckHeight: number;
}

const LAYOUT_KEY = "crosspresenter.layout.v1";

const DEFAULT_LAYOUT: LayoutPrefs = {
  sidebarWidth: 288,
  servicePaneHeight: 420,
  deckHeight: 220,
};

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function loadLayout(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutPrefs>;
    return {
      sidebarWidth: clamp(
        parsed.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth,
        SIDEBAR_MIN,
        SIDEBAR_MAX,
      ),
      servicePaneHeight: Math.max(
        SERVICE_PANE_MIN,
        parsed.servicePaneHeight ?? DEFAULT_LAYOUT.servicePaneHeight,
      ),
      deckHeight: Math.max(DECK_MIN, parsed.deckHeight ?? DEFAULT_LAYOUT.deckHeight),
    };
  } catch {
    // A corrupt or unavailable preference store must never stop the app from
    // opening — a service may be about to start.
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(prefs: LayoutPrefs): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(prefs));
  } catch {
    /* Private mode or quota failure: layout simply resets next launch. */
  }
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AppState {
  // Document
  show: Show;
  /** Item whose slides fill the centre grid. */
  activeItemId: string | null;
  /** Slide selected in the grid — not necessarily the live one. */
  selectedSlideId: string | null;
  /** Layer selected on the edit canvas. */
  selectedLayerId: string | null;
  textSelection: TextSelection | null;

  // Live
  live: LiveState;
  liveItemId: string | null;
  liveSlideId: string | null;
  /** Monitor ids with an open projection window. */
  liveMonitors: string[];
  monitors: MonitorInfo[];
  /** Browser-deck asset ids with an open operator-navigation popup. */
  openBrowserAssetIds: string[];
  /** Default transition applied to newly projected slides. */
  transition: Transition;
  /** Audio currently playing over the live output, if any. */
  audioPlayback: AudioPlayback | null;

  // UI
  view: ViewName;
  activeDeck: Deck;
  layout: LayoutPrefs;
  useForAllSlides: boolean;
  busy: string | null;
  toasts: Toast[];
  settingsOpen: boolean;
  bibleOpen: boolean;
  bibleTranslations: BibleTranslationSummary[];

  // History
  past: Show[];
  future: Show[];
}

interface AppActions {
  // Document
  setShowTitle: (title: string) => void;
  addItems: (items: ServiceItem[]) => void;
  removeItem: (itemId: string) => void;
  renameItem: (itemId: string, title: string) => void;
  reorderItems: (fromId: string, toId: string) => void;
  moveItemToIndex: (itemId: string, index: number) => void;
  setActiveItem: (itemId: string | null) => void;
  setItemBackground: (itemId: string, background: Background | null) => void;

  // Slides
  selectSlide: (slideId: string | null) => void;
  addSlide: (afterSlideId?: string) => void;
  duplicateSlide: (slideId: string) => void;
  removeSlide: (slideId: string) => void;
  reorderSlides: (fromId: string, toId: string) => void;
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  setSlideBackground: (slideId: string, background: Background | null) => void;

  // Layers and editing
  selectLayer: (layerId: string | null) => void;
  setTextSelection: (sel: TextSelection | null) => void;
  updateLayer: (slideId: string, layerId: string, patch: Partial<Layer>) => void;
  addTextLayer: (slideId: string) => void;
  removeLayer: (slideId: string, layerId: string) => void;
  /** Drop text layers left empty when focus moves away. */
  pruneEmptyTextLayers: (slideId: string) => void;
  applyTextStyle: (patch: Partial<TextStyle>) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Media pool
  setActiveDeck: (deck: Deck) => void;
  addMedia: (assets: MediaAsset[]) => void;
  removeMedia: (assetId: string) => void;
  addMediaFromPicker: (deck: Deck) => Promise<void>;
  /** Adds every supported song file under a chosen folder to the Songs deck. */
  addSongsFromFolder: () => Promise<void>;
  addWebLink: (url: string, name?: string) => void;
  /** Opens (or closes) the interactive operator-navigation popup for a Browser-deck asset. */
  toggleBrowserWindow: (asset: MediaAsset) => Promise<void>;
  /** Turns a Graphics-deck presentation asset into a Service Order item, extracting real slide text via Rust. */
  addPresentationItem: (asset: MediaAsset) => Promise<void>;
  /**
   * Adds an asset to the slide deck below the workspace — never straight to
   * air. Images/videos become a new slide on the active item; presentations and
   * Song-deck files expand into a new Service Order item.
   */
  insertMediaIntoSlides: (asset: MediaAsset) => Promise<void>;

  // Live control
  refreshMonitors: () => Promise<void>;
  goLive: () => Promise<void>;
  stopLive: () => Promise<void>;
  toggleMonitor: (monitorId: string) => Promise<void>;
  projectSlide: (itemId: string, slideId: string) => void;
  projectMedia: (asset: MediaAsset) => void;
  projectWeb: (url: string) => void;
  /** Projects an already-built slide (e.g. a Bible verse) without touching the Home selection. */
  projectAdHocSlide: (slide: Slide) => void;
  advanceSlide: (delta: number) => void;
  setTransition: (t: Transition) => void;
  toggleBlack: () => void;
  toggleClearText: () => void;
  toggleClearBackground: () => void;
  clearLive: () => void;
  republishLive: () => void;

  // Audio — plays in the operator window, never rendered to a projector
  playAudioAsset: (asset: MediaAsset) => void;
  stopAudio: () => void;
  toggleAudioLoop: () => void;

  // Overlays — timers, clock, messages, logo, layered above every slide
  addOverlay: (kind: OverlayKind) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  startOverlayTimer: (id: string) => void;
  pauseOverlayTimer: (id: string) => void;
  resetOverlayTimer: (id: string) => void;

  // UI
  setView: (view: ViewName) => void;
  setSidebarWidth: (px: number) => void;
  setServicePaneHeight: (px: number) => void;
  setDeckHeight: (px: number) => void;
  setUseForAllSlides: (on: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setBibleOpen: (open: boolean) => void;
  toast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: string) => void;

  // Bible module
  refreshBibleTranslations: () => Promise<void>;
  importBibleFromPicker: () => Promise<void>;
  removeInstalledBibleTranslation: (id: string) => Promise<void>;

  // Files
  importSongsFromPicker: (folder: boolean) => Promise<void>;
  importPresentationsFromPicker: () => Promise<void>;
  exportShowFile: () => Promise<void>;
  importShowFile: () => Promise<void>;
  loadShow: (show: Show) => void;
}

export type Store = AppState & AppActions;

const HISTORY_LIMIT = 120;

export const useStore = create<Store>((set, get) => ({
  // -----------------------------------------------------------------------
  // Initial state — an empty document, no sample content
  // -----------------------------------------------------------------------
  show: emptyShow(),
  activeItemId: null,
  selectedSlideId: null,
  selectedLayerId: null,
  textSelection: null,

  live: EMPTY_LIVE_STATE,
  liveItemId: null,
  liveSlideId: null,
  liveMonitors: [],
  monitors: [],
  openBrowserAssetIds: [],
  transition: "fade",
  audioPlayback: null,

  view: "main",
  activeDeck: "media",
  layout: loadLayout(),
  useForAllSlides: false,
  busy: null,
  toasts: [],
  settingsOpen: false,
  bibleOpen: false,
  bibleTranslations: [],

  past: [],
  future: [],

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------
  pushHistory: () => {
    const { show, past } = get();
    // Whole-document snapshots. A service document holds text and asset paths,
    // never pixels, so snapshotting is cheaper than maintaining inverse patches
    // for every edit path — and it cannot drift out of sync.
    const next = [...past, show];
    set({
      past: next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next,
      future: [],
    });
  },

  undo: () => {
    const { past, future, show } = get();
    if (past.length === 0) return;
    set({
      show: past[past.length - 1],
      past: past.slice(0, -1),
      future: [show, ...future].slice(0, HISTORY_LIMIT),
    });
    reconcileSelection(set, get);
  },

  redo: () => {
    const { past, future, show } = get();
    if (future.length === 0) return;
    set({
      show: future[0],
      past: [...past, show].slice(-HISTORY_LIMIT),
      future: future.slice(1),
    });
    reconcileSelection(set, get);
  },

  // -----------------------------------------------------------------------
  // Document
  // -----------------------------------------------------------------------
  setShowTitle: (title) => set((s) => ({ show: { ...s.show, title } })),

  addItems: (items) => {
    if (items.length === 0) return;
    get().pushHistory();
    set((s) => ({
      show: { ...s.show, items: [...s.show.items, ...items] },
      activeItemId: s.activeItemId ?? items[0].id,
      selectedSlideId: s.selectedSlideId ?? items[0].slides[0]?.id ?? null,
    }));
  },

  removeItem: (itemId) => {
    get().pushHistory();
    set((s) => {
      const items = s.show.items.filter((i) => i.id !== itemId);
      const wasActive = s.activeItemId === itemId;
      const nextActive = wasActive ? items[0]?.id ?? null : s.activeItemId;
      return {
        show: { ...s.show, items },
        activeItemId: nextActive,
        selectedSlideId: wasActive
          ? items.find((i) => i.id === nextActive)?.slides[0]?.id ?? null
          : s.selectedSlideId,
      };
    });
    // Deleting the on-air item must not leave a stale frame on the projector.
    // Lift it back to a blank stage and broadcast the change so every live
    // window follows even if no further click ever comes.
    if (get().liveItemId === itemId) {
      get().clearLive();
      get().republishLive();
      publishLiveState(get().live);
    }
  },

  renameItem: (itemId, title) => {
    get().pushHistory();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((i) => (i.id === itemId ? { ...i, title } : i)),
      },
    }));
  },

  reorderItems: (fromId, toId) => {
    if (fromId === toId) return;
    const to = get().show.items.findIndex((i) => i.id === toId);
    if (to < 0) return;
    get().moveItemToIndex(fromId, to);
  },

  moveItemToIndex: (itemId, index) => {
    const items = get().show.items;
    const from = items.findIndex((i) => i.id === itemId);
    if (from < 0) return;
    const target = clamp(index, 0, items.length - 1);
    if (from === target) return;
    get().pushHistory();
    set((s) => {
      const next = [...s.show.items];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return { show: { ...s.show, items: next } };
    });
  },

  setActiveItem: (itemId) =>
    set((s) => ({
      activeItemId: itemId,
      selectedSlideId: s.show.items.find((i) => i.id === itemId)?.slides[0]?.id ?? null,
      selectedLayerId: null,
      textSelection: null,
    })),

  setItemBackground: (itemId, background) => {
    get().pushHistory();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((i) => (i.id === itemId ? { ...i, background } : i)),
      },
    }));
    // A background change to the live item must be visible immediately.
    if (get().liveItemId === itemId) get().republishLive();
  },

  // -----------------------------------------------------------------------
  // Slides
  // -----------------------------------------------------------------------
  selectSlide: (slideId) =>
    set({ selectedSlideId: slideId, selectedLayerId: null, textSelection: null }),

  addSlide: (afterSlideId) => {
    const { activeItemId } = get();
    if (!activeItemId) return;
    get().pushHistory();
    const slide = newSlide();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => {
          if (item.id !== activeItemId) return item;
          const slides = [...item.slides];
          const at = afterSlideId ? slides.findIndex((sl) => sl.id === afterSlideId) : -1;
          if (at >= 0) slides.splice(at + 1, 0, slide);
          else slides.push(slide);
          return { ...item, slides };
        }),
      },
      selectedSlideId: slide.id,
      selectedLayerId: slide.layers[0]?.id ?? null,
    }));
  },

  duplicateSlide: (slideId) => {
    const { activeItemId } = get();
    if (!activeItemId) return;
    get().pushHistory();
    let newId: string | null = null;
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => {
          if (item.id !== activeItemId) return item;
          const at = item.slides.findIndex((sl) => sl.id === slideId);
          if (at < 0) return item;
          const copy = cloneSlide(item.slides[at]);
          newId = copy.id;
          const slides = [...item.slides];
          slides.splice(at + 1, 0, copy);
          return { ...item, slides };
        }),
      },
    }));
    if (newId) set({ selectedSlideId: newId });
  },

  removeSlide: (slideId) => {
    const { activeItemId } = get();
    if (!activeItemId) return;
    get().pushHistory();
    set((s) => {
      let nextSelected = s.selectedSlideId;
      const items = s.show.items.map((item) => {
        if (item.id !== activeItemId) return item;
        const at = item.slides.findIndex((sl) => sl.id === slideId);
        if (at < 0) return item;
        const slides = item.slides.filter((sl) => sl.id !== slideId);
        if (s.selectedSlideId === slideId) {
          nextSelected = slides[Math.min(at, slides.length - 1)]?.id ?? null;
        }
        return { ...item, slides };
      });
      return { show: { ...s.show, items }, selectedSlideId: nextSelected };
    });
  },

  reorderSlides: (fromId, toId) => {
    const { activeItemId } = get();
    if (!activeItemId || fromId === toId) return;
    get().pushHistory();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => {
          if (item.id !== activeItemId) return item;
          const from = item.slides.findIndex((sl) => sl.id === fromId);
          const to = item.slides.findIndex((sl) => sl.id === toId);
          if (from < 0 || to < 0) return item;
          const slides = [...item.slides];
          const [moved] = slides.splice(from, 1);
          slides.splice(to, 0, moved);
          return { ...item, slides };
        }),
      },
    }));
  },

  updateSlide: (slideId, patch) => {
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => ({
          ...item,
          slides: item.slides.map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
        })),
      },
    }));
    if (get().liveSlideId === slideId) get().republishLive();
  },

  setSlideBackground: (slideId, background) => {
    get().pushHistory();
    get().updateSlide(slideId, { background });
  },

  // -----------------------------------------------------------------------
  // Layers
  // -----------------------------------------------------------------------
  selectLayer: (layerId) => set({ selectedLayerId: layerId, textSelection: null }),

  setTextSelection: (sel) => set({ textSelection: sel }),

  updateLayer: (slideId, layerId, patch) => {
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => ({
          ...item,
          slides: item.slides.map((sl) =>
            sl.id !== slideId
              ? sl
              : {
                  ...sl,
                  layers: sl.layers.map((l) =>
                    l.id === layerId ? ({ ...l, ...patch } as Layer) : l,
                  ),
                },
          ),
        })),
      },
    }));
    if (get().liveSlideId === slideId) get().republishLive();
  },

  addTextLayer: (slideId) => {
    get().pushHistory();
    const layer = newTextLayer("");
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => ({
          ...item,
          slides: item.slides.map((sl) =>
            sl.id === slideId ? { ...sl, layers: [...sl.layers, layer] } : sl,
          ),
        })),
      },
      selectedLayerId: layer.id,
    }));
  },

  removeLayer: (slideId, layerId) => {
    get().pushHistory();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => ({
          ...item,
          slides: item.slides.map((sl) =>
            sl.id === slideId ? { ...sl, layers: sl.layers.filter((l) => l.id !== layerId) } : sl,
          ),
        })),
      },
      selectedLayerId: null,
    }));
  },

  pruneEmptyTextLayers: (slideId) => {
    const slide = get()
      .show.items.flatMap((i) => i.slides)
      .find((sl) => sl.id === slideId);
    if (!slide) return;

    const survivors = slide.layers.filter((l) => l.type !== "text" || l.text.trim().length > 0);
    if (survivors.length === slide.layers.length) return;

    // Never strip the last layer: a slide with nothing on it cannot be typed
    // into again, which would trap the operator.
    const layers = survivors.length > 0 ? survivors : [newTextLayer("")];
    get().updateSlide(slideId, { layers });
    set((s) => ({
      selectedLayerId: layers.some((l) => l.id === s.selectedLayerId) ? s.selectedLayerId : null,
      textSelection: null,
    }));
  },

  /**
   * Apply a typography patch, following the toolbar's three-way precedence:
   *
   *   1. "Use for all slides" on → every text box on every slide of the item.
   *   2. A non-empty selection   → a styled span over just those characters.
   *   3. Otherwise               → the whole selected text box.
   */
  applyTextStyle: (rawPatch) => {
    const { activeItemId, selectedSlideId, selectedLayerId, textSelection, useForAllSlides } =
      get();
    if (!activeItemId) return;

    const patch =
      rawPatch.fontSize !== undefined
        ? { ...rawPatch, fontSize: clamp(rawPatch.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE) }
        : rawPatch;

    get().pushHistory();

    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((item) => {
          if (item.id !== activeItemId) return item;
          return {
            ...item,
            slides: item.slides.map((slide) => {
              if (!useForAllSlides && slide.id !== selectedSlideId) return slide;
              return {
                ...slide,
                layers: slide.layers.map((layer) => {
                  if (layer.type !== "text") return layer;
                  // Scoped mode targets one box; "all slides" mode targets every
                  // box, so one font change restyles the whole song.
                  if (!useForAllSlides && selectedLayerId && layer.id !== selectedLayerId) {
                    return layer;
                  }
                  const spanMode =
                    !useForAllSlides &&
                    textSelection !== null &&
                    textSelection.layerId === layer.id &&
                    textSelection.end > textSelection.start;

                  if (spanMode && textSelection) {
                    return applySpan(layer, textSelection.start, textSelection.end, patch);
                  }
                  // Restyling the whole box makes narrower span overrides for the
                  // same properties stale, so those keys are dropped.
                  return {
                    ...layer,
                    style: { ...layer.style, ...patch },
                    spans: stripSpanKeys(layer.spans, patch),
                  };
                }),
              };
            }),
          };
        }),
      },
    }));

    get().republishLive();
  },

  // -----------------------------------------------------------------------
  // Media pool
  // -----------------------------------------------------------------------
  setActiveDeck: (deck) => set({ activeDeck: deck }),

  addMedia: (assets) => {
    if (assets.length === 0) return;
    set((s) => {
      // Re-adding the same file should not duplicate the tile.
      const existing = new Set(s.show.media.map((m) => `${m.deck}::${m.path}`));
      const fresh = assets.filter((a) => !existing.has(`${a.deck}::${a.path}`));
      if (fresh.length === 0) return s;
      return { show: { ...s.show, media: [...s.show.media, ...fresh] } };
    });
  },

  removeMedia: (assetId) => {
    if (get().openBrowserAssetIds.includes(assetId)) {
      // Fire-and-forget, but observed: a rejected promise here must land in the
      // console instead of becoming an unhandled rejection the crash overlay
      // would treat as fatal.
      closeBrowserWindow(assetId).catch((err) => {
        console.warn("close_browser_window failed", err);
      });
      set((s) => ({ openBrowserAssetIds: s.openBrowserAssetIds.filter((id) => id !== assetId) }));
    }
    set((s) => ({
      show: { ...s.show, media: s.show.media.filter((m) => m.id !== assetId) },
    }));
  },

  addMediaFromPicker: async (deck) => {
    try {
      const paths =
        deck === "songs"
          ? await pickSongFiles()
          : deck === "graphics"
            ? await pickPresentations()
            : await pickMediaFiles();
      if (paths.length === 0) return;
      get().addMedia(paths.map((p) => assetFromPath(p, deck)));
      get().toast("success", `Added ${paths.length} item${paths.length === 1 ? "" : "s"}`);
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  /**
   * Whole-library import for the Songs deck: point at a folder, walk it, and
   * put one tile per song file in the Songs tab. Nothing is added to the
   * service order — the operator still chooses which song to open.
   */
  addSongsFromFolder: async () => {
    try {
      const picked = await pickSongFolder();
      if (picked.length === 0) return;
      set({ busy: "Reading song folder…" });
      const paths = await listSongFiles(picked);
      if (paths.length === 0) {
        get().toast("info", "No song files found in that folder.");
        return;
      }
      get().addMedia(paths.map((p) => assetFromPath(p, "songs")));
      get().toast(
        "success",
        `Added ${paths.length} song file${paths.length === 1 ? "" : "s"} to the Songs tab`,
      );
    } catch (err) {
      get().toast("error", errorMessage(err));
    } finally {
      set({ busy: null });
    }
  },

  addWebLink: (url, name) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalised = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    get().addMedia([
      {
        id: nanoid(10),
        deck: "browser",
        kind: "url",
        name: name?.trim() || hostOf(normalised),
        path: normalised,
        thumbnail: "",
        width: 0,
        height: 0,
        durationSeconds: 0,
        sizeBytes: 0,
      },
    ]);
  },

  toggleBrowserWindow: async (asset) => {
    if (asset.kind !== "url") return;
    const { openBrowserAssetIds } = get();
    try {
      if (openBrowserAssetIds.includes(asset.id)) {
        await closeBrowserWindow(asset.id);
        set({ openBrowserAssetIds: openBrowserAssetIds.filter((id) => id !== asset.id) });
      } else {
        await openBrowserWindow(asset.path, asset.id);
        set({ openBrowserAssetIds: [...openBrowserAssetIds, asset.id] });
      }
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  addPresentationItem: async (asset) => {
    const item: ServiceItem = {
      id: nanoid(10),
      kind: "presentation",
      title: asset.name,
      slides: [],
      meta: defaultSongMeta(),
      background: null,
      color: KIND_COLORS.presentation,
      sourcePath: asset.path,
    };
    set({ busy: "Reading slides…" });
    try {
      item.slides = await extractPptxSlides(asset.path);
      if (item.slides.length === 0) {
        get().toast("error", `"${asset.name}" contains no slides CrossPresenter can read.`);
        return;
      }
    } catch (err) {
      get().toast("error", `Could not read slides from "${asset.name}": ${errorMessage(err)}`);
      return;
    } finally {
      set({ busy: null });
    }
    get().addItems([item]);
    // Show the new deck in the slide grid immediately — but leave it off air;
    // going live stays an explicit click on a slide.
    set({
      activeItemId: item.id,
      selectedSlideId: item.slides[0]?.id ?? null,
      selectedLayerId: null,
    });
  },

  insertMediaIntoSlides: async (asset) => {
    // Songs-deck tiles are containers. Opening a single song expands it into
    // editable service items in the order — it never touches the live output.
    // A folder tile is different: it belongs to the Songs tab, so it expands
    // into individual song tiles there and leaves the service order alone.
    if (asset.deck === "songs") {
      if (PRESENTATION_EXT.test(asset.path)) {
        await get().addPresentationItem(asset);
        return;
      }
      set({ busy: "Reading song…" });
      try {
        const files = await listSongFiles([asset.path]);
        const isFolder = files.length > 1 || (files.length === 1 && files[0] !== asset.path);
        if (isFolder) {
          get().addMedia(files.map((p) => assetFromPath(p, "songs")));
          get().removeMedia(asset.id);
          set({ activeDeck: "songs" });
          get().toast(
            "success",
            `Added ${files.length} song${files.length === 1 ? "" : "s"} to the Songs tab`,
          );
          return;
        }
        const report = await importSongs([asset.path]);
        if (report.items.length === 0) {
          const reason = report.errors[0];
          get().toast(
            "error",
            reason ? `${reason.path}: ${reason.message}` : `No songs found in "${asset.name}".`,
          );
          return;
        }
        get().addItems(report.items);
        const first = report.items[0];
        set({
          activeItemId: first.id,
          selectedSlideId: first.slides[0]?.id ?? null,
          selectedLayerId: null,
        });
        get().toast(
          "success",
          `Added ${report.items.length === 1 ? `"${first.title}"` : `${report.items.length} songs`} to the service order`,
        );
      } catch (err) {
        get().toast("error", errorMessage(err));
      } finally {
        set({ busy: null });
      }
      return;
    }

    if (asset.kind === "presentation") {
      await get().addPresentationItem(asset);
      return;
    }

    if (asset.kind === "audio") {
      get().playAudioAsset(asset);
      return;
    }

    if (asset.kind === "url") {
      const item = newServiceItem({
        kind: "web",
        title: asset.name,
        sourcePath: asset.path,
        color: KIND_COLORS.web,
      });
      get().addItems([item]);
      set({ activeItemId: item.id, selectedSlideId: null, selectedLayerId: null });
      return;
    }

    const background: Background =
      asset.kind === "video"
        ? { kind: "video", src: asset.path, fit: "cover", loopPlayback: true, muted: true }
        : { kind: "image", src: asset.path, fit: "cover" };

    const slide: Slide = {
      id: nanoid(10),
      label: asset.name,
      layers: [],
      background,
      transition: get().transition,
      notes: "",
      groupColor: KIND_COLORS.media,
    };

    const { activeItemId, show } = get();
    const target = activeItemId ? show.items.find((i) => i.id === activeItemId) : undefined;

    // A web item has no slide lane to append to, so media starts a deck of its
    // own rather than being silently swallowed.
    if (!target || target.kind === "web") {
      const item = newServiceItem({
        kind: "media",
        title: asset.name,
        slides: [slide],
        sourcePath: asset.path,
        color: KIND_COLORS.media,
      });
      get().addItems([item]);
      set({ activeItemId: item.id, selectedSlideId: slide.id, selectedLayerId: null });
      get().toast("info", `"${asset.name}" added as a new slide deck`);
      return;
    }

    get().pushHistory();
    set((s) => ({
      show: {
        ...s.show,
        items: s.show.items.map((i) =>
          i.id === target.id ? { ...i, slides: [...i.slides, slide] } : i,
        ),
      },
      selectedSlideId: slide.id,
      selectedLayerId: null,
    }));
    get().toast("info", `"${asset.name}" added to the slide grid`);
  },

  // -----------------------------------------------------------------------
  // Live control
  // -----------------------------------------------------------------------
  refreshMonitors: async () => {
    try {
      set({ monitors: await listProjectionTargets() });
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  goLive: async () => {
    if (get().liveMonitors.length > 0) {
      await get().stopLive();
      return;
    }
    let targets: MonitorInfo[];
    try {
      targets = await listProjectionTargets();
      set({ monitors: targets });
    } catch (err) {
      get().toast("error", errorMessage(err));
      return;
    }
    if (targets.length === 0) {
      get().toast(
        "error",
        "No second display found. Connect a projector or extend your desktop, then try again.",
      );
      return;
    }

    // Every monitor is attempted even if one fails, so a single wedged display
    // cannot leave the rest of the rig dark. Monitors that came up are still
    // tracked, which means closing live later can reach every window we created.
    const opened: string[] = [];
    const failures: string[] = [];
    for (const monitor of targets) {
      try {
        await openLiveOutput(monitor.id);
        opened.push(monitor.id);
      } catch (err) {
        failures.push(`${monitor.name}: ${errorMessage(err)}`);
      }
    }

    if (opened.length === 0) {
      get().toast(
        "error",
        failures.length > 0
          ? `Could not start live output — ${failures.join("; ")}`
          : "Could not start live output.",
      );
      return;
    }

    set({ liveMonitors: opened });
    // New windows mount with no state of their own, so send them one.
    get().republishLive();
    publishLiveState(get().live);

    if (failures.length > 0) {
      get().toast(
        "error",
        `Live on ${opened.length} display${opened.length === 1 ? "" : "s"} — could not open: ${failures.join("; ")}`,
      );
    } else {
      get().toast("success", `Live on ${opened.length} display${opened.length === 1 ? "" : "s"}`);
    }
  },

  stopLive: async () => {
    try {
      await closeAllLiveOutputs();
      set({ liveMonitors: [] });
      get().toast("info", "Live output closed");
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  toggleMonitor: async (monitorId) => {
    const { liveMonitors } = get();
    try {
      if (liveMonitors.includes(monitorId)) {
        await closeLiveOutput(monitorId);
        set({ liveMonitors: liveMonitors.filter((m) => m !== monitorId) });
      } else {
        await openLiveOutput(monitorId);
        set({ liveMonitors: [...liveMonitors, monitorId] });
        publishLiveState(get().live);
      }
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  projectSlide: (itemId, slideId) => {
    const item = get().show.items.find((i) => i.id === itemId);
    const slide = item?.slides.find((sl) => sl.id === slideId);
    if (!item || !slide) return;

    set((s) => ({
      liveItemId: itemId,
      liveSlideId: slideId,
      activeItemId: itemId,
      selectedSlideId: slideId,
      live: {
        slide,
        itemBackground: item.background,
        // Projecting is an affirmative action, so it lifts any blank state: an
        // operator who left the output black does not click a slide and see
        // nothing happen.
        textCleared: false,
        backgroundCleared: false,
        black: false,
        transition: slide.transition ?? s.transition,
        webUrl: null,
        overlays: s.live.overlays,
      },
    }));
  },

  projectMedia: (asset) => {
    // Audio has no pixels: it plays over the current slide instead of replacing
    // it, exactly like a ProPresenter audio layer.
    if (asset.kind === "audio") {
      get().playAudioAsset(asset);
      return;
    }

    const background: Background =
      asset.kind === "video"
        ? { kind: "video", src: asset.path, fit: "cover", loopPlayback: true, muted: true }
        : { kind: "image", src: asset.path, fit: "cover" };

    // Media projects as a background-only slide with no text layers, so it fills
    // the screen without inheriting the previous song's typography.
    const slide: Slide = {
      id: `media-${asset.id}`,
      label: asset.name,
      layers: [],
      background,
      transition: get().transition,
      notes: "",
      groupColor: "#8B5CF6",
    };

    set((s) => ({
      liveItemId: null,
      liveSlideId: slide.id,
      live: {
        slide,
        itemBackground: null,
        textCleared: false,
        backgroundCleared: false,
        black: false,
        transition: s.transition,
        webUrl: null,
        overlays: s.live.overlays,
      },
    }));
  },

  projectWeb: (url) =>
    set((s) => ({
      liveItemId: null,
      liveSlideId: null,
      live: {
        slide: null,
        itemBackground: null,
        textCleared: false,
        backgroundCleared: false,
        black: false,
        transition: s.transition,
        webUrl: url,
        overlays: s.live.overlays,
      },
    })),

  projectAdHocSlide: (slide) =>
    set((s) => ({
      liveItemId: null,
      liveSlideId: slide.id,
      live: {
        slide,
        itemBackground: null,
        textCleared: false,
        backgroundCleared: false,
        black: false,
        transition: slide.transition ?? s.transition,
        webUrl: null,
        overlays: s.live.overlays,
      },
    })),

  advanceSlide: (delta) => {
    const { liveItemId, liveSlideId, show, activeItemId, selectedSlideId } = get();
    // Advance whatever is live; before the first project, advance the selection
    // instead so the same keys work from the start.
    const itemId = liveItemId ?? activeItemId;
    const fromSlide = liveSlideId ?? selectedSlideId;
    const item = show.items.find((i) => i.id === itemId);
    if (!item) return;

    const at = item.slides.findIndex((sl) => sl.id === fromSlide);
    const next = at + delta;

    if (next >= 0 && next < item.slides.length) {
      get().projectSlide(item.id, item.slides[next].id);
      return;
    }

    // Past either end, roll into the neighbouring service item — this is how an
    // operator walks a whole service with one key.
    const itemAt = show.items.findIndex((i) => i.id === item.id);
    const neighbour = show.items[itemAt + delta];
    if (!neighbour || neighbour.slides.length === 0) return;
    const landing = delta > 0 ? neighbour.slides[0] : neighbour.slides[neighbour.slides.length - 1];
    get().projectSlide(neighbour.id, landing.id);
  },

  setTransition: (t) => set((s) => ({ transition: t, live: { ...s.live, transition: t } })),

  toggleBlack: () => set((s) => ({ live: { ...s.live, black: !s.live.black } })),

  toggleClearText: () => set((s) => ({ live: { ...s.live, textCleared: !s.live.textCleared } })),

  toggleClearBackground: () =>
    set((s) => ({ live: { ...s.live, backgroundCleared: !s.live.backgroundCleared } })),

  clearLive: () =>
    set((s) => ({
      liveItemId: null,
      liveSlideId: null,
      // Overlays are stage furniture, not document content: clearing the screen
      // must not silently stop the countdown or hide the logo.
      live: { ...EMPTY_LIVE_STATE, transition: s.transition, overlays: s.live.overlays },
      audioPlayback: null,
    })),

  republishLive: () => {
    // Rebuild the live payload from the document, so an edit to the on-air slide
    // reaches the output without the operator re-clicking it.
    const { liveItemId, liveSlideId, show, live } = get();
    if (!liveSlideId) return;
    const item = liveItemId ? show.items.find((i) => i.id === liveItemId) : undefined;
    const slide = item?.slides.find((sl) => sl.id === liveSlideId) ?? live.slide;
    set({
      live: {
        ...live,
        slide: slide ?? null,
        itemBackground: item ? item.background : live.itemBackground,
      },
    });
  },

  playAudioAsset: (asset) =>
    set((s) => ({
      audioPlayback: {
        assetId: asset.id,
        name: asset.name,
        path: asset.path,
        // Re-clicking the same track restarts it; its loop preference survives.
        loop: s.audioPlayback?.assetId === asset.id ? s.audioPlayback.loop : false,
        startedAt: Date.now(),
      },
    })),

  stopAudio: () => set({ audioPlayback: null }),

  toggleAudioLoop: () =>
    set((s) =>
      s.audioPlayback
        ? { audioPlayback: { ...s.audioPlayback, loop: !s.audioPlayback.loop } }
        : {},
    ),

  // -----------------------------------------------------------------------
  // Overlays
  // -----------------------------------------------------------------------
  addOverlay: (kind) =>
    set((s) => ({
      live: { ...s.live, overlays: [...s.live.overlays, createOverlay(kind, nanoid(8))] },
    })),

  updateOverlay: (id, patch) =>
    set((s) => ({
      live: {
        ...s.live,
        overlays: s.live.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)),
      },
    })),

  removeOverlay: (id) =>
    set((s) => ({
      live: { ...s.live, overlays: s.live.overlays.filter((o) => o.id !== id) },
    })),

  startOverlayTimer: (id) =>
    set((s) => ({
      live: {
        ...s.live,
        overlays: s.live.overlays.map((o) => {
          if (o.id !== id || o.kind !== "timer" || o.startedAt != null) return o;
          // A finished countdown starts again from full: pressing Start on a
          // 00:00 timer should do the obvious thing, not nothing.
          const finished = o.mode === "countdown" && overlayElapsedMs(o, Date.now()) >= o.durationMs;
          return { ...o, startedAt: Date.now(), accumulatedMs: finished ? 0 : o.accumulatedMs };
        }),
      },
    })),

  pauseOverlayTimer: (id) =>
    set((s) => ({
      live: {
        ...s.live,
        overlays: s.live.overlays.map((o) => {
          if (o.id !== id || o.kind !== "timer" || o.startedAt == null) return o;
          return { ...o, accumulatedMs: overlayElapsedMs(o, Date.now()), startedAt: null };
        }),
      },
    })),

  resetOverlayTimer: (id) =>
    set((s) => ({
      live: {
        ...s.live,
        overlays: s.live.overlays.map((o) =>
          o.id === id && o.kind === "timer" ? { ...o, startedAt: null, accumulatedMs: 0 } : o,
        ),
      },
    })),

  // -----------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------
  setView: (view) => set({ view }),

  setSidebarWidth: (px) =>
    set((s) => {
      const layout = { ...s.layout, sidebarWidth: clamp(px, SIDEBAR_MIN, SIDEBAR_MAX) };
      saveLayout(layout);
      return { layout };
    }),

  setServicePaneHeight: (px) =>
    set((s) => {
      const layout = { ...s.layout, servicePaneHeight: Math.max(SERVICE_PANE_MIN, px) };
      saveLayout(layout);
      return { layout };
    }),

  setDeckHeight: (px) =>
    set((s) => {
      const layout = { ...s.layout, deckHeight: clamp(px, DECK_MIN, deckMax()) };
      saveLayout(layout);
      return { layout };
    }),

  setUseForAllSlides: (on) => set({ useForAllSlides: on }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setBibleOpen: (open) => set({ bibleOpen: open }),

  toast: (kind, message) => {
    const id = nanoid(8);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    // Errors stay until dismissed — the operator may not be looking at the
    // screen when one lands.
    if (kind !== "error") {
      window.setTimeout(() => get().dismissToast(id), 3200);
    }
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // -----------------------------------------------------------------------
  // Bible module
  // -----------------------------------------------------------------------
  refreshBibleTranslations: async () => {
    try {
      const translations = await listBibleTranslations();
      set({ bibleTranslations: translations });
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  importBibleFromPicker: async () => {
    try {
      const path = await pickBibleFile();
      if (!path) return;
      set({ busy: "Importing Bible translation…" });
      const summary = await importBibleTranslation(path);
      set((s) => ({
        bibleTranslations: [...s.bibleTranslations, summary].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
      get().toast("success", `Imported ${summary.name} · ${summary.bookCount} books`);
    } catch (err) {
      get().toast("error", errorMessage(err));
    } finally {
      set({ busy: null });
    }
  },

  removeInstalledBibleTranslation: async (id) => {
    try {
      await removeBibleTranslation(id);
      set((s) => ({ bibleTranslations: s.bibleTranslations.filter((t) => t.id !== id) }));
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  // -----------------------------------------------------------------------
  // Files
  // -----------------------------------------------------------------------
  importSongsFromPicker: async (folder) => {
    try {
      const paths = folder ? await pickSongFolder() : await pickSongFiles();
      if (paths.length === 0) return;
      set({ busy: "Importing songs…" });
      const report = await importSongs(paths);
      get().addItems(report.items);
      get().toast(
        report.errors.length > 0 ? "info" : "success",
        `Imported ${report.songsImported} song${report.songsImported === 1 ? "" : "s"}` +
          (report.errors.length > 0 ? ` · ${report.errors.length} file(s) unreadable` : ""),
      );
      // Surface the actual reason, not just a count.
      if (report.errors.length > 0) {
        get().toast("error", `${report.errors[0].path}: ${report.errors[0].message}`);
      }
    } catch (err) {
      get().toast("error", errorMessage(err));
    } finally {
      set({ busy: null });
    }
  },

  importPresentationsFromPicker: async () => {
    try {
      const paths = await pickPresentations();
      if (paths.length === 0) return;
      get().addMedia(paths.map((p) => assetFromPath(p, "graphics")));
      get().toast("success", `Added ${paths.length} presentation${paths.length === 1 ? "" : "s"}`);
    } catch (err) {
      get().toast("error", errorMessage(err));
    }
  },

  exportShowFile: async () => {
    try {
      const { show } = get();
      const dest = await pickShowDestination(show.title);
      if (!dest) return;
      set({ busy: "Exporting…" });
      const payload: Show = {
        ...show,
        savedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
      };
      const report = await exportShow(payload, dest);
      const mb = (report.bytesWritten / (1024 * 1024)).toFixed(1);
      get().toast("success", `Exported ${mb} MB · ${report.mediaEmbedded} media file(s)`);
      if (report.missingAssets.length > 0) {
        get().toast(
          "error",
          `${report.missingAssets.length} asset(s) were missing and not embedded — first: ${report.missingAssets[0]}`,
        );
      }
    } catch (err) {
      get().toast("error", errorMessage(err));
    } finally {
      set({ busy: null });
    }
  },

  importShowFile: async () => {
    try {
      const path = await pickShowToImport();
      if (!path) return;
      set({ busy: "Opening show…" });
      const report = await importShow(path);
      get().loadShow(report.show);
      get().toast(
        "success",
        `Opened "${report.show.title}" · ${report.mediaExtracted} media file(s)`,
      );
    } catch (err) {
      get().toast("error", errorMessage(err));
    } finally {
      set({ busy: null });
    }
  },

  loadShow: (show) =>
    set((s) => ({
      show,
      past: [],
      future: [],
      activeItemId: show.items[0]?.id ?? null,
      selectedSlideId: show.items[0]?.slides[0]?.id ?? null,
      selectedLayerId: null,
      textSelection: null,
      liveItemId: null,
      liveSlideId: null,
      // Opening a document does not stop the service clock, but audio belongs
      // to the service that was just closed.
      live: { ...EMPTY_LIVE_STATE, overlays: s.live.overlays },
      audioPlayback: null,
    })),
}));

// ---------------------------------------------------------------------------
// Live broadcast bridge
// ---------------------------------------------------------------------------

/**
 * Push `live` to the projection windows whenever it changes.
 *
 * A subscription rather than a call inside each action, so there is exactly one
 * place that talks to the output: no action can forget to broadcast, and none
 * can broadcast twice for one change.
 */
let lastPublished: LiveState | null = null;
useStore.subscribe((state) => {
  if (state.live === lastPublished) return;
  lastPublished = state.live;
  publishLiveState(state.live);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneSlide(slide: Slide): Slide {
  return {
    ...slide,
    id: nanoid(10),
    layers: slide.layers.map((l) => ({ ...l, id: nanoid(10), rect: { ...l.rect } }) as Layer),
  };
}

/** After undo/redo the previously selected ids may no longer exist. */
function reconcileSelection(
  set: (partial: Partial<Store>) => void,
  get: () => Store,
): void {
  const { show, activeItemId, selectedSlideId } = get();
  const item = show.items.find((i) => i.id === activeItemId) ?? show.items[0];
  const slide = item?.slides.find((sl) => sl.id === selectedSlideId) ?? item?.slides[0];
  set({
    activeItemId: item?.id ?? null,
    selectedSlideId: slide?.id ?? null,
    selectedLayerId: null,
    textSelection: null,
  });
  get().republishLive();
}

/**
 * Write a style patch as a span override across `[start, end)`, splitting any
 * existing span that straddles the boundary so overlapping edits compose
 * instead of clobbering one another.
 */
function applySpan(
  layer: TextLayer,
  start: number,
  end: number,
  patch: Partial<TextStyle>,
): TextLayer {
  const override = spanOverrideFrom(patch);
  if (Object.keys(override).length === 0) {
    // Alignment, line height and the like are box-level properties with no span
    // equivalent, so apply them to the box rather than silently dropping them.
    return { ...layer, style: { ...layer.style, ...patch } };
  }

  const next: TextSpan[] = [];
  for (const span of layer.spans) {
    if (span.end <= start || span.start >= end) {
      next.push(span);
      continue;
    }
    // Keep the parts of the old span that fall outside the new range.
    if (span.start < start) next.push({ ...span, end: start });
    if (span.end > end) next.push({ ...span, start: end });
    // The overlapping middle survives with the new override merged in.
    const overlapStart = Math.max(span.start, start);
    const overlapEnd = Math.min(span.end, end);
    if (overlapEnd > overlapStart) {
      next.push({ ...span, start: overlapStart, end: overlapEnd, ...override });
    }
  }

  // Cover any stretch of the range that no existing span touched.
  const inRange = next
    .filter((s) => s.start < end && s.end > start)
    .sort((a, b) => a.start - b.start);
  let cursor = start;
  for (const s of inRange) {
    if (s.start > cursor) next.push({ start: cursor, end: s.start, ...override });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < end) next.push({ start: cursor, end, ...override });

  next.sort((a, b) => a.start - b.start || a.end - b.end);
  return { ...layer, spans: next };
}

/** The subset of a style patch that a character span can carry. */
function spanOverrideFrom(patch: Partial<TextStyle>): Partial<TextSpan> {
  const out: Partial<TextSpan> = {};
  if (patch.bold !== undefined) out.bold = patch.bold;
  if (patch.italic !== undefined) out.italic = patch.italic;
  if (patch.underline !== undefined) out.underline = patch.underline;
  if (patch.color !== undefined) out.color = patch.color;
  if (patch.fontSize !== undefined) out.fontSize = patch.fontSize;
  if (patch.fontFamily !== undefined) out.fontFamily = patch.fontFamily;
  return out;
}

/** Remove keys from span overrides that a box-level restyle has superseded. */
function stripSpanKeys(spans: TextSpan[], patch: Partial<TextStyle>): TextSpan[] {
  const keys = Object.keys(spanOverrideFrom(patch));
  if (keys.length === 0) return spans;
  return spans
    .map((span) => {
      const copy: Record<string, unknown> = { ...span };
      for (const k of keys) delete copy[k];
      return copy as unknown as TextSpan;
    })
    // A span with no overrides left carries no meaning.
    .filter((span) => Object.keys(span).some((k) => k !== "start" && k !== "end"));
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mkv|mov|m4v|avi)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const PRESENTATION_EXT = /\.(pptx|ppsx)$/i;

export function assetFromPath(path: string, deck: Deck): MediaAsset {
  const name = path.split(/[\\/]/).pop() ?? path;
  const kind: MediaAsset["kind"] = PRESENTATION_EXT.test(path)
    ? "presentation"
    : VIDEO_EXT.test(path)
      ? "video"
      : AUDIO_EXT.test(path)
        ? "audio"
        : "image";
  // Anything with no recognised extension is treated as an image: the tile then
  // shows a broken-thumbnail state the operator can see and remove, which beats
  // refusing the file with no explanation.
  void IMAGE_EXT;
  return {
    id: nanoid(10),
    deck,
    kind,
    name,
    path,
    thumbnail: "",
    width: 0,
    height: 0,
    durationSeconds: 0,
    sizeBytes: 0,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectActiveItem = (s: Store): ServiceItem | null =>
  s.show.items.find((i) => i.id === s.activeItemId) ?? null;

/**
 * Slides of the active item.
 *
 * UNSTABLE REFERENCE: builds a fresh array every call, so consuming it with a
 * bare `useStore(selectActiveSlides)` re-renders on every store change and can
 * hit "Maximum update depth exceeded". Always select through
 * `useStore(useShallow(selectActiveSlides))` — same applies to the other
 * selectors marked UNSTABLE REFERENCE below.
 */
export const selectActiveSlides = (s: Store): Slide[] => selectActiveItem(s)?.slides ?? [];

export const selectSelectedSlide = (s: Store): Slide | null =>
  selectActiveSlides(s).find((sl) => sl.id === s.selectedSlideId) ?? null;

/** Assets of the active deck. UNSTABLE REFERENCE — select through `useShallow`. */
export const selectDeckAssets = (s: Store): MediaAsset[] =>
  s.show.media.filter((m) => m.deck === s.activeDeck);

export const selectIsLive = (s: Store): boolean => s.liveMonitors.length > 0;

/**
 * The effective text style the toolbar should display for the current target.
 * UNSTABLE REFERENCE — select through `useShallow`.
 */
export function selectToolbarStyle(s: Store): TextStyle {
  const slide = selectSelectedSlide(s);
  const layer =
    slide?.layers.find((l): l is TextLayer => l.type === "text" && l.id === s.selectedLayerId) ??
    slide?.layers.find((l): l is TextLayer => l.type === "text");
  if (!layer) return { ...DEFAULT_TEXT_STYLE };

  // Reflect a selection's own overrides, so the controls show what the operator
  // is actually about to change.
  const sel = s.textSelection;
  if (sel && sel.layerId === layer.id && sel.end > sel.start) {
    const span = layer.spans.find((sp) => sp.start <= sel.start && sp.end >= sel.end);
    if (span) {
      return {
        ...layer.style,
        ...(span.bold != null ? { bold: span.bold } : {}),
        ...(span.italic != null ? { italic: span.italic } : {}),
        ...(span.underline != null ? { underline: span.underline } : {}),
        ...(span.color != null ? { color: span.color } : {}),
        ...(span.fontSize != null ? { fontSize: span.fontSize } : {}),
        ...(span.fontFamily != null ? { fontFamily: span.fontFamily } : {}),
      };
    }
  }
  return layer.style;
}
