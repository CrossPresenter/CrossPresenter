import { useEffect, useState } from "react";
import { Monitor, Send, StickyNote, Clock as ClockIcon, Timer as TimerIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClockSettings, TimerState, ServiceItem, LiveContent, DisplayInfo } from "../App";

interface StageViewProps {
  serviceItems: ServiceItem[];
  activeServiceItem: number;
  setActiveServiceItem: (i: number) => void;
  activeLyricSlide: number;
  setActiveLyricSlide: (i: number) => void;
  liveOverride: LiveContent | null;
  clockSettings: ClockSettings;
  timerState: TimerState;
  displays: DisplayInfo[];
  stageDisplayId: number | null;
  setStageDisplayId: (id: number | null) => void;
}

export const StageView = (props: StageViewProps) => {
  const {
    serviceItems, activeServiceItem, setActiveServiceItem,
    activeLyricSlide, setActiveLyricSlide,
    liveOverride, clockSettings, timerState,
    displays, stageDisplayId, setStageDisplayId
  } = props;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeItem = serviceItems[activeServiceItem];
  const slides = activeItem ? activeItem.slides : [];
  const current = liveOverride ? liveOverride.text : (slides[activeLyricSlide] ?? "");
  const next = !liveOverride && activeLyricSlide < slides.length - 1 ? slides[activeLyricSlide + 1] : null;
  const notes = activeItem?.notes?.[activeLyricSlide] ?? "";

  const clockString = clockSettings.show
    ? new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: clockSettings.format === "12h"
      })
    : null;

  const timerActive = timerState.endTime !== null;
  const remaining = timerActive ? Math.max(0, timerState.endTime! - now) : 0;
  const elapsed = timerActive ? Math.max(0, timerState.totalDuration - remaining) : 0;
  const fmt = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d1a]" style={{ flex: 1 }}>
      {/* Top strip: item context + clock + timer */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#13131f]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Stage</span>
          <span className="text-sm text-white/90 font-medium truncate">{activeItem?.title ?? "No active item"}</span>
          <span className="text-xs text-white/40 truncate">{activeItem?.detail}</span>
        </div>
        <div className="flex items-center gap-3">
          {clockString && (
            <div className="flex items-center gap-1.5 text-white/80">
              <ClockIcon size={13} className="text-[#7c6af7]" />
              <span className="font-mono text-sm tabular-nums">{clockString}</span>
            </div>
          )}
          {timerActive && (
            <div className={`flex items-center gap-1.5 ${remaining === 0 ? "text-red-400" : "text-white/80"}`}>
              <TimerIcon size={13} className={remaining === 0 ? "text-red-400" : "text-[#7c6af7]"} />
              <span className="font-mono text-sm tabular-nums">
                {remaining === 0 ? "00:00" : fmt(remaining)}
                <span className="text-white/35 ml-1.5">/ elapsed {fmt(elapsed)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Service order list */}
        <div className="w-56 border-r border-white/10 bg-[#16162a] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 bg-[#13131f]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Service Order</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
            {serviceItems.length === 0 && (
              <p className="text-[10px] text-white/30 p-3">Service order is empty.</p>
            )}
            {serviceItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setActiveServiceItem(idx)}
                className={`w-full text-left rounded px-2.5 py-1.5 border transition-colors ${
                  idx === activeServiceItem
                    ? "border-[#7c6af7]/60 bg-[#7c6af7]/20 text-white"
                    : "border-white/5 bg-white/5 text-white/60 hover:text-white/90 hover:border-white/15"
                }`}
              >
                <p className="text-[11px] font-medium truncate">{idx + 1}. {item.title}</p>
                <p className="text-[9px] text-white/35 truncate">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main stage content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Slide navigation + current slide */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            <div className="w-full max-w-3xl flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setActiveLyricSlide(Math.max(0, activeLyricSlide - 1))}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  title="Previous slide (←)"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[10px] font-mono text-white/40 px-2">
                  Slide {Math.min(activeLyricSlide + 1, Math.max(1, slides.length))} / {Math.max(1, slides.length)}
                </span>
                <button
                  onClick={() => setActiveLyricSlide(Math.min(slides.length - 1, activeLyricSlide + 1))}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  title="Next slide (→ / Space)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="w-full bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <div className="w-full h-full flex items-center justify-center p-10">
                  {current ? (
                    <p className="text-white text-center whitespace-pre-line" style={{ fontSize: "clamp(20px, 3.5vw, 44px)", lineHeight: 1.4 }}>{current}</p>
                  ) : (
                    <p className="text-white/25 text-lg">No slide selected</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Next slide + notes */}
          <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            <div className="rounded-lg bg-white/3 border border-white/8 p-3 min-h-[76px]">
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Next Slide</p>
              <p className="text-xs text-white/50 whitespace-pre-line leading-snug line-clamp-3">{next ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-yellow-500/5 border border-yellow-400/15 p-3 min-h-[76px]">
              <div className="flex items-center gap-1 mb-1">
                <StickyNote size={10} className="text-yellow-400/70" />
                <p className="text-[9px] uppercase tracking-widest text-yellow-400/60">Speaker Notes</p>
              </div>
              <p className="text-xs text-yellow-200/70 whitespace-pre-line leading-snug line-clamp-3">{notes || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: send stage to display */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#13131f]">
        <span className="text-[10px] text-white/30">
          {displays.length === 0 ? "No external displays detected" : `${displays.length} external display${displays.length === 1 ? "" : "s"} available`}
        </span>
        <div className="flex items-center gap-2">
          <Send size={12} className="text-white/40" />
          <select
            value={stageDisplayId ?? ""}
            onChange={(e) => setStageDisplayId(e.target.value ? Number(e.target.value) : null)}
            className="bg-black/40 border border-white/10 rounded text-xs text-white/80 px-2 py-1 outline-none cursor-pointer"
          >
            <option value="">Stage not on display</option>
            {displays.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <span className="flex items-center gap-1 text-[9px] text-white/35">
            <Monitor size={10} /> Fullscreen on selected display
          </span>
        </div>
      </div>
    </div>
  );
};
