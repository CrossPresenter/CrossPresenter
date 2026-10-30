/**
 * A larger, scrub-friendly view of whichever deck is active in the Media
 * Pool. Deliberately not a second deck switcher — the five buttons in the
 * sidebar are the only place a deck gets picked; this pane just reflects that
 * choice at a size actually useful for browsing.
 *
 * Tiles behave like their sidebar rows: click (or drag onto the slide grid)
 * inserts, while the play badge is the explicit go-live shortcut.
 */

import { useDraggable } from "@dnd-kit/core";
import { useShallow } from "zustand/react/shallow";

import type { Deck, MediaAsset } from "../../lib/types";
import { selectDeckAssets, useStore } from "../../state/store";
import {
  ExternalLinkIcon,
  GlobeIcon,
  ImageIcon,
  LayersIcon,
  MusicIcon,
  PlayIcon,
  VideoIcon,
} from "../common/Icons";

const DECK_LABELS: Record<Deck, string> = {
  media: "Images / Videos",
  bg: "Backgrounds",
  graphics: "Graphics",
  browser: "Browser",
  songs: "Songs",
};

export function MediaDeckViewer({ height }: { height: number }) {
  const activeDeck = useStore((s) => s.activeDeck);
  const assets = useStore(useShallow(selectDeckAssets));
  const insertMediaIntoSlides = useStore((s) => s.insertMediaIntoSlides);
  const projectMedia = useStore((s) => s.projectMedia);
  const projectWeb = useStore((s) => s.projectWeb);
  const toggleBrowserWindow = useStore((s) => s.toggleBrowserWindow);
  const openBrowserAssetIds = useStore((s) => s.openBrowserAssetIds);

  return (
    <div className="flex flex-none flex-col overflow-hidden border-t border-shell-800" style={{ height }}>
      <div className="cp-panel-header flex items-center justify-between">
        <span>{DECK_LABELS[activeDeck]}</span>
        <span className="text-[10.5px] uppercase tracking-wide text-ink-500">
          {assets.length} item{assets.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[12px] text-ink-500">
            <span>No items in this deck yet — add some from the Media Pool.</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {assets.map((asset) => (
              <DeckTile
                key={asset.id}
                asset={asset}
                isBrowserOpen={openBrowserAssetIds.includes(asset.id)}
                onInsert={() => void insertMediaIntoSlides(asset)}
                onProject={() => (asset.kind === "url" ? projectWeb(asset.path) : projectMedia(asset))}
                onToggleBrowser={() => void toggleBrowserWindow(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeckGlyph({ asset }: { asset: MediaAsset }) {
  const className = "h-6 w-6 text-ink-500";
  if (asset.deck === "songs") return <MusicIcon className={className} />;
  if (asset.kind === "url") return <GlobeIcon className={className} />;
  if (asset.kind === "video") return <VideoIcon className={className} />;
  if (asset.kind === "presentation") return <LayersIcon className={className} />;
  return <ImageIcon className={className} />;
}

function DeckTile({
  asset,
  isBrowserOpen,
  onInsert,
  onProject,
  onToggleBrowser,
}: {
  asset: MediaAsset;
  isBrowserOpen: boolean;
  onInsert: () => void;
  onProject: () => void;
  onToggleBrowser: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // A prefix distinct from the sidebar row's id: both are mounted at once.
    id: `deck:${asset.id}`,
    data: { type: "media-asset", asset },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-dragging={isDragging}
      className="group flex cursor-grab flex-col gap-1 rounded-lg border border-shell-700 bg-shell-850 p-1 hover:border-shell-500 data-[dragging=true]:opacity-40"
      title="Click to add to the slide grid"
      onClick={onInsert}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-shell-800">
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <DeckGlyph asset={asset} />
          </div>
        )}
        {asset.kind === "url" && (
          <button
            className={`cp-btn-ghost cp-btn absolute left-1 top-1 !bg-black/50 !p-1 ${isBrowserOpen ? "!text-accent-500" : "invisible group-hover:visible"}`}
            title={isBrowserOpen ? "Close browser window" : "Open browser window for navigation"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBrowser();
            }}
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {asset.deck !== "songs" && (
          <button
            className="cp-btn-ghost cp-btn invisible absolute right-1 top-1 !bg-black/50 !p-1 group-hover:visible"
            title="Send straight to live"
            onClick={(e) => {
              e.stopPropagation();
              onProject();
            }}
          >
            <PlayIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <span className="truncate px-0.5 text-[11px] text-ink-300" title={asset.path}>
        {asset.name}
      </span>
    </div>
  );
}
