/**
 * The right column of the Edit view: slide-level controls (background
 * override, transition, notes) on top, and — once a layer is selected on the
 * canvas — that layer's geometry plus its type-specific style controls below.
 * Every field writes straight through `updateSlide` / `updateLayer`; nothing
 * here keeps its own copy of the data.
 */

import { useEffect, useRef, useState } from "react";

import { pickMediaFiles } from "../../lib/tauri";
import { TRANSITIONS } from "../../lib/types";
import type { Background, Layer, Transition } from "../../lib/types";
import { assetFromPath, selectSelectedSlide, useStore } from "../../state/store";
import { TrashIcon } from "../common/Icons";

export function LayerInspector() {
  const slide = useStore(selectSelectedSlide);
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const updateSlide = useStore((s) => s.updateSlide);
  const updateLayer = useStore((s) => s.updateLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const pushHistory = useStore((s) => s.pushHistory);
  const toast = useStore((s) => s.toast);

  if (!slide) {
    return (
      <div className="flex w-[280px] flex-none flex-col overflow-hidden border-l border-shell-800 bg-shell-900">
        <div className="cp-panel-header">
          <span>Inspector</span>
        </div>
        <div className="px-3 py-6 text-center text-[12px] text-ink-500">Nothing selected.</div>
      </div>
    );
  }

  const slideId = slide.id;
  const layer = slide.layers.find((l) => l.id === selectedLayerId) ?? null;

  function commitLayer(patch: Partial<Layer>) {
    if (!layer) return;
    pushHistory();
    updateLayer(slideId, layer.id, patch);
  }

  async function pickBackground() {
    try {
      const [path] = await pickMediaFiles();
      if (!path) return;
      const asset = assetFromPath(path, "bg");
      const background: Background =
        asset.kind === "video"
          ? { kind: "video", src: path, fit: "cover", loopPlayback: true, muted: true }
          : { kind: "image", src: path, fit: "cover" };
      pushHistory();
      updateSlide(slideId, { background });
    } catch (err) {
      toast("error", err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex w-[280px] flex-none flex-col overflow-y-auto border-l border-shell-800 bg-shell-900">
      <div className="cp-panel-header">
        <span>Slide</span>
      </div>
      <div className="flex flex-col gap-3 border-b border-shell-800 p-3">
        <div className="flex flex-col gap-1.5">
          <span className="cp-label">Background</span>
          <BackgroundSwatch
            background={slide.background}
            onPick={pickBackground}
            onColor={(color) => {
              pushHistory();
              updateSlide(slide.id, { background: { kind: "color", color } });
            }}
            onClear={() => {
              pushHistory();
              updateSlide(slide.id, { background: null });
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="cp-label">Transition in</span>
          <select
            className="cp-input"
            value={slide.transition}
            onChange={(e) => {
              pushHistory();
              updateSlide(slide.id, { transition: e.target.value as Transition });
            }}
          >
            {TRANSITIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="cp-label">Notes</span>
          <textarea
            className="cp-input min-h-[60px] resize-none"
            value={slide.notes}
            onChange={(e) => updateSlide(slide.id, { notes: e.target.value })}
            onBlur={() => pushHistory()}
          />
        </div>
      </div>

      {layer && (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <span className="cp-label">Layer — {layer.type}</span>
            <button
              className="cp-btn-ghost cp-btn !px-1.5 !py-1 !text-red-300"
              title="Delete layer"
              onClick={() => removeLayer(slide.id, layer.id)}
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <RectFields layer={layer} onCommit={commitLayer} />

          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-1.5 text-[12px] text-ink-300">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => commitLayer({ visible: e.target.checked })}
              />
              Visible
            </label>
            <label className="flex flex-1 items-center gap-1.5 text-[12px] text-ink-300">
              <input
                type="checkbox"
                checked={layer.locked}
                onChange={(e) => commitLayer({ locked: e.target.checked })}
              />
              Locked
            </label>
          </div>

          <NumberField
            label="Rotation"
            value={layer.rotation}
            min={-180}
            max={180}
            step={1}
            onCommit={(v) => commitLayer({ rotation: v })}
          />

          {layer.type === "text" && <TextLayerFields layer={layer} onCommit={commitLayer} />}
          {layer.type === "image" && <ImageLayerFields layer={layer} onCommit={commitLayer} />}
          {layer.type === "shape" && <ShapeLayerFields layer={layer} onCommit={commitLayer} />}
        </div>
      )}
    </div>
  );
}

function BackgroundSwatch({
  background,
  onPick,
  onColor,
  onClear,
}: {
  background: Background | null;
  onPick: () => void;
  onColor: (color: string) => void;
  onClear: () => void;
}) {
  const colorInput = useRef<HTMLInputElement>(null);
  const swatchColor = background?.kind === "color" ? background.color : "#000000";
  return (
    <div className="flex items-center gap-1.5">
      <button
        className="h-[26px] w-[26px] flex-none cursor-pointer rounded-md border border-shell-600 p-0"
        style={{ background: swatchColor }}
        title="Solid color"
        onClick={() => colorInput.current?.click()}
      >
        <input
          ref={colorInput}
          type="color"
          value={swatchColor}
          onChange={(e) => onColor(e.target.value)}
          className="h-0 w-0 opacity-0"
        />
      </button>
      <button className="cp-btn flex-1 !py-1.5 text-[12px]" onClick={onPick}>
        {background && background.kind !== "color" ? "Change image/video…" : "Image/video…"}
      </button>
      {background && (
        <button className="cp-btn-ghost cp-btn !px-2 !py-1.5" onClick={onClear} title="Clear override">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function RectFields({ layer, onCommit }: { layer: Layer; onCommit: (patch: Partial<Layer>) => void }) {
  const { x, y, width, height } = layer.rect;
  const set = (field: "x" | "y" | "width" | "height", v: number) =>
    onCommit({ rect: { ...layer.rect, [field]: v / 100 } });
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label="X %" value={x * 100} min={0} max={100} step={0.5} onCommit={(v) => set("x", v)} />
      <NumberField label="Y %" value={y * 100} min={0} max={100} step={0.5} onCommit={(v) => set("y", v)} />
      <NumberField label="W %" value={width * 100} min={1} max={100} step={0.5} onCommit={(v) => set("width", v)} />
      <NumberField label="H %" value={height * 100} min={1} max={100} step={0.5} onCommit={(v) => set("height", v)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  const display = Math.round(value * 100) / 100;
  // Keep a local draft so typing does not commit (and push a history entry) on
  // every keystroke — commit once, on blur/Enter. Otherwise Undo steps through
  // each interim digit of a number edit.
  const [draft, setDraft] = useState<string>(String(display));
  const lastValue = useRef(display);
  useEffect(() => {
    if (lastValue.current !== display) {
      lastValue.current = display;
      setDraft(String(display));
    }
  }, [display]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(display));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    const rounded = Math.round(clamped * 100) / 100;
    lastValue.current = rounded;
    setDraft(String(rounded));
    if (rounded !== display) onCommit(rounded);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="cp-label">{label}</span>
      <input
        type="number"
        className="cp-input"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function TextLayerFields({
  layer,
  onCommit,
}: {
  layer: Layer & { type: "text" };
  onCommit: (patch: Partial<Layer>) => void;
}) {
  const style = layer.style;
  const setStyle = (patch: Partial<typeof style>) => onCommit({ style: { ...style, ...patch } });
  return (
    <div className="flex flex-col gap-2 border-t border-shell-800 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Line height"
          value={style.lineHeight}
          min={0.8}
          max={2.5}
          step={0.02}
          onCommit={(v) => setStyle({ lineHeight: v })}
        />
        <NumberField
          label="Letter spacing"
          value={style.letterSpacing}
          min={-4}
          max={20}
          step={0.5}
          onCommit={(v) => setStyle({ letterSpacing: v })}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="cp-label">Vertical align</span>
        <select
          className="cp-input"
          value={style.verticalAlign}
          onChange={(e) => setStyle({ verticalAlign: e.target.value as typeof style.verticalAlign })}
        >
          <option value="top">Top</option>
          <option value="middle">Middle</option>
          <option value="bottom">Bottom</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Outline width"
          value={style.strokeWidth}
          min={0}
          max={12}
          step={0.5}
          onCommit={(v) => setStyle({ strokeWidth: v })}
        />
        <label className="flex flex-col gap-1">
          <span className="cp-label">Outline color</span>
          <input
            type="color"
            value={style.strokeColor}
            onChange={(e) => setStyle({ strokeColor: e.target.value })}
            className="h-[26px] w-full cursor-pointer rounded-md border border-shell-600 bg-transparent p-0.5"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="cp-label">Shadow (CSS text-shadow)</span>
        <input
          type="text"
          className="cp-input"
          value={style.shadow}
          onChange={(e) => setStyle({ shadow: e.target.value })}
          placeholder="none"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-300">
        <input type="checkbox" checked={layer.autoFit} onChange={(e) => onCommit({ autoFit: e.target.checked })} />
        Auto-fit text to box
      </label>
    </div>
  );
}

function ImageLayerFields({
  layer,
  onCommit,
}: {
  layer: Layer & { type: "image" };
  onCommit: (patch: Partial<Layer>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-shell-800 pt-3">
      <NumberField
        label="Opacity %"
        value={layer.opacity * 100}
        min={0}
        max={100}
        step={1}
        onCommit={(v) => onCommit({ opacity: v / 100 })}
      />
    </div>
  );
}

function ShapeLayerFields({
  layer,
  onCommit,
}: {
  layer: Layer & { type: "shape" };
  onCommit: (patch: Partial<Layer>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-shell-800 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="cp-label">Fill</span>
          <input
            type="color"
            value={layer.fill}
            onChange={(e) => onCommit({ fill: e.target.value })}
            className="h-[26px] w-full cursor-pointer rounded-md border border-shell-600 bg-transparent p-0.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="cp-label">Stroke</span>
          <input
            type="color"
            value={layer.stroke}
            onChange={(e) => onCommit({ stroke: e.target.value })}
            className="h-[26px] w-full cursor-pointer rounded-md border border-shell-600 bg-transparent p-0.5"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Stroke width"
          value={layer.strokeWidth}
          min={0}
          max={20}
          step={0.5}
          onCommit={(v) => onCommit({ strokeWidth: v })}
        />
        <NumberField
          label="Corner radius"
          value={layer.cornerRadius}
          min={0}
          max={200}
          step={1}
          onCommit={(v) => onCommit({ cornerRadius: v })}
        />
      </div>
      <NumberField
        label="Opacity %"
        value={layer.opacity * 100}
        min={0}
        max={100}
        step={1}
        onCommit={(v) => onCommit({ opacity: v / 100 })}
      />
    </div>
  );
}
