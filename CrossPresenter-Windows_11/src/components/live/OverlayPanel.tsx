/**
 * Overlay controls: timers, clock, messages and logos.
 *
 * These live in the right column rather than the document, because they are
 * stage furniture — they survive slide changes, item changes and a clear of the
 * screen. Every control writes straight to `live.overlays`, which the store
 * broadcasts to projection windows exactly like the slide itself.
 */

import { useEffect, useState } from "react";

import {
  OVERLAY_KIND_LABELS,
  OVERLAY_POSITIONS,
  clockText,
  timerText,
} from "../../lib/overlays";
import { pickMediaFiles } from "../../lib/tauri";
import type {
  ClockOverlay,
  LogoOverlay,
  MessageOverlay,
  Overlay,
  OverlayKind,
  OverlayPosition,
  TimerOverlay,
} from "../../lib/types";
import { useStore } from "../../state/store";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "../common/Icons";

const KINDS: OverlayKind[] = ["timer", "clock", "message", "logo"];

export function OverlayPanel() {
  const overlays = useStore((s) => s.live.overlays);
  const addOverlay = useStore((s) => s.addOverlay);
  const onAir = overlays.filter((o) => o.visible).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center justify-between border-b border-shell-800 px-3 py-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
          Add overlay
        </span>
        <span className="text-[10.5px] uppercase tracking-wide text-ink-500">
          {onAir > 0 ? `${onAir} on air` : "none on air"}
        </span>
      </div>

      <div className="grid flex-none grid-cols-2 gap-1.5 border-b border-shell-800 p-2.5">
        {KINDS.map((kind) => (
          <button
            key={kind}
            className="cp-btn justify-start"
            onClick={() => addOverlay(kind)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {OVERLAY_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {overlays.length === 0 ? (
          <p className="px-1 py-4 text-[12px] leading-relaxed text-ink-500">
            Timers count down to the start of the service, the clock keeps the
            platform on time, and messages and logos sit above every slide.
          </p>
        ) : (
          overlays.map((overlay) => <OverlayCard key={overlay.id} overlay={overlay} />)
        )}
      </div>
    </div>
  );
}

function OverlayCard({ overlay }: { overlay: Overlay }) {
  const update = useStore((s) => s.updateOverlay);
  const remove = useStore((s) => s.removeOverlay);
  const start = useStore((s) => s.startOverlayTimer);
  const pause = useStore((s) => s.pauseOverlayTimer);
  const reset = useStore((s) => s.resetOverlayTimer);

  const running = overlay.kind === "timer" && overlay.startedAt != null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // The card mirrors the projector, so it ticks on the same cadence: fast
    // while a timer runs, once a second for a parked clock.
    const id = window.setInterval(() => setNow(Date.now()), running ? 250 : 1000);
    return () => window.clearInterval(id);
  }, [running]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-shell-700 bg-shell-850 p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] font-semibold text-ink-100">
          {OVERLAY_KIND_LABELS[overlay.kind]}
        </span>
        <span className="ml-auto" />
        <button
          className="cp-toggle-btn"
          data-selected={overlay.visible}
          title={overlay.visible ? "Hide from live" : "Show on live"}
          onClick={() => update(overlay.id, { visible: !overlay.visible })}
        >
          {overlay.visible ? (
            <EyeIcon className="h-3.5 w-3.5" />
          ) : (
            <EyeOffIcon className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          className="cp-toggle-btn"
          title="Remove overlay"
          onClick={() => remove(overlay.id)}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {overlay.kind === "timer" && (
        <TimerBody
          overlay={overlay}
          now={now}
          running={running}
          onStart={() => start(overlay.id)}
          onPause={() => pause(overlay.id)}
          onReset={() => reset(overlay.id)}
        />
      )}
      {overlay.kind === "clock" && <ClockBody overlay={overlay} now={now} />}
      {overlay.kind === "message" && <MessageBody overlay={overlay} />}
      {overlay.kind === "logo" && <LogoBody overlay={overlay} />}

      <PositionRow
        value={overlay.position}
        onChange={(position) => update(overlay.id, { position })}
      />
    </div>
  );
}

function TimerBody({
  overlay,
  now,
  running,
  onStart,
  onPause,
  onReset,
}: {
  overlay: TimerOverlay;
  now: number;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const update = useStore((s) => s.updateOverlay);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-ink-50">
          {timerText(overlay, now)}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            className={running ? "cp-btn" : "cp-btn cp-btn-primary"}
            onClick={running ? onPause : onStart}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button className="cp-btn" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wide text-ink-500">
          Mode
          <select
            className="cp-input"
            value={overlay.mode}
            onChange={(e) =>
              update(overlay.id, { mode: e.target.value as TimerOverlay["mode"] })
            }
          >
            <option value="countdown">Countdown</option>
            <option value="elapsed">Elapsed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wide text-ink-500">
          Minutes
          <input
            type="number"
            min={0}
            max={600}
            className="cp-input"
            value={Math.round(overlay.durationMs / 60000)}
            onChange={(e) =>
              update(overlay.id, {
                durationMs: Math.max(0, Number(e.target.value)) * 60000,
              })
            }
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-wide text-ink-500">
        Caption
        <input
          className="cp-input"
          value={overlay.label}
          placeholder="Service starts in"
          onChange={(e) => update(overlay.id, { label: e.target.value })}
        />
      </label>
    </>
  );
}

function ClockBody({ overlay, now }: { overlay: ClockOverlay; now: number }) {
  const update = useStore((s) => s.updateOverlay);

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[20px] font-semibold leading-none tabular-nums text-ink-50">
        {clockText(now, overlay.hour12, overlay.showSeconds)}
      </span>
      <div className="ml-auto flex gap-1">
        <button
          className="cp-toggle-btn"
          data-selected={overlay.hour12}
          title="12-hour clock"
          onClick={() => update(overlay.id, { hour12: !overlay.hour12 })}
        >
          12h
        </button>
        <button
          className="cp-toggle-btn"
          data-selected={overlay.showSeconds}
          title="Show seconds"
          onClick={() => update(overlay.id, { showSeconds: !overlay.showSeconds })}
        >
          :ss
        </button>
      </div>
    </div>
  );
}

function MessageBody({ overlay }: { overlay: MessageOverlay }) {
  const update = useStore((s) => s.updateOverlay);

  return (
    <>
      <textarea
        className="cp-input min-h-[52px] resize-y leading-snug"
        value={overlay.text}
        placeholder="Welcome! Our service begins shortly."
        onChange={(e) => update(overlay.id, { text: e.target.value })}
      />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink-300">
          <input
            type="checkbox"
            checked={overlay.scroll}
            onChange={(e) => update(overlay.id, { scroll: e.target.checked })}
          />
          Scroll
        </label>
        <span className="ml-auto text-[10.5px] uppercase tracking-wide text-ink-500">
          Size
        </span>
        <input
          type="number"
          min={10}
          max={240}
          className="cp-input w-16"
          value={overlay.fontSize}
          onChange={(e) =>
            update(overlay.id, { fontSize: Math.max(10, Number(e.target.value)) })
          }
        />
      </div>
    </>
  );
}

function LogoBody({ overlay }: { overlay: LogoOverlay }) {
  const update = useStore((s) => s.updateOverlay);

  const choose = async () => {
    const files = await pickMediaFiles();
    if (files[0]) update(overlay.id, { src: files[0] });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button className="cp-btn flex-1" onClick={choose}>
          {overlay.src ? "Change image…" : "Choose image…"}
        </button>
        <input
          type="number"
          min={4}
          max={100}
          className="cp-input w-16"
          title="Width, percent of screen"
          value={overlay.widthPercent}
          onChange={(e) =>
            update(overlay.id, {
              widthPercent: Math.min(100, Math.max(4, Number(e.target.value))),
            })
          }
        />
      </div>
      {overlay.src && (
        <p className="truncate text-[10.5px] text-ink-500" title={overlay.src}>
          {overlay.src.split(/[\\/]/).pop()}
        </p>
      )}
    </>
  );
}

function PositionRow({
  value,
  onChange,
}: {
  value: OverlayPosition;
  onChange: (position: OverlayPosition) => void;
}) {
  return (
    <select
      className="cp-input"
      value={value}
      onChange={(e) => onChange(e.target.value as OverlayPosition)}
    >
      {OVERLAY_POSITIONS.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
