/**
 * The service queue. Reordering is drag-handle only — no up/down buttons, per
 * spec — and doubles as the drop target for assets dragged out of the Media
 * Pool below it (see LeftSidebar, which owns the shared DndContext).
 */

import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { KIND_COLORS, KIND_LABELS } from "../../lib/defaults";
import { useStore } from "../../state/store";
import type { ServiceItem } from "../../lib/types";
import { DownloadIcon, GripIcon, PlusIcon, TrashIcon, UploadIcon } from "../common/Icons";

export const SERVICE_ORDER_DROPZONE_ID = "service-order-dropzone";

export function ServiceOrderPane({ height }: { height: number }) {
  const items = useStore((s) => s.show.items);
  const exportShowFile = useStore((s) => s.exportShowFile);
  const importShowFile = useStore((s) => s.importShowFile);
  const busy = useStore((s) => s.busy);
  const { setNodeRef, isOver } = useDroppable({
    id: SERVICE_ORDER_DROPZONE_ID,
    data: { type: "service-order" },
  });

  return (
    <div className="flex flex-col overflow-hidden" style={{ height }}>
      <div className="cp-panel-header flex items-center justify-between">
        <span>Service Order</span>
        <div className="flex items-center gap-1">
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

      <div
        ref={setNodeRef}
        data-over={isOver}
        className="flex-1 space-y-1 overflow-y-auto p-1.5 data-[over=true]:bg-shell-800/40"
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ServiceItemRow key={item.id} item={item} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center text-[11.5px] text-ink-500">
            <PlusIcon className="h-5 w-5 opacity-50" />
            <span>Drag media in, or import songs and presentations to build your service.</span>
          </div>
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
