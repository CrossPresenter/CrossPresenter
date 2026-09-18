/**
 * The middle column: Slide Grid over the Media Deck Viewer, split by a single
 * draggable divider capped at 60% of the viewport per `deckMax`.
 */

import { DECK_MIN, deckMax, useStore } from "../../state/store";
import { Splitter } from "../common/Splitter";
import { SlideGrid } from "../workspace/SlideGrid";
import { MediaDeckViewer } from "../workspace/MediaDeckViewer";

export function CenterWorkspace() {
  const deckHeight = useStore((s) => s.layout.deckHeight);
  const setDeckHeight = useStore((s) => s.setDeckHeight);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SlideGrid />
      <Splitter axis="y" value={deckHeight} min={DECK_MIN} max={deckMax()} onChange={setDeckHeight} invert />
      <MediaDeckViewer height={deckHeight} />
    </div>
  );
}
