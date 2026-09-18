/**
 * The right column: Live Output Preview stacked over the Quick Format
 * Toolbar. Fixed width per spec — no splitter, no resize handle.
 */

import { RIGHT_PANEL_WIDTH } from "../../state/store";
import { LiveOutputPreview } from "../live/LiveOutputPreview";
import { QuickFormatToolbar } from "../live/QuickFormatToolbar";

export function RightPanel() {
  return (
    <div
      className="flex flex-none flex-col overflow-hidden border-l border-shell-800 bg-shell-900"
      style={{ width: RIGHT_PANEL_WIDTH }}
    >
      <LiveOutputPreview />
      <QuickFormatToolbar />
    </div>
  );
}
