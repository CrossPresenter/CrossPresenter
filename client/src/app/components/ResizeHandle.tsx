import React, { useEffect, useRef } from "react";

interface ResizeHandleProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  ariaLabel?: string;
}

export const ResizeHandle = React.memo(function ResizeHandle({ direction, onResize, ariaLabel }: ResizeHandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const axis = direction === "vertical" ? "clientX" : "clientY";

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      let last = e[axis];
      const onMove = (ev: PointerEvent) => {
        const cur = ev[axis];
        const delta = cur - last;
        last = cur;
        if (delta !== 0) onResizeRef.current(delta);
      };
      const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.body.style.cursor = direction === "vertical" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => el.removeEventListener("pointerdown", onPointerDown);
  }, [direction]);

  return (
    <div
      ref={ref}
      role="separator"
      aria-label={ariaLabel}
      className={`shrink-0 z-10 transition-colors ${
        direction === "vertical"
          ? "w-1 cursor-col-resize bg-white/5 hover:bg-[#7c6af7]/40 active:bg-[#7c6af7]/60"
          : "h-1 cursor-row-resize bg-white/5 hover:bg-[#7c6af7]/40 active:bg-[#7c6af7]/60"
      }`}
    />
  );
});
