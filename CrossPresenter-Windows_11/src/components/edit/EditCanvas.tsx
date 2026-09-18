/**
 * The interactive stage: `SlideCanvas` renders the pixels (identical to every
 * other place it's used), and this component lays a transparent overlay on
 * top — one box per layer — that turns clicks into selection, drags into
 * moves, corner handles into resizes, and a double-click into inline text
 * editing. None of that manipulation chrome lives in `SlideCanvas` itself, so
 * the Slide Grid / Live Output / projection windows stay exactly as plain as
 * they need to be.
 */

import { useRef, useState } from "react";

import { CANVAS_ASPECT } from "../../lib/defaults";
import type { Layer, Rect } from "../../lib/types";
import { selectActiveItem, selectSelectedSlide, useStore } from "../../state/store";
import { LetterboxFrame } from "../common/LetterboxFrame";
import { SlideCanvas } from "../render/SlideCanvas";
import { PlusIcon, TrashIcon } from "../common/Icons";

const MIN_SIZE = 0.03;

function clamp01(v: number, max: number) {
  return Math.max(0, Math.min(max, v));
}

type Handle = "move" | "nw" | "ne" | "sw" | "se";

export function EditCanvas() {
  const activeItem = useStore(selectActiveItem);
  const slide = useStore(selectSelectedSlide);
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectLayer = useStore((s) => s.selectLayer);
  const updateLayer = useStore((s) => s.updateLayer);
  const addTextLayer = useStore((s) => s.addTextLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const pushHistory = useStore((s) => s.pushHistory);

  const stageRef = useRef<HTMLDivElement>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const drag = useRef<{ layerId: string; handle: Handle; startRect: Rect; startX: number; startY: number } | null>(
    null,
  );

  if (!activeItem || !slide) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-ink-500">
        Select a slide to edit.
      </div>
    );
  }

  const slideId = slide.id;

  function beginDrag(e: React.PointerEvent, layerId: string, handle: Handle, rect: Rect) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    // A drag is one history entry — pushing the pre-drag state once here, not
    // per pointer-move, keeps Undo stepping by gesture rather than by pixel.
    pushHistory();
    drag.current = { layerId, handle, startRect: rect, startX: e.clientX, startY: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const box = stageRef.current;
    if (!d || !box) return;
    const { width, height } = box.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const dx = (e.clientX - d.startX) / width;
    const dy = (e.clientY - d.startY) / height;
    const { x, y, width: w, height: h } = d.startRect;

    let next: Rect = { x, y, width: w, height: h };
    if (d.handle === "move") {
      next = { x: clamp01(x + dx, 1 - w), y: clamp01(y + dy, 1 - h), width: w, height: h };
    } else {
      let nx = x, ny = y, nw = w, nh = h;
      if (d.handle === "se") { nw = Math.max(MIN_SIZE, w + dx); nh = Math.max(MIN_SIZE, h + dy); }
      if (d.handle === "sw") { nw = Math.max(MIN_SIZE, w - dx); nx = x + w - nw; nh = Math.max(MIN_SIZE, h + dy); }
      if (d.handle === "ne") { nw = Math.max(MIN_SIZE, w + dx); nh = Math.max(MIN_SIZE, h - dy); ny = y + h - nh; }
      if (d.handle === "nw") { nw = Math.max(MIN_SIZE, w - dx); nx = x + w - nw; nh = Math.max(MIN_SIZE, h - dy); ny = y + h - nh; }
      next = { x: clamp01(nx, 1 - nw), y: clamp01(ny, 1 - nh), width: Math.min(nw, 1), height: Math.min(nh, 1) };
    }
    updateLayer(slideId, d.layerId, { rect: next });
  }

  function endDrag() {
    drag.current = null;
  }

  function commitText(layerId: string) {
    updateLayer(slideId, layerId, { text: draft });
    setEditingLayerId(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="cp-panel-header">
        <span className="truncate">{activeItem.title} — {slide.label || "Slide"}</span>
        <div className="flex items-center gap-1.5">
          <button className="cp-btn-ghost cp-btn !px-2 !py-1" onClick={() => addTextLayer(slide.id)}>
            <PlusIcon className="h-3.5 w-3.5" />
            Text
          </button>
          {selectedLayerId && (
            <button
              className="cp-btn-ghost cp-btn !px-2 !py-1 !text-red-300"
              onClick={() => removeLayer(slide.id, selectedLayerId)}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete layer
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-shell-950 p-6">
        <LetterboxFrame aspect={CANVAS_ASPECT} className="h-full w-full">
          <div
            ref={stageRef}
            className="relative h-full w-full"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={() => selectLayer(null)}
          >
            <SlideCanvas
              slide={slide}
              itemBackground={activeItem.background}
              interactive
              selectedLayerId={selectedLayerId}
              onSelectLayer={selectLayer}
              className="h-full w-full"
            />
            {slide.layers.map((layer) => (
              <LayerOverlay
                key={layer.id}
                layer={layer}
                selected={layer.id === selectedLayerId}
                editing={layer.id === editingLayerId}
                draft={draft}
                onDraftChange={setDraft}
                onCommitText={() => commitText(layer.id)}
                onStartEdit={() => {
                  if (layer.type !== "text") return;
                  setDraft(layer.text);
                  setEditingLayerId(layer.id);
                  selectLayer(layer.id);
                }}
                onSelect={() => selectLayer(layer.id)}
                onBeginDrag={(e, handle) => beginDrag(e, layer.id, handle, layer.rect)}
              />
            ))}
          </div>
        </LetterboxFrame>
      </div>
    </div>
  );
}

function LayerOverlay({
  layer,
  selected,
  editing,
  draft,
  onDraftChange,
  onCommitText,
  onStartEdit,
  onSelect,
  onBeginDrag,
}: {
  layer: Layer;
  selected: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onCommitText: () => void;
  onStartEdit: () => void;
  onSelect: () => void;
  onBeginDrag: (e: React.PointerEvent, handle: Handle) => void;
}) {
  if (!layer.visible) return null;
  const { x, y, width, height } = layer.rect;
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
  };

  if (editing && layer.type === "text") {
    return (
      <div style={style} className="z-10">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommitText}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCommitText();
          }}
          className="h-full w-full resize-none rounded-sm border-2 border-accent-500 bg-black/70 p-1 text-center text-white outline-none"
          style={{ fontSize: `${Math.max(10, layer.style.fontSize / 4)}px` }}
        />
      </div>
    );
  }

  return (
    <div
      data-selected={selected}
      style={style}
      className="group cursor-move border-2 border-transparent data-[selected=true]:border-accent-500 data-[selected=true]:bg-accent-500/5"
      onPointerDown={(e) => {
        onSelect();
        onBeginDrag(e, "move");
      }}
      onDoubleClick={onStartEdit}
    >
      {selected &&
        !layer.locked &&
        (["nw", "ne", "sw", "se"] as const).map((h) => (
          <div
            key={h}
            onPointerDown={(e) => onBeginDrag(e, h)}
            className="absolute h-2.5 w-2.5 rounded-full border border-shell-900 bg-accent-500"
            style={{
              top: h.startsWith("n") ? -5 : undefined,
              bottom: h.startsWith("s") ? -5 : undefined,
              left: h.endsWith("w") ? -5 : undefined,
              right: h.endsWith("e") ? -5 : undefined,
              cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
            }}
          />
        ))}
    </div>
  );
}
