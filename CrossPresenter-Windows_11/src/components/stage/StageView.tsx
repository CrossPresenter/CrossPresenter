/**
 * Stage View: the confidence-monitor layout meant for a second screen facing
 * the platform, not the operator — current slide large, next slide and notes
 * beside it, a clock that never stops moving. Read-only: nothing here writes
 * to the store.
 */

import { useEffect, useState } from "react";

import { selectIsLive, useStore } from "../../state/store";
import type { Slide } from "../../lib/types";
import { LetterboxFrame } from "../common/LetterboxFrame";
import { SlideCanvas } from "../render/SlideCanvas";

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function findNextSlide(items: { slides: Slide[] }[], liveSlideId: string | undefined): Slide | null {
  if (!liveSlideId) return null;
  const flat = items.flatMap((item) => item.slides);
  const index = flat.findIndex((s) => s.id === liveSlideId);
  if (index === -1) return flat[0] ?? null;
  return flat[index + 1] ?? null;
}

export function StageView() {
  const clock = useClock();
  const live = useStore((s) => s.live);
  const isLive = useStore(selectIsLive);
  const items = useStore((s) => s.show.items);
  const activeItem = useStore((s) => s.show.items.find((i) => i.id === s.activeItemId));

  const nextSlide = findNextSlide(items, live.slide?.id);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-shell-950 p-6">
      <div className="mb-4 flex flex-none items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-500">
            {isLive ? "On air" : "Not broadcasting"}
          </div>
          <div className="text-[16px] font-semibold text-ink-50">{activeItem?.title ?? "—"}</div>
        </div>
        <div className="font-mono text-[28px] font-semibold text-ink-50 tabular-nums">{clock}</div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="flex flex-[2] flex-col gap-2">
          <span className="cp-label">Current</span>
          <div data-live={isLive} className="cp-live-frame flex-1 overflow-hidden bg-black">
            <LetterboxFrame className="h-full w-full">
              <SlideCanvas
                slide={live.slide}
                itemBackground={live.itemBackground}
                black={live.black}
                textCleared={live.textCleared}
                backgroundCleared={live.backgroundCleared}
                webUrl={live.webUrl}
                overlays={live.overlays}
                className="h-full w-full"
              />
            </LetterboxFrame>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex flex-col gap-2">
            <span className="cp-label">Next</span>
            <div className="cp-panel overflow-hidden bg-black">
              <LetterboxFrame className="w-full">
                <SlideCanvas slide={nextSlide} className="h-full w-full" />
              </LetterboxFrame>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-hidden">
            <span className="cp-label">Notes</span>
            <div className="cp-panel flex-1 overflow-y-auto p-3 text-[13px] leading-relaxed text-ink-200 whitespace-pre-wrap">
              {live.slide?.notes || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
