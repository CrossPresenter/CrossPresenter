/**
 * Overlay maths shared by the renderer and the control panel.
 *
 * Timers are stored as `startedAt` + `accumulatedMs` rather than a ticking
 * remaining value: a live window that mounts mid-service can compute exactly
 * the same number from the same two fields, without a per-second IPC stream.
 */

import type { Overlay, OverlayKind, TimerOverlay } from "./types";

export const OVERLAY_POSITIONS: { value: Overlay["position"]; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "middle-center", label: "Middle centre" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
];

export const OVERLAY_KIND_LABELS: Record<OverlayKind, string> = {
  timer: "Timer",
  clock: "Clock",
  message: "Message",
  logo: "Logo",
};

/** Milliseconds a timer has run, including the current run. */
export function overlayElapsedMs(o: TimerOverlay, now: number): number {
  return o.accumulatedMs + (o.startedAt != null ? Math.max(0, now - o.startedAt) : 0);
}

/** Countdown time left; always zero or more so the display never shows negatives. */
export function overlayRemainingMs(o: TimerOverlay, now: number): number {
  return Math.max(0, o.durationMs - overlayElapsedMs(o, now));
}

export function isTimerFinished(o: TimerOverlay, now: number): boolean {
  return o.mode === "countdown" && overlayRemainingMs(o, now) <= 0;
}

/** `MM:SS`, widening to `H:MM:SS` for services longer than an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function timerText(o: TimerOverlay, now: number): string {
  const ms = o.mode === "countdown" ? overlayRemainingMs(o, now) : overlayElapsedMs(o, now);
  return formatDuration(ms);
}

export function clockText(now: number, hour12: boolean, showSeconds: boolean): string {
  return new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12,
  });
}

/** A fresh overlay of the requested kind, with sensible stage defaults. */
export function createOverlay(kind: OverlayKind, id: string): Overlay {
  switch (kind) {
    case "timer":
      return {
        id,
        kind: "timer",
        visible: true,
        position: "bottom-center",
        mode: "countdown",
        durationMs: 5 * 60 * 1000,
        startedAt: null,
        accumulatedMs: 0,
        label: "Service starts in",
      };
    case "clock":
      return {
        id,
        kind: "clock",
        visible: true,
        position: "top-right",
        hour12: true,
        showSeconds: true,
      };
    case "message":
      return {
        id,
        kind: "message",
        visible: true,
        position: "bottom-center",
        text: "Welcome! Our service begins shortly.",
        fontSize: 46,
        color: "#ffffff",
        background: "rgba(0, 0, 0, 0.62)",
        scroll: false,
      };
    case "logo":
      return {
        id,
        kind: "logo",
        visible: true,
        position: "top-left",
        src: "",
        widthPercent: 14,
      };
  }
}
