/**
 * The fast path for restyling text without opening the full Edit view.
 * Every control reads/writes through `selectToolbarStyle` / `applyTextStyle`,
 * so the store alone decides whether a change lands on just the selected
 * slide or every slide in the item — the toolbar has no scoping logic of its
 * own beyond the "Use for all slides" switch it exposes.
 */

import { useShallow } from "zustand/react/shallow";

import { FONT_FAMILIES, MAX_FONT_SIZE, MIN_FONT_SIZE } from "../../lib/defaults";
import type { TextAlign } from "../../lib/types";
import { selectToolbarStyle, useStore } from "../../state/store";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BlackIcon,
  ClearBgIcon,
  ClearTextIcon,
} from "../common/Icons";

const ALIGNS: { id: TextAlign; icon: typeof AlignLeftIcon }[] = [
  { id: "left", icon: AlignLeftIcon },
  { id: "center", icon: AlignCenterIcon },
  { id: "right", icon: AlignRightIcon },
  { id: "justify", icon: AlignJustifyIcon },
];

export function QuickFormatToolbar() {
  const style = useStore(useShallow(selectToolbarStyle));
  const applyTextStyle = useStore((s) => s.applyTextStyle);
  const useForAllSlides = useStore((s) => s.useForAllSlides);
  const setUseForAllSlides = useStore((s) => s.setUseForAllSlides);
  const black = useStore((s) => s.live.black);
  const textCleared = useStore((s) => s.live.textCleared);
  const backgroundCleared = useStore((s) => s.live.backgroundCleared);
  const toggleBlack = useStore((s) => s.toggleBlack);
  const toggleClearText = useStore((s) => s.toggleClearText);
  const toggleClearBackground = useStore((s) => s.toggleClearBackground);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="cp-panel-header">
        <span>Quick Format</span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <label className="flex items-center justify-between text-[12px] text-ink-300">
          <span>Use for all slides</span>
          <button
            role="switch"
            aria-checked={useForAllSlides}
            className="cp-switch"
            onClick={() => setUseForAllSlides(!useForAllSlides)}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-ink-500">Font</span>
          <select
            className="cp-input"
            value={style.fontFamily}
            onChange={(e) => applyTextStyle({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-ink-500">Size</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={style.fontSize}
              onChange={(e) => applyTextStyle({ fontSize: Number(e.target.value) })}
              className="cp-range flex-1"
            />
            <input
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={style.fontSize}
              onChange={(e) => applyTextStyle({ fontSize: Number(e.target.value) })}
              className="cp-input w-14 !px-1.5 text-center"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            data-selected={style.bold}
            className="cp-toggle-btn font-bold"
            title="Bold"
            onClick={() => applyTextStyle({ bold: !style.bold })}
          >
            B
          </button>
          <button
            data-selected={style.italic}
            className="cp-toggle-btn italic"
            title="Italic"
            onClick={() => applyTextStyle({ italic: !style.italic })}
          >
            I
          </button>
          <button
            data-selected={style.underline}
            className="cp-toggle-btn underline"
            title="Underline"
            onClick={() => applyTextStyle({ underline: !style.underline })}
          >
            U
          </button>
          <button
            data-selected={style.uppercase}
            className="cp-toggle-btn"
            title="Uppercase"
            onClick={() => applyTextStyle({ uppercase: !style.uppercase })}
          >
            AA
          </button>
          <input
            type="color"
            title="Text color"
            value={style.color}
            onChange={(e) => applyTextStyle({ color: e.target.value })}
            className="h-[26px] w-[26px] flex-none cursor-pointer rounded-md border border-shell-600 bg-transparent p-0.5"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {ALIGNS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              data-selected={style.align === id}
              className="cp-toggle-btn"
              title={id}
              onClick={() => applyTextStyle({ align: id })}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-shell-800 p-3">
        <button
          data-selected={black}
          className="cp-toggle-btn flex-1 text-[11.5px]"
          onClick={toggleBlack}
        >
          <BlackIcon className="h-3.5 w-3.5" />
          Black
        </button>
        <button
          data-selected={textCleared}
          className="cp-toggle-btn flex-1 text-[11.5px]"
          onClick={toggleClearText}
        >
          <ClearTextIcon className="h-3.5 w-3.5" />
          Clear Text
        </button>
        <button
          data-selected={backgroundCleared}
          className="cp-toggle-btn flex-1 text-[11.5px]"
          onClick={toggleClearBackground}
        >
          <ClearBgIcon className="h-3.5 w-3.5" />
          Clear BG
        </button>
      </div>
    </div>
  );
}
