/**
 * The service queue. Reordering is drag-handle only — no up/down buttons, per
 * spec — and doubles as the drop target for assets dragged out of the Media
 * Pool below it (see MainView, which owns the shared DndContext).
 */

import { useMemo, useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { KIND_COLORS, KIND_LABELS } from "../../lib/defaults";
import { buildSearchKey, rankByQuery } from "../../lib/search";
import { useStore } from "../../state/store";
import type { ServiceItem } from "../../lib/types";
import {
  DownloadIcon,
  GripIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "../common/Icons";

export const SERVICE_ORDER_DROPZONE_ID = "service-order-dropzone";

function itemSearchText(item: ServiceItem): string {
  return [
    item.title,
    item.meta.author,
    item.meta.ccli,
    item.meta.key,
    item.kind,
    ...item.meta.themes,
  ].join(" ");
}

/** Quote a CSV cell only when it needs it, so the report stays readable. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CCLI reporting: one row per song used in the service, copied to the
 * clipboard as CSV so it can be pasted into a licence return or a spreadsheet.
 */
function ccliCsv(items: ServiceItem[]): string {
  const header = ["Title", "Author", "CCLI", "Key", "Copyright", "Source"];
  const rows = items
    .filter((item) => item.kind === "song")
    .map((item) => [
      item.title,
      item.meta.author,
      item.meta.ccli,
      item.meta.key,
      item.meta.copyright,
      item.meta.source,
    ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function ServiceOrderPane({ height }: { height: number }) {
  const items = useStore((s) => s.show.items);
  const exportShowFile = useStore((s) => s.exportShowFile);
  const importShowFile = useStore((s) => s.importShowFile);
  const busy = useStore((s) => s.busy);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState("");
  const indexed = useMemo(
    () => items.map((item) => ({ item, key: buildSearchKey(itemSearchText(item)) })),
    [items],
  );
  const visible = useMemo(
    () =>
      query.trim()
        ? rankByQuery(indexed, query, (entry) => entry.key).map((entry) => entry.item)
        : items,
    [indexed, items, query],
  );
  const songCount = items.filter((item) => item.kind === "song").length;
  const { setNodeRef, isOver } = useDroppable({
    id: SERVICE_ORDER_DROPZONE_ID,
    data: { type: "service-order" },
  });

  const copyCcliReport = async () => {
    try {
      await navigator.clipboard.writeText(ccliCsv(items));
      toast("success", `Copied ${songCount} song${songCount === 1 ? "" : "s"} for CCLI reporting`);
    } catch {
      toast("error", "Clipboard is not available in this window.");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height }}>
      <div className="cp-panel-header flex items-center justify-between">
        <span>Service Order</span>
        <div className="flex items-center gap-1">
          <button
            className="cp-btn-ghost cp-btn !px-1.5 !py-1 text-[10px] font-bold"
            title="Copy CCLI report (CSV)"
            disabled={songCount === 0}
            onClick={copyCcliReport}
          >
            CCLI
          </button>
          <button
            className="cp-btn-ghost cp-btn !px-1.5 !py-1"
            title="Import .cpshow"
            disabled={busy != null}
            onClick={() => importShowFile()}
          >
            <UploadIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="cp-btn-ghost cp-btn !px-1.5 !py-1"
            title="Export .cpshow"
            disabled={busy != null || items.length === 0}
            onClick={() => exportShowFile()}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="relative flex-none border-b border-shell-800 p-1.5">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input
            className="cp-input !pl-7 !py-1"
            value={query}
            placeholder="Search songs, authors, CCLI — any language…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
          />
        </div>
      )}

      <div
        ref={setNodeRef}
        data-over={isOver}
        className="flex-1 space-y-1 overflow-y-auto p-1.5 data-[over=true]:bg-shell-800/40"
      >
        <SortableContext items={visible.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {visible.map((item) => (
            <ServiceItemRow key={item.id} item={item} />
          ))}
        </SortableContext>

        {visible.length > 0 && visible.length < items.length && (
          <p className="px-2 py-1 text-[10.5px] text-ink-500">
            {visible.length} of {items.length} items
          </p>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center text-[11.5px] text-ink-500">
            <PlusIcon className="h-5 w-5 opacity-50" />
            <span>Drag media in, or import songs and presentations to build your service.</span>
          </div>
        )}

        {items.length > 0 && visible.length === 0 && (
          <p className="px-3 py-8 text-center text-[11.5px] text-ink-500">
            Nothing matches “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}

function ServiceItemRow({ item }: { item: ServiceItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const activeItemId = useStore((s) => s.activeItemId);
  const liveItemId = useStore((s) => s.liveItemId);
  const setActiveItem = useStore((s) => s.setActiveItem);
  const renameItem = useStore((s) => s.renameItem);
  const removeItem = useStore((s) => s.removeItem);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "service-item" },
  });

  const commit = () => {
    const title = draft.trim();
    if (title && title !== item.title) renameItem(item.id, title);
    else setDraft(item.title);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      data-selected={activeItemId === item.id}
      className="group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[12.5px] text-ink-200 data-[selected=true]:bg-shell-750"
      onClick={() => setActiveItem(item.id)}
    >
      <button className="cp-drag-handle text-ink-500" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripIcon className="h-3.5 w-3.5" />
      </button>

      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: item.color || KIND_COLORS[item.kind] }}
      />

      {liveItemId === item.id && <span className="h-1.5 w-1.5 flex-none rounded-full bg-live-500" />}

      {editing ? (
        <input
          autoFocus
          className="cp-input flex-1 !py-0.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(item.title);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 truncate"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title={item.title}
        >
          {item.title}
        </span>
      )}

      <span className="flex-none text-[10.5px] uppercase tracking-wide text-ink-500">
        {KIND_LABELS[item.kind]}
      </span>

      <button
        className="cp-btn-ghost cp-btn invisible !p-1 group-hover:visible"
        title="Remove"
        onClick={(e) => {
          e.stopPropagation();
          removeItem(item.id);
        }}
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
