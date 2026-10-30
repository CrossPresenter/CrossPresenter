/**
 * The Main workspace, wrapped in the single DndContext for the whole console.
 *
 * The context used to live inside `LeftSidebar`, which meant an asset could
 * only be dropped back onto the sidebar. It now wraps all three columns so the
 * same drag can land on the slide grid (`type: "slide-grid"`) or on the
 * Service Order. Drops are discriminated by `active.data.current?.type` and
 * `over.data.current?.type`.
 */

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { nanoid } from "nanoid";

import { KIND_COLORS, newServiceItem } from "../../lib/defaults";
import type { Background, MediaAsset, ServiceItem, Slide, Transition } from "../../lib/types";
import { useStore } from "../../state/store";
import { LeftSidebar } from "./LeftSidebar";
import { CenterWorkspace } from "./CenterWorkspace";
import { RightPanel } from "./RightPanel";

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

export function MainView() {
  const transition = useStore((s) => s.transition);
  const reorderItems = useStore((s) => s.reorderItems);
  const addItems = useStore((s) => s.addItems);
  const insertMediaIntoSlides = useStore((s) => s.insertMediaIntoSlides);

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
      const asset = activeData.asset;
      const overData = over.data.current as { type?: string } | undefined;

      // Dropping on the slide grid inserts into the deck below the workspace.
      if (overData?.type === "slide-grid") {
        void insertMediaIntoSlides(asset);
        return;
      }

      const droppedOnQueue = overData?.type === "service-order" || overData?.type === "service-item";
      if (!droppedOnQueue) return;

      // Containers (song files, PowerPoint decks) expand into multi-slide
      // items; single files become a one-slide media item.
      if (asset.deck === "songs" || asset.kind === "presentation") {
        void insertMediaIntoSlides(asset);
      } else {
        addItems([assetToServiceItem(asset, transition)]);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CenterWorkspace />
        <RightPanel />
      </div>
    </DndContext>
  );
}
