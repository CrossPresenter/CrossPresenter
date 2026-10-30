/**
 * The click-to-project grid. Selecting a slide here also puts it live
 * immediately — one gesture serves both purposes, matching how an operator
 * actually works a service, so there is no separate "go" action once a slide
 * is on screen.
 */

import { useDroppable } from "@dnd-kit/core";
import { useShallow } from "zustand/react/shallow";

import { selectActiveItem, selectActiveSlides, useStore } from "../../state/store";
import type { ServiceItem, Slide } from "../../lib/types";
import { SlideCanvas } from "../render/SlideCanvas";
import { DuplicateIcon, GlobeIcon, PlusIcon, TrashIcon } from "../common/Icons";

export function SlideGrid() {
  const activeItem = useStore(selectActiveItem);
  const slides = useStore(useShallow(selectActiveSlides));
  const liveWebUrl = useStore((s) => s.live.webUrl);
  const projectWeb = useStore((s) => s.projectWeb);
  const addSlide = useStore((s) => s.addSlide);

  // Drop target for assets dragged out of the Media Pool — see MainView.
  const { setNodeRef, isOver } = useDroppable({
    id: "slide-grid",
    data: { type: "slide-grid" },
  });

  return (
    <div
      ref={setNodeRef}
      data-over={isOver}
      className="relative flex flex-1 flex-col overflow-hidden ring-inset transition-shadow data-[over=true]:ring-2 data-[over=true]:ring-accent-500/70"
    >
      <div className="cp-panel-header flex items-center justify-between">
        <span className="truncate">{activeItem ? activeItem.title : "Slides"}</span>
        {activeItem && activeItem.kind !== "web" && (
          <button
            className="cp-btn-ghost cp-btn !px-1.5 !py-1"
            title="Add slide"
            onClick={() => addSlide(slides[slides.length - 1]?.id)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!activeItem && (
          <EmptyState text="Select an item in the Service Order — or drop an image, background, graphic or URL here to add it as a slide." />
        )}

        {activeItem?.kind === "web" && (
          <WebItemCard
            item={activeItem}
            live={!!liveWebUrl && liveWebUrl === activeItem.sourcePath}
            onProject={() => projectWeb(activeItem.sourcePath)}
          />
        )}

        {activeItem && activeItem.kind !== "web" && slides.length === 0 && (
          <EmptyState
            text={
              activeItem.kind === "presentation"
                ? "This presentation hasn't been converted to slides yet."
                : "This item has no slides yet — use Add slide to start."
            }
          />
        )}

        {activeItem && activeItem.kind !== "web" && slides.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {slides.map((slide) => (
              <SlideCard key={slide.id} item={activeItem} slide={slide} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-[12.5px] text-ink-500">
      <span>{text}</span>
    </div>
  );
}

function WebItemCard({ item, live, onProject }: { item: ServiceItem; live: boolean; onProject: () => void }) {
  return (
    <button
      data-live={live}
      className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border-2 border-shell-700 bg-shell-850 p-6 text-ink-200 hover:border-shell-500 data-[live=true]:border-live-500"
      onClick={onProject}
    >
      <GlobeIcon className="h-8 w-8 text-ink-400" />
      <span className="max-w-full truncate text-[13px]" title={item.sourcePath}>
        {item.sourcePath}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-ink-500">{live ? "Live" : "Click to go live"}</span>
    </button>
  );
}

function SlideCard({ item, slide }: { item: ServiceItem; slide: Slide }) {
  const selectedSlideId = useStore((s) => s.selectedSlideId);
  const liveSlideId = useStore((s) => s.liveSlideId);
  const liveItemId = useStore((s) => s.liveItemId);
  const selectSlide = useStore((s) => s.selectSlide);
  const projectSlide = useStore((s) => s.projectSlide);
  const duplicateSlide = useStore((s) => s.duplicateSlide);
  const removeSlide = useStore((s) => s.removeSlide);

  const isLive = liveItemId === item.id && liveSlideId === slide.id;
  const isSelected = selectedSlideId === slide.id;

  return (
    <div className="flex flex-col gap-1">
      <div
        data-selected={isSelected}
        data-live={isLive}
        className="cp-slide-card group"
        onClick={() => {
          selectSlide(slide.id);
          projectSlide(item.id, slide.id);
        }}
      >
        <SlideCanvas slide={slide} itemBackground={item.background} className="w-full" />
        <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="cp-btn-ghost cp-btn !bg-black/50 !p-1"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicateSlide(slide.id);
            }}
          >
            <DuplicateIcon className="h-3 w-3" />
          </button>
          <button
            className="cp-btn-ghost cp-btn !bg-black/50 !p-1"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              removeSlide(slide.id);
            }}
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
      <span className="truncate px-0.5 text-[11px] text-ink-400" title={slide.label}>
        {slide.label || "Slide"}
      </span>
    </div>
  );
}
