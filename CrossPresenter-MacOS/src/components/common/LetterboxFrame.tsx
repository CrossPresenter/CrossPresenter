/**
 * Fits a fixed-aspect child into whatever space its parent gives it, with
 * letterbox bars rather than distortion or cropping.
 *
 * CSS `aspect-ratio` alone cannot solve this for an arbitrary block box (it
 * only derives one axis from the other, not both against a container that is
 * constrained on both), so this measures the container and hands the child an
 * exact pixel box. Used for the Live Output preview, the fullscreen
 * projection window, and the Stage view — anywhere the container's aspect
 * ratio may not match the 16:9 canvas (e.g. a 4:3 projector).
 */

import { useEffect, useRef, useState } from "react";

interface LetterboxFrameProps {
  aspect?: number;
  className?: string;
  children: React.ReactNode;
}

export function LetterboxFrame({ aspect = 16 / 9, className, children }: LetterboxFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      let w = width;
      let h = width / aspect;
      if (h > height) {
        h = height;
        w = height * aspect;
      }
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return (
    <div ref={outerRef} className={`flex items-center justify-center overflow-hidden ${className ?? ""}`}>
      <div style={{ width: size.w || undefined, height: size.h || undefined }}>{children}</div>
    </div>
  );
}
