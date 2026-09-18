/**
 * The left column of the Edit view: every slide of the active item, in order,
 * with the same add/duplicate/remove affordances as the Slide Grid so an
 * operator never has to bounce back to Main just to add a slide mid-edit.
 */

import { useShallow } from "zustand/react/shallow";

import { selectActiveItem, selectActiveSlides, useStore } from "../../state/store";
import type { Slide } from "../../lib/types";
import { SlideCanvas } from "../render/SlideCanvas";
import { DuplicateIcon, PlusIcon, TrashIcon } from "../common/Icons";

export function SlideFilmstrip() {
  const activeItem = useStore(selectActiveItem);
  const slides = useStore(useShallow(selectActiveSlides));
  const selectedSlideId = useStore((s) => s.selectedSlideId);
  const selectSlide = useStore((s) => s.selectSlide);
  const addSlide = useStore((s) => s.addSlide);
  const duplicateSlide = useStore((s) => s.duplicateSlide);
  const removeSlide = useStore((s) => s.removeSlide);

  return (
    <div className="flex w-[190px] flex-none flex-col overflow-hidden border-r border-shell-800 bg-shell-900">
      <div className="cp-panel-header flex items-center justify-between">
        <span className="truncate">{activeItem ? activeItem.title : "Slides"}</span>
        {activeItem && (
          <button
            className="cp-btn-ghost cp-btn !px-1.5 !py-1"
            title="Add slide"
            onClick={() => addSlide(slides[slides.length - 1]?.id)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {!activeItem && (
          <div className="px-2 py-6 text-center text-[12px] text-ink-500">
            Select an item from the Service Order first.
          </div>
        )}
        {activeItem && (
          <div className="flex flex-col gap-2.5">
            {slides.map((slide, i) => (
              <FilmstripCard
                key={slide.id}
                index={i}
                slide={slide}
                itemBackground={activeItem.background}
                selected={slide.id === selectedSlideId}
                onSelect={() => selectSlide(slide.id)}
                onDuplicate={() => duplicateSlide(slide.id)}
                onRemove={() => removeSlide(slide.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilmstripCard({
  index,
  slide,
  itemBackground,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  index: number;
  slide: Slide;
  itemBackground: Parameters<typeof SlideCanvas>[0]["itemBackground"];
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10.5px] text-ink-500">
        <span className="w-4 text-right">{index + 1}</span>
        <span className="truncate">{slide.label || "Slide"}</span>
      </div>
      <div data-selected={selected} className="cp-slide-card group" onClick={onSelect}>
        <SlideCanvas slide={slide} itemBackground={itemBackground} className="w-full" />
        <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="cp-btn-ghost cp-btn !bg-black/50 !p-1"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <DuplicateIcon className="h-3 w-3" />
          </button>
          <button
            className="cp-btn-ghost cp-btn !bg-black/50 !p-1"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
