/**
 * The right column: Live Output Preview stacked over a tabbed control area —
 * Quick Format for the slide on screen, Overlays for timers, clock, messages
 * and logo. Fixed width per spec — no splitter, no resize handle.
 */

import { useState } from "react";

import { RIGHT_PANEL_WIDTH } from "../../state/store";
import { LiveOutputPreview } from "../live/LiveOutputPreview";
import { OverlayPanel } from "../live/OverlayPanel";
import { QuickFormatToolbar } from "../live/QuickFormatToolbar";

type RightTab = "format" | "overlays";

export function RightPanel() {
  const [tab, setTab] = useState<RightTab>("format");

  return (
    <div
      className="flex flex-none flex-col overflow-hidden border-l border-shell-800 bg-shell-900"
      style={{ width: RIGHT_PANEL_WIDTH }}
    >
      <LiveOutputPreview />

      <div className="flex flex-none gap-1 border-b border-shell-800 px-2 py-1.5" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "format"}
          className="cp-tab flex-1"
          onClick={() => setTab("format")}
        >
          Format
        </button>
        <button
          role="tab"
          aria-selected={tab === "overlays"}
          className="cp-tab flex-1"
          onClick={() => setTab("overlays")}
        >
          Overlays
        </button>
      </div>

      {tab === "format" ? <QuickFormatToolbar /> : <OverlayPanel />}
    </div>
  );
}
