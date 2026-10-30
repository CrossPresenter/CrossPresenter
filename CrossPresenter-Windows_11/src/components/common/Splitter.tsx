/**
 * Draggable divider shared by every resizable seam in the layout: the left
 * sidebar's width, the Service Order / Media Pool split, and the Slide Grid /
 * Media Deck Viewer horizontal splitter.
 *
 * A single pointer-event drag drives all three — no library, no layout thrash
 * mid-drag, since the value only ever changes through the caller's setter and
 * the caller decides what re-renders.
 */

import { useCallback, useRef, useState } from "react";

interface SplitterProps {
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Drag delta sign: -1 when the panel being sized shrinks as the pointer moves forward. */
  invert?: boolean;
  className?: string;
}

export function Splitter({ axis, value, min, max, onChange, invert = false, className }: SplitterProps) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ pointer: 0, value: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      startRef.current = { pointer: axis === "x" ? e.clientX : e.clientY, value };
      setDragging(true);
    },
    [axis, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pointer = axis === "x" ? e.clientX : e.clientY;
      const delta = (pointer - startRef.current.pointer) * (invert ? -1 : 1);
      const next = Math.min(max, Math.max(min, startRef.current.value + delta));
      onChange(next);
    },
    [dragging, axis, invert, min, max, onChange],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      data-dragging={dragging}
      className={`${axis === "x" ? "cp-splitter-v" : "cp-splitter-h"} ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
