/**
 * The operator's own preview of what is currently on air — same store, same
 * `SlideCanvas`, no IPC round-trip, so it never lags behind the projector by
 * even one frame. The border lights up only once a monitor is actually
 * broadcasting (`selectIsLive`), not just because a slide is selected.
 */

import { selectIsLive, useStore } from "../../state/store";
import { assetUrl } from "../../lib/tauri";
import { LetterboxFrame } from "../common/LetterboxFrame";
import { MusicIcon } from "../common/Icons";
import { SlideCanvas } from "../render/SlideCanvas";

export function LiveOutputPreview() {
  const live = useStore((s) => s.live);
  const isLive = useStore(selectIsLive);
  const audio = useStore((s) => s.audioPlayback);
  const stopAudio = useStore((s) => s.stopAudio);
  const toggleAudioLoop = useStore((s) => s.toggleAudioLoop);

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
            overlays={live.overlays}
            className="h-full w-full"
          />
        </LetterboxFrame>
      </div>

      {audio && (
        <div className="mx-3 mb-3 flex items-center gap-1.5 rounded-md border border-shell-700 bg-shell-850 px-2 py-1.5">
          {/* Hidden transport: audio is heard on the operator machine, never
              composited onto the projector. */}
          <audio
            key={`${audio.path}:${audio.startedAt}`}
            src={assetUrl(audio.path)}
            autoPlay
            loop={audio.loop}
            onEnded={stopAudio}
            className="hidden"
          />
          <MusicIcon className="h-3.5 w-3.5 flex-none text-ink-400" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-200" title={audio.path}>
            {audio.name}
          </span>
          <button
            className="cp-toggle-btn"
            data-selected={audio.loop}
            title="Loop this track"
            onClick={toggleAudioLoop}
          >
            Loop
          </button>
          <button className="cp-btn !px-2 !py-0.5" onClick={stopAudio}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
