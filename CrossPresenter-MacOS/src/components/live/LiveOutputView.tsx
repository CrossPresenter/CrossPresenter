/**
 * The projection window's entire content.
 *
 * Mounted only in windows labelled `live-*`. It carries no state of its own —
 * it asks for a resend on mount and otherwise just renders whatever the
 * operator window last published — so a projector can be connected mid-service
 * and be correct within one event round-trip.
 */

import { useEffect, useState } from "react";

import { EMPTY_LIVE_STATE, type LiveState } from "../../lib/types";
import { onLiveState, requestLiveState } from "../../lib/tauri";
import { LetterboxFrame } from "../common/LetterboxFrame";
import { SlideCanvas } from "../render/SlideCanvas";

export function LiveOutputView() {
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE_STATE);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onLiveState(setLive).then((fn) => (unlisten = fn));
    requestLiveState();
    return () => unlisten?.();
  }, []);

  return (
    <div className="cp-live-root h-screen w-screen bg-black">
      <LetterboxFrame className="h-full w-full">
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
  );
}
