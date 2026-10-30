/**
 * The left column: Service Order stacked over the Media Pool. The DndContext
 * that lets rows be dragged out of the pool lives one level up in `MainView`,
 * so a drag can also land on the slide grid in the centre column.
 */

import { useEffect, useRef, useState } from "react";

import { SIDEBAR_MIN, SIDEBAR_MAX, SERVICE_PANE_MIN, useStore } from "../../state/store";
import { Splitter } from "../common/Splitter";
import { ServiceOrderPane } from "../sidebar/ServiceOrderPane";
import { MediaPoolPane } from "../sidebar/MediaPoolPane";

/** Leaves enough room for the deck grid, one asset row and the add button. */
const MEDIA_POOL_MIN = 160;

export function LeftSidebar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paneMax, setPaneMax] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const height = entries[0].contentRect.height;
      setPaneMax(Math.max(SERVICE_PANE_MIN, height - MEDIA_POOL_MIN));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useStore((s) => s.layout);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);
  const setServicePaneHeight = useStore((s) => s.setServicePaneHeight);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-none flex-col border-r border-shell-800 bg-shell-900"
      style={{ width: layout.sidebarWidth }}
    >
      <ServiceOrderPane height={Math.min(layout.servicePaneHeight, paneMax)} />
      <Splitter
        axis="y"
        value={Math.min(layout.servicePaneHeight, paneMax)}
        min={SERVICE_PANE_MIN}
        max={paneMax}
        onChange={setServicePaneHeight}
      />
      <MediaPoolPane />

      <Splitter
        axis="x"
        value={layout.sidebarWidth}
        min={SIDEBAR_MIN}
        max={SIDEBAR_MAX}
        onChange={setSidebarWidth}
        className="absolute right-0 top-0 h-full -translate-x-1/2"
      />
    </div>
  );
}
