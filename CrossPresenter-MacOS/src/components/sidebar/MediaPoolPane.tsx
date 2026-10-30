/**
 * The compact deck selector: exactly four buttons (Images/Videos, BG,
 * Graphics, Browser) with the current deck's assets listed below. Assets are
 * draggable straight into the Service Order — see LeftSidebar's DndContext.
 */

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";

import { useStore } from "../../state/store";
import type { Deck, MediaAsset } from "../../lib/types";
import {
  ExternalLinkIcon,
  GlobeIcon,
  ImageIcon,
  LayersIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  VideoIcon,
} from "../common/Icons";

const DECKS: { id: Deck; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "media", label: "Images/Videos", icon: (p) => <ImageIcon {...p} /> },
  { id: "bg", label: "BG", icon: (p) => <VideoIcon {...p} /> },
  { id: "graphics", label: "Graphics", icon: (p) => <LayersIcon {...p} /> },
  { id: "browser", label: "Browser", icon: (p) => <GlobeIcon {...p} /> },
];

export function MediaPoolPane() {
  const activeDeck = useStore((s) => s.activeDeck);
  const setActiveDeck = useStore((s) => s.setActiveDeck);
  const media = useStore((s) => s.show.media);
  const assets = useMemo(() => media.filter((m) => m.deck === activeDeck), [media, activeDeck]);
  const addMediaFromPicker = useStore((s) => s.addMediaFromPicker);
  const projectMedia = useStore((s) => s.projectMedia);
  const projectWeb = useStore((s) => s.projectWeb);
  const removeMedia = useStore((s) => s.removeMedia);
  const toggleBrowserWindow = useStore((s) => s.toggleBrowserWindow);
  const openBrowserAssetIds = useStore((s) => s.openBrowserAssetIds);

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-t border-shell-800">
      <div className="grid grid-cols-4 gap-1 p-1.5">
        {DECKS.map((d) => (
          <button
            key={d.id}
            data-selected={activeDeck === d.id}
            className="flex flex-col items-center gap-1 rounded-md border border-transparent py-1.5 text-[10px] text-ink-400 hover:bg-shell-800 data-[selected=true]:border-shell-600 data-[selected=true]:bg-shell-750 data-[selected=true]:text-ink-50"
            onClick={() => setActiveDeck(d.id)}
          >
            {d.icon({ className: "h-4 w-4" })}
            <span className="leading-none">{d.label}</span>
          </button>
        ))}
      </div>

      {activeDeck === "browser" ? (
        <BrowserAddRow />
      ) : (
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10.5px] uppercase tracking-wide text-ink-500">
            {assets.length} item{assets.length === 1 ? "" : "s"}
          </span>
          <button className="cp-btn-ghost cp-btn !py-0.5 !px-2 text-[11px]" onClick={() => addMediaFromPicker(activeDeck)}>
            <PlusIcon className="h-3 w-3" /> Add
          </button>
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto p-1.5 pt-0">
        {assets.map((asset) => (
          <MediaAssetRow
            key={asset.id}
            asset={asset}
            isBrowserOpen={openBrowserAssetIds.includes(asset.id)}
            onProject={() => (asset.kind === "url" ? projectWeb(asset.path) : projectMedia(asset))}
            onToggleBrowser={() => toggleBrowserWindow(asset)}
            onRemove={() => removeMedia(asset.id)}
          />
        ))}
        {assets.length === 0 && activeDeck !== "browser" && (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center text-[11px] text-ink-500">
            <span>No items in this deck yet.</span>
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

function MediaAssetRow({
  asset,
  isBrowserOpen,
  onProject,
  onToggleBrowser,
  onRemove,
}: {
  asset: MediaAsset;
  isBrowserOpen: boolean;
  onProject: () => void;
  onToggleBrowser: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `media:${asset.id}`,
    data: { type: "media-asset", asset },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-dragging={isDragging}
      className="group flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1 text-[12px] text-ink-200 hover:bg-shell-800 data-[dragging=true]:opacity-30"
      onDoubleClick={onProject}
    >
      <div className="flex h-9 w-14 flex-none items-center justify-center overflow-hidden rounded bg-shell-800">
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : asset.kind === "url" ? (
          <GlobeIcon className="h-4 w-4 text-ink-500" />
        ) : asset.kind === "video" ? (
          <VideoIcon className="h-4 w-4 text-ink-500" />
        ) : asset.kind === "presentation" ? (
          <LayersIcon className="h-4 w-4 text-ink-500" />
        ) : (
          <ImageIcon className="h-4 w-4 text-ink-500" />
        )}
      </div>
      <span className="flex-1 truncate" title={asset.name}>
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
      <button
        className="cp-btn-ghost cp-btn invisible !p-1 group-hover:visible"
        title="Send to live"
        onClick={(e) => {
          e.stopPropagation();
          onProject();
        }}
      >
        <PlayIcon className="h-3 w-3" />
      </button>
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
