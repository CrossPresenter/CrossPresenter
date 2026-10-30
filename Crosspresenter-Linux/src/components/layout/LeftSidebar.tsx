/**
 * The left column: Service Order stacked over the Media Pool, with the shared
 * DndContext that lets an asset be dragged out of the pool and dropped into
 * the queue. Reordering within the queue and pool-to-queue drops are two
 * different gestures but resolve through the same onDragEnd, discriminated by
 * `active.data.current?.type`.
 */

import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { nanoid } from "nanoid";

import { SIDEBAR_MIN, SIDEBAR_MAX, SERVICE_PANE_MIN, useStore } from "../../state/store";
import { KIND_COLORS, newServiceItem } from "../../lib/defaults";
import type { Background, MediaAsset, ServiceItem, Slide, Transition } from "../../lib/types";
import { Splitter } from "../common/Splitter";
import { ServiceOrderPane } from "../sidebar/ServiceOrderPane";
import { MediaPoolPane } from "../sidebar/MediaPoolPane";

/** Leaves enough room for the deck grid, one asset row and the add button. */
const MEDIA_POOL_MIN = 160;

function assetToServiceItem(asset: MediaAsset, transition: Transition): ServiceItem {
  if (asset.kind === "url") {
    return newServiceItem({
      kind: "web",
      title: asset.name,
      sourcePath: asset.path,
      color: KIND_COLORS.web,
    });
  }

  const background: Background =
    asset.kind === "video"
      ? { kind: "video", src: asset.path, fit: "cover", loopPlayback: true, muted: true }
      : { kind: "image", src: asset.path, fit: "cover" };

  const slide: Slide = {
    id: nanoid(10),
    label: asset.name,
    layers: [],
    background,
    transition,
    notes: "",
    groupColor: KIND_COLORS.media,
  };

  return newServiceItem({
    kind: "media",
    title: asset.name,
    slides: [slide],
    sourcePath: asset.path,
    color: KIND_COLORS.media,
  });
}

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
  const transition = useStore((s) => s.transition);
  const reorderItems = useStore((s) => s.reorderItems);
  const addItems = useStore((s) => s.addItems);
  const addPresentationItem = useStore((s) => s.addPresentationItem);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as { type?: string; asset?: MediaAsset } | undefined;

    if (activeData?.type === "service-item") {
      if (active.id !== over.id) reorderItems(String(active.id), String(over.id));
      return;
    }

    if (activeData?.type === "media-asset" && activeData.asset) {
      const overData = over.data.current as { type?: string } | undefined;
      const droppedOnQueue = overData?.type === "service-order" || overData?.type === "service-item";
      if (!droppedOnQueue) return;
      if (activeData.asset.kind === "presentation") {
        void addPresentationItem(activeData.asset);
      } else {
        addItems([assetToServiceItem(activeData.asset, transition)]);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
    </DndContext>
  );
}
