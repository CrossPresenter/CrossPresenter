/**
 * The compact deck selector: five buttons (Media, BG, Graphics, Browser,
 * Songs) with the current deck's assets listed below.
 *
 * A single click never goes on air. It inserts the asset into the slide grid
 * (`insertMediaIntoSlides`) — the operator then clicks the slide they actually
 * want. The small play button remains as the explicit "send straight to live"
 * shortcut. Assets are also draggable into the Service Order or onto the slide
 * grid; see `MainView`'s DndContext.
 */

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";

import { useStore } from "../../state/store";
import type { Deck, MediaAsset } from "../../lib/types";
import { buildSearchKey, rankByQuery } from "../../lib/search";
import {
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  ImageIcon,
  LayersIcon,
  MusicIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  VideoIcon,
} from "../common/Icons";

const DECKS: { id: Deck; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "media", label: "Media", icon: (p) => <ImageIcon {...p} /> },
  { id: "bg", label: "BG", icon: (p) => <VideoIcon {...p} /> },
  { id: "graphics", label: "Graphics", icon: (p) => <LayersIcon {...p} /> },
  { id: "browser", label: "Browser", icon: (p) => <GlobeIcon {...p} /> },
  { id: "songs", label: "Songs", icon: (p) => <MusicIcon {...p} /> },
];

const EMPTY_COPY: Partial<Record<Deck, string>> = {
  songs:
    "Add songs from ProPresenter, EasyWorship, OpenLP, OpenSong, FreeShow, Quelea and more — or PowerPoint (.pptx). Click a tile to open it in the slide grid.",
};

export function MediaPoolPane() {
  const activeDeck = useStore((s) => s.activeDeck);
  const setActiveDeck = useStore((s) => s.setActiveDeck);
  const media = useStore((s) => s.show.media);
  const assets = useMemo(() => media.filter((m) => m.deck === activeDeck), [media, activeDeck]);
  const [query, setQuery] = useState("");
  /** Keys are built once per asset so typing only re-scores, never re-transliterates. */
  const indexed = useMemo(
    () =>
      assets.map((asset) => ({
        asset,
        key: buildSearchKey(`${asset.name} ${asset.path}`),
      })),
    [assets],
  );
  const visible = useMemo(
    () => rankByQuery(indexed, query, (entry) => entry.key).map((entry) => entry.asset),
    [indexed, query],
  );
  const addMediaFromPicker = useStore((s) => s.addMediaFromPicker);
  const addSongsFromFolder = useStore((s) => s.addSongsFromFolder);
  const insertMediaIntoSlides = useStore((s) => s.insertMediaIntoSlides);
  const projectMedia = useStore((s) => s.projectMedia);
  const projectWeb = useStore((s) => s.projectWeb);
  const removeMedia = useStore((s) => s.removeMedia);
  const toggleBrowserWindow = useStore((s) => s.toggleBrowserWindow);
  const openBrowserAssetIds = useStore((s) => s.openBrowserAssetIds);

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-t border-shell-800">
      <div className="grid grid-cols-5 gap-0.5 p-1.5">
        {DECKS.map((d) => (
          <button
            key={d.id}
            data-selected={activeDeck === d.id}
            className="flex flex-col items-center gap-1 rounded-md border border-transparent py-1.5 text-[9.5px] text-ink-400 hover:bg-shell-800 data-[selected=true]:border-shell-600 data-[selected=true]:bg-shell-750 data-[selected=true]:text-ink-50"
            onClick={() => {
              setQuery("");
              setActiveDeck(d.id);
            }}
          >
            {d.icon({ className: "h-4 w-4" })}
            <span className="leading-none">{d.label}</span>
          </button>
        ))}
      </div>

      {activeDeck === "songs" && assets.length > 0 && (
        <div className="relative px-1.5 pb-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input
            className="cp-input !py-1 !pl-7 text-[11.5px]"
            value={query}
            placeholder="Quick search songs…"
            title="Filter songs by name; press Enter to add the first match to the slide grid"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                return;
              }
              if (e.key === "Enter" && visible[0]) {
                void insertMediaIntoSlides(visible[0]);
                setQuery("");
              }
            }}
          />
        </div>
      )}

      {activeDeck === "browser" ? (
        <BrowserAddRow />
      ) : (
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10.5px] uppercase tracking-wide text-ink-500">
            {query.trim()
              ? `${visible.length} of ${assets.length}`
              : `${assets.length} item${assets.length === 1 ? "" : "s"}`}
          </span>
          <div className="flex items-center gap-1">
            {activeDeck === "songs" && (
              <button
                className="cp-btn-ghost cp-btn !py-0.5 !px-2 text-[11px]"
                title="Add a whole song library folder"
                onClick={() => void addSongsFromFolder()}
              >
                <FolderIcon className="h-3 w-3" /> Folder
              </button>
            )}
            <button
              className="cp-btn-ghost cp-btn !py-0.5 !px-2 text-[11px]"
              onClick={() => void addMediaFromPicker(activeDeck)}
            >
              <PlusIcon className="h-3 w-3" /> Add
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto p-1.5 pt-0">
        {visible.map((asset) => (
          <MediaAssetRow
            key={asset.id}
            asset={asset}
            isBrowserOpen={openBrowserAssetIds.includes(asset.id)}
            onInsert={() => void insertMediaIntoSlides(asset)}
            onProject={() => (asset.kind === "url" ? projectWeb(asset.path) : projectMedia(asset))}
            onToggleBrowser={() => void toggleBrowserWindow(asset)}
            onRemove={() => removeMedia(asset.id)}
          />
        ))}
        {assets.length > 0 && visible.length === 0 && (
          <p className="px-3 py-5 text-center text-[11.5px] leading-relaxed text-ink-500">
            Nothing matches “{query.trim()}”.
          </p>
        )}
        {assets.length === 0 && activeDeck !== "browser" && (
          <div className="flex flex-col items-center gap-1 px-3 py-5 text-center text-[11px] leading-relaxed text-ink-500">
            {EMPTY_COPY[activeDeck] ? (
              <span>{EMPTY_COPY[activeDeck]}</span>
            ) : (
              <span>No items in this deck yet.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserAddRow() {
  const [url, setUrl] = useState("");
  const addWebLink = useStore((s) => s.addWebLink);

  const submit = () => {
    if (!url.trim()) return;
    addWebLink(url);
    setUrl("");
  };

  return (
    <div className="flex items-center gap-1 px-1.5 pb-1.5">
      <input
        className="cp-input flex-1 !py-1 text-[11.5px]"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button className="cp-btn cp-btn-primary !py-1 !px-2 text-[11px]" onClick={submit}>
        <PlusIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

function AssetGlyph({ asset }: { asset: MediaAsset }) {
  const className = "h-4 w-4 text-ink-500";
  if (asset.deck === "songs") return <MusicIcon className={className} />;
  if (asset.kind === "url") return <GlobeIcon className={className} />;
  if (asset.kind === "video") return <VideoIcon className={className} />;
  if (asset.kind === "presentation") return <LayersIcon className={className} />;
  return <ImageIcon className={className} />;
}

function MediaAssetRow({
  asset,
  isBrowserOpen,
  onInsert,
  onProject,
  onToggleBrowser,
  onRemove,
}: {
  asset: MediaAsset;
  isBrowserOpen: boolean;
  onInsert: () => void;
  onProject: () => void;
  onToggleBrowser: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `media:${asset.id}`,
    data: { type: "media-asset", asset },
  });
  const isSong = asset.deck === "songs";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-dragging={isDragging}
      className="group flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1 text-[12px] text-ink-200 hover:bg-shell-800 data-[dragging=true]:opacity-30"
      title="Click to add to the slide grid"
      onClick={onInsert}
    >
      <div className="flex h-9 w-14 flex-none items-center justify-center overflow-hidden rounded bg-shell-800">
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <AssetGlyph asset={asset} />
        )}
      </div>
      <span className="flex-1 truncate" title={asset.path}>
        {asset.name}
      </span>
      {asset.kind === "url" && (
        <button
          className={`cp-btn-ghost cp-btn !p-1 ${isBrowserOpen ? "!text-accent-500" : "invisible group-hover:visible"}`}
          title={isBrowserOpen ? "Close browser window" : "Open browser window for navigation"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBrowser();
          }}
        >
          <ExternalLinkIcon className="h-3 w-3" />
        </button>
      )}
      {!isSong && (
        <button
          className="cp-btn-ghost cp-btn invisible !p-1 group-hover:visible"
          title="Send straight to live"
          onClick={(e) => {
            e.stopPropagation();
            onProject();
          }}
        >
          <PlayIcon className="h-3 w-3" />
        </button>
      )}
      <button
        className="cp-btn-ghost cp-btn invisible !p-1 group-hover:visible"
        title="Remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
