/**
 * The operator's own preview of what is currently on air — same store, same
 * `SlideCanvas`, no IPC round-trip, so it never lags behind the projector by
 * even one frame. The border lights up only once a monitor is actually
 * broadcasting (`selectIsLive`), not just because a slide is selected.
 */

import { selectIsLive, useStore } from "../../state/store";
import { LetterboxFrame } from "../common/LetterboxFrame";
import { SlideCanvas } from "../render/SlideCanvas";

export function LiveOutputPreview() {
  const live = useStore((s) => s.live);
  const isLive = useStore(selectIsLive);

  return (
    <div className="flex flex-none flex-col">
      <div className="cp-panel-header">
        <span>Live Output</span>
        <span className="text-[10.5px] uppercase tracking-wide text-ink-500">
          {isLive ? "On air" : "Not broadcasting"}
        </span>
      </div>
      <div data-live={isLive} className="cp-live-frame m-3 overflow-hidden bg-black">
        <LetterboxFrame className="aspect-video w-full">
          <SlideCanvas
            slide={live.slide}
            itemBackground={live.itemBackground}
            black={live.black}
            textCleared={live.textCleared}
            backgroundCleared={live.backgroundCleared}
            webUrl={live.webUrl}
            className="h-full w-full"
          />
        </LetterboxFrame>
      </div>
    </div>
  );
}
