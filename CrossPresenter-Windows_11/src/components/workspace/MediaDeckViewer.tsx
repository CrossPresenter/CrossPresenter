/**
 * A larger, scrub-friendly view of whichever deck is active in the Media
 * Pool. Deliberately not a second deck switcher — the four buttons in the
 * sidebar are the only place a deck gets picked; this pane just reflects that
 * choice at a size actually useful for browsing.
 */

import { useShallow } from "zustand/react/shallow";

import type { Deck, MediaAsset } from "../../lib/types";
import { selectDeckAssets, useStore } from "../../state/store";
import { ExternalLinkIcon, GlobeIcon, ImageIcon, LayersIcon, PlayIcon, VideoIcon } from "../common/Icons";

const DECK_LABELS: Record<Deck, string> = {
  media: "Images / Videos",
  bg: "Backgrounds",
  graphics: "Graphics",
  browser: "Browser",
};

export function MediaDeckViewer({ height }: { height: number }) {
  const activeDeck = useStore((s) => s.activeDeck);
  const assets = useStore(useShallow(selectDeckAssets));
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
                onProject={() => (asset.kind === "url" ? projectWeb(asset.path) : projectMedia(asset))}
                onToggleBrowser={() => toggleBrowserWindow(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeckTile({
  asset,
  isBrowserOpen,
  onProject,
  onToggleBrowser,
}: {
  asset: MediaAsset;
  isBrowserOpen: boolean;
  onProject: () => void;
  onToggleBrowser: () => void;
}) {
  return (
    <div
      className="group flex flex-col gap-1 rounded-lg border border-shell-700 bg-shell-850 p-1 hover:border-shell-500"
      onDoubleClick={onProject}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-shell-800">
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {asset.kind === "url" ? (
              <GlobeIcon className="h-6 w-6 text-ink-500" />
            ) : asset.kind === "video" ? (
              <VideoIcon className="h-6 w-6 text-ink-500" />
            ) : asset.kind === "presentation" ? (
              <LayersIcon className="h-6 w-6 text-ink-500" />
            ) : (
              <ImageIcon className="h-6 w-6 text-ink-500" />
            )}
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
        <button
          className="cp-btn-ghost cp-btn invisible absolute right-1 top-1 !bg-black/50 !p-1 group-hover:visible"
          title="Send to live"
          onClick={(e) => {
            e.stopPropagation();
            onProject();
          }}
        >
          <PlayIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="truncate px-0.5 text-[11px] text-ink-300" title={asset.name}>
        {asset.name}
      </span>
    </div>
  );
}
