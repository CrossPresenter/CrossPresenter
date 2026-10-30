/**
 * Bridges the desktop's wireless remote-control server to the operator store.
 *
 * The Rust side owns the socket and pairing token; this module owns the
 * translation between the phone's small command vocabulary and the store's
 * actions, plus the publication of state snapshots back to the phone.
 */

import { useEffect, useRef } from "react";

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { useStore } from "../state/store";
import type { RemoteInfo, Slide } from "../lib/types";

interface RemoteCommand {
  clientId: number;
  id: string;
  seq: number;
  action: string;
  args: Record<string, unknown> | null;
}

let revision = 0;

function slideLines(slide: Slide | null): string[] {
  if (!slide) return [];
  const lines: string[] = [];
  for (const layer of slide.layers) {
    if (layer.type !== "text" || !layer.visible) continue;
    for (const part of (layer as { text: string }).text.split(/\r?\n/)) {
      if (part.trim().length > 0) lines.push(part);
    }
  }
  return lines;
}

function toRemoteState(): Record<string, unknown> {
  const s = useStore.getState();
  revision += 1;
  const activeItem = s.show.items.find((item) => item.id === s.liveItemId) ?? null;
  const slides = activeItem?.slides ?? [];
  const liveSlideIndex = slides.findIndex((slide) => slide.id === s.liveSlideId);
  const slideIndex = liveSlideIndex >= 0 ? liveSlideIndex : 0;

  const timerRemaining = (overlay: { kind: string; mode?: string; durationMs?: number; startedAt?: number | null; accumulatedMs?: number }): number => {
    if (overlay.kind !== "timer") return 0;
    const accumulated = overlay.accumulatedMs ?? 0;
    if (overlay.startedAt == null) return Math.max(0, (overlay.durationMs ?? 0) - accumulated);
    return Math.max(0, (overlay.durationMs ?? 0) - (accumulated + (Date.now() - (overlay.startedAt ?? 0))));
  };

  return {
    rev: revision,
    show: {
      title: s.show.title,
      items: s.show.items.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        slideCount: item.slides.length,
      })),
    },
    live: {
      active: s.liveMonitors.length > 0,
      itemId: s.liveItemId,
      slideId: s.liveSlideId,
      itemTitle: activeItem?.title ?? null,
      slideIndex,
      slideCount: slides.length,
      blank: s.live.black,
      clearText: s.live.textCleared,
      clearBackground: s.live.backgroundCleared,
    },
    slide: s.live.slide
      ? {
          id: s.live.slide.id,
          label: s.live.slide.label,
          lines: slideLines(s.live.slide),
          nextLabel: slides[slideIndex + 1]?.label ?? null,
        }
      : null,
    audio: s.audioPlayback
      ? { playing: true, title: s.audioPlayback.name, loop: s.audioPlayback.loop }
      : { playing: false, title: null, loop: false },
    overlays: s.live.overlays.map((overlay) => ({
      id: overlay.id,
      kind: overlay.kind,
      running: overlay.visible && (overlay.kind !== "timer" || overlay.startedAt != null),
      remainingMs: timerRemaining(overlay),
    })),
    monitors: s.monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      width: monitor.width,
      height: monitor.height,
    })),
  };
}

async function publishState(): Promise<number> {
  const state = toRemoteState();
  try {
    await invoke("remote_publish_state", { state: JSON.stringify(state) });
  } catch (error) {
    console.warn("remote_publish_state failed", error);
  }
  return revision;
}

async function handleCommand(action: string, args: Record<string, unknown> | null): Promise<void> {
  const store = useStore.getState();
  const payload = args ?? {};
  switch (action) {
    case "slide.next":
      store.advanceSlide(1);
      break;
    case "slide.prev":
      store.advanceSlide(-1);
      break;
    case "slide.goto": {
      const itemId = String(payload.itemId ?? "");
      const slideId = String(payload.slideId ?? "");
      if (!itemId || !slideId) throw new Error("Missing slide target.");
      store.projectSlide(itemId, slideId);
      break;
    }
    case "item.project": {
      const item = store.show.items.find((entry) => entry.id === payload.itemId);
      if (!item) throw new Error("That item is not in the service.");
      if (item.slides[0]) store.projectSlide(item.id, item.slides[0].id);
      break;
    }
    case "live.black":
      store.toggleBlack();
      break;
    case "live.clearText":
      store.toggleClearText();
      break;
    case "live.clearBackground":
      store.toggleClearBackground();
      break;
    case "live.stop":
      store.stopLive();
      break;
    case "audio.stop":
      store.stopAudio();
      break;
    case "audio.loop":
      store.toggleAudioLoop();
      break;
    case "overlay.timer.start":
      if (payload.id) store.startOverlayTimer(String(payload.id));
      break;
    case "overlay.timer.pause":
      if (payload.id) store.pauseOverlayTimer(String(payload.id));
      break;
    case "overlay.timer.reset":
      if (payload.id) store.resetOverlayTimer(String(payload.id));
      break;
    case "library.search": {
      const query = String(payload.query ?? "").toLowerCase().trim();
      const limit = Number(payload.limit ?? 50);
      const results = store.show.items
        .filter((item) => item.kind === "song")
        .filter((item) => {
          if (!query) return true;
          if (item.title.toLowerCase().includes(query)) return true;
          if (item.meta.author.toLowerCase().includes(query)) return true;
          return item.slides.some((slide) =>
            slide.layers.some((layer) => layer.type === "text" && layer.text.toLowerCase().includes(query)),
          );
        })
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          title: item.title,
          author: item.meta.author,
          key: item.meta.key,
          slideCount: item.slides.length,
        }));
      await invoke("remote_publish_library", {
        queryId: String(payload.queryId ?? `q-${Date.now()}`),
        songs: JSON.stringify(results),
      });
      break;
    }
    case "bible.project":
      throw new Error("Bible projection from the remote is not available yet.");
    default:
      throw new Error(`Unknown remote action: ${action}`);
  }
}

export function useRemoteBridge(): void {
  const publishTimer = useRef<number | null>(null);

  useEffect(() => {
    let unlistenCommand: UnlistenFn | null = null;
    let unlistenClients: UnlistenFn | null = null;
    let unsubscribeStore: (() => void) | null = null;

    const schedulePublish = () => {
      if (publishTimer.current !== null) window.clearTimeout(publishTimer.current);
      publishTimer.current = window.setTimeout(() => {
        publishTimer.current = null;
        void publishState();
      }, 50);
    };

    const start = async () => {
      try {
        await invoke("remote_start");
        const info = await invoke<RemoteInfo>("remote_info");
        useStore.getState().setRemoteInfo(info);
      } catch (error) {
        console.warn("remote server did not start", error);
      }

      unlistenCommand = await listen<RemoteCommand>("remote://command", async (event) => {
        const command = event.payload;
        let ok = true;
        let error: string | undefined;
        try {
          await handleCommand(command.action, command.args);
        } catch (caught) {
          ok = false;
          error = caught instanceof Error ? caught.message : String(caught);
        }
        const rev = await publishState();
        try {
          await invoke("remote_command_result", {
            clientId: command.clientId,
            id: command.id,
            seq: command.seq,
            ok,
            error,
            rev,
          });
        } catch (caught) {
          console.warn("remote_command_result failed", caught);
        }
      });

      unlistenClients = await listen<number>("remote://clients", (event) => {
        useStore.getState().setRemoteClients(event.payload);
      });

      unsubscribeStore = useStore.subscribe(schedulePublish);
      await publishState();
    };

    void start();

    return () => {
      unlistenCommand?.();
      unlistenClients?.();
      unsubscribeStore?.();
      if (publishTimer.current !== null) window.clearTimeout(publishTimer.current);
    };
  }, []);
}
