/**
 * The overlay layer: timers, clock, messages and logos drawn above a slide.
 *
 * Rendered inside `SlideCanvas` only when the caller passes overlays, so the
 * slide grid and filmstrip stay clean while the live output, the operator
 * preview and the stage monitor show the full composite.
 *
 * Timers tick locally from `startedAt`, which is why a projector connected
 * halfway through a countdown shows the correct remaining time on its first
 * frame instead of waiting for the operator's next event.
 */

import { useEffect, useState } from "react";

import { CANVAS_HEIGHT } from "../../lib/defaults";
import { clockText, timerText } from "../../lib/overlays";
import { assetUrl } from "../../lib/tauri";
import type { MessageOverlay, Overlay, OverlayPosition } from "../../lib/types";

/** Canvas-space px → container-relative height, matching the slide renderer. */
function cqh(px: number): string {
  return `${(px / CANVAS_HEIGHT) * 100}cqh`;
}

function verticalOf(position: OverlayPosition): "top" | "middle" | "bottom" {
  return position.split("-")[0] as "top" | "middle" | "bottom";
}

function horizontalOf(position: OverlayPosition): "left" | "center" | "right" {
  return position.split("-")[1] as "left" | "center" | "right";
}

/** Absolute placement for the nine-way anchor grid, with a small safe margin. */
function anchorStyle(position: OverlayPosition, margin = 4): React.CSSProperties {
  const v = verticalOf(position);
  const h = horizontalOf(position);
  const transforms: string[] = [];
  if (v === "middle") transforms.push("translateY(-50%)");
  if (h === "center") transforms.push("translateX(-50%)");
  return {
    position: "absolute",
    top: v === "top" ? `${margin}%` : v === "middle" ? "50%" : undefined,
    bottom: v === "bottom" ? `${margin}%` : undefined,
    left: h === "left" ? `${margin}%` : h === "center" ? "50%" : undefined,
    right: h === "right" ? `${margin}%` : undefined,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
  };
}

export function OverlayLayer({ overlays }: { overlays: Overlay[] }) {
  const running = overlays.some((o) => o.kind === "timer" && o.startedAt != null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Quarter-second ticks keep a running timer snappy without streaming state
    // over IPC; an idle layer only needs to service the clock once a second.
    const id = window.setInterval(() => setNow(Date.now()), running ? 250 : 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const visible = overlays.filter((o) => o.visible);
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {visible.map((overlay) => (
        <SingleOverlay key={overlay.id} overlay={overlay} now={now} />
      ))}
    </div>
  );
}

function SingleOverlay({ overlay, now }: { overlay: Overlay; now: number }) {
  switch (overlay.kind) {
    case "timer": {
      return (
        <div
          style={anchorStyle(overlay.position)}
          className="rounded-[1.1cqh] bg-black/62 px-[2.4cqh] py-[1cqh] text-center shadow-[0_1cqh_3cqh_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
          {overlay.label.trim() && (
            <div className="text-[2.2cqh] font-medium uppercase tracking-[0.18em] text-white/70">
              {overlay.label}
            </div>
          )}
          <div className="font-mono text-[9cqh] font-semibold leading-none tabular-nums text-white">
            {timerText(overlay, now)}
          </div>
        </div>
      );
    }

    case "clock":
      return (
        <div
          style={anchorStyle(overlay.position)}
          className="rounded-[0.9cqh] bg-black/58 px-[1.8cqh] py-[0.7cqh] font-mono text-[5.4cqh] font-semibold leading-none tabular-nums text-white backdrop-blur-sm"
        >
          {clockText(now, overlay.hour12, overlay.showSeconds)}
        </div>
      );

    case "message":
      return <MessageView overlay={overlay} />;

    case "logo":
      return overlay.src ? (
        <img
          src={assetUrl(overlay.src)}
          alt=""
          draggable={false}
          style={{ ...anchorStyle(overlay.position), width: `${overlay.widthPercent}%` }}
          className="object-contain drop-shadow-[0_0.6cqh_1.6cqh_rgba(0,0,0,0.55)]"
        />
      ) : null;

    default:
      return null;
  }
}

function MessageView({ overlay }: { overlay: MessageOverlay }) {
  const vertical = verticalOf(overlay.position);
  const verticalStyle: React.CSSProperties =
    vertical === "top"
      ? { top: "4%" }
      : vertical === "middle"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: "4%" };

  if (overlay.scroll) {
    return (
      <div
        style={{ ...verticalStyle, position: "absolute", left: 0, right: 0 }}
        className="overflow-hidden py-[0.6cqh]"
      >
        <div
          className="cp-ticker inline-block whitespace-nowrap px-[2cqh] py-[0.8cqh]"
          style={{
            fontSize: cqh(overlay.fontSize),
            color: overlay.color,
            background: overlay.background,
          }}
        >
          {overlay.text}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ ...anchorStyle(overlay.position), maxWidth: "86%" }}
      className="rounded-[0.9cqh] px-[2.4cqh] py-[1.2cqh] text-center leading-snug"
    >
      <span
        style={{
          fontSize: cqh(overlay.fontSize),
          color: overlay.color,
          background: overlay.background,
          padding: "0.5cqh 1.4cqh",
          borderRadius: "0.7cqh",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}
