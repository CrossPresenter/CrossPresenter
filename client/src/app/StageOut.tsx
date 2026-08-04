import { useEffect, useState } from "react";
import { StickyNote, Clock as ClockIcon, Timer as TimerIcon } from "lucide-react";
import type { ClockSettings, TimerState } from "../App";

interface StageOrderItem {
  id: string;
  title: string;
  detail?: string;
}

interface StageState {
  text?: string;
  stageMode?: boolean;
  stageNext?: string | null;
  stageNotes?: string | null;
  stageTitle?: string;
  stageDetail?: string;
  serviceOrder?: StageOrderItem[];
  activeStageIndex?: number;
  clockSettings?: ClockSettings;
  timerState?: TimerState;
  isBlank?: boolean;
}

export function StageOut() {
  const [state, setState] = useState<StageState>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.onStateUpdate) {
      // @ts-ignore
      window.electron.onStateUpdate((newState: StageState) => {
        setState(newState);
      });
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const clockString = state.clockSettings?.show
    ? new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: state.clockSettings.format === "12h"
      })
    : null;

  const timerActive = state.timerState && state.timerState.endTime !== null;
  const remaining = timerActive ? Math.max(0, state.timerState!.endTime! - now) : 0;
  const elapsed = timerActive ? Math.max(0, state.timerState!.totalDuration - remaining) : 0;
  const fmt = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full h-screen bg-[#0d0d1a] text-white flex flex-col overflow-hidden select-none">
      {/* Top strip */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-white/10 bg-[#13131f]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7c6af7]">Stage</span>
          <span className="text-base font-medium truncate">{state.stageTitle ?? ""}</span>
          <span className="text-xs text-white/40 truncate">{state.stageDetail}</span>
        </div>
        <div className="flex items-center gap-4">
          {clockString && (
            <div className="flex items-center gap-1.5">
              <ClockIcon size={14} className="text-[#7c6af7]" />
              <span className="font-mono text-base tabular-nums">{clockString}</span>
            </div>
          )}
          {timerActive && (
            <div className={`flex items-center gap-1.5 ${remaining === 0 ? "text-red-400" : ""}`}>
              <TimerIcon size={14} className={remaining === 0 ? "text-red-400" : "text-[#7c6af7]"} />
              <span className="font-mono text-base tabular-nums">
                {remaining === 0 ? "00:00" : fmt(remaining)}
                <span className="text-white/35 ml-2">/ elapsed {fmt(elapsed)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Service order */}
        <div className="w-[16cqw] min-w-[200px] border-r border-white/10 bg-[#16162a] p-2 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-2 py-1">Service Order</p>
          {(state.serviceOrder ?? []).map((item, idx) => (
            <div
              key={item.id}
              className={`px-2.5 py-1.5 rounded border ${
                idx === (state.activeStageIndex ?? -1)
                  ? "border-[#7c6af7]/60 bg-[#7c6af7]/20"
                  : "border-white/5 bg-white/5"
              }`}
            >
              <p className="text-xs font-medium truncate">{idx + 1}. {item.title}</p>
              {item.detail ? <p className="text-[9px] text-white/35 truncate">{item.detail}</p> : null}
            </div>
          ))}
        </div>

        {/* Current slide */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[1200px] bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="w-full h-full flex items-center justify-center p-[6cqw]">
              {state.text ? (
                <p className="text-white text-center whitespace-pre-line" style={{ fontSize: "clamp(24px, 4.5vw, 72px)", lineHeight: 1.4 }}>{state.text}</p>
              ) : (
                <p className="text-white/25 text-2xl">No slide selected</p>
              )}
            </div>
          </div>
        </div>

        {/* Right rail: next slide + notes */}
        <div className="w-[22cqw] min-w-[260px] border-l border-white/10 bg-[#16162a] p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Next Slide</p>
            <p className="text-xs text-white/55 whitespace-pre-line leading-snug">{state.stageNext || "—"}</p>
          </div>
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-400/20 p-3 flex-1 min-h-[120px]">
            <div className="flex items-center gap-1 mb-1.5">
              <StickyNote size={12} className="text-yellow-400/80" />
              <p className="text-[9px] uppercase tracking-widest text-yellow-400/70">Speaker Notes</p>
            </div>
            <p className="text-sm text-yellow-100/85 whitespace-pre-line leading-relaxed">{state.stageNotes || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
