/**
 * In-app update state.
 *
 * Deliberately separate from the show store: this is the only part of the UI
 * that talks to the network, and a failed check (a laptop with no internet on
 * a Sunday morning) must never disturb a service. Only the operator window
 * checks — projection windows have no updater UI.
 */

import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

import { IS_TAURI, errorMessage, windowRole } from "../lib/tauri";
import { useStore } from "./store";

/** Let the operator window settle before the first background check. */
export const UPDATE_FIRST_CHECK_MS = 5000;
/** Check every two minutes so a newly published release is offered promptly. */
export const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 1000;

const DISMISSED_KEY = "cp.updates.dismissed";

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing";

interface UpdateState {
  phase: UpdatePhase;
  update: Update | null;
  /** 0–100, or null while the download size is not known yet. */
  progress: number | null;
  /** `manual` shows a toast for "up to date" and surfacing errors. */
  check: (manual?: boolean) => Promise<void>;
  install: () => Promise<void>;
  /** "Later": remember this version so the background check stays quiet. */
  dismiss: () => void;
}

function toast(kind: "success" | "error" | "info", message: string) {
  useStore.getState().toast(kind, message);
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function rememberDismissed(version: string) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    /* private mode / quota: simply prompt again on the next launch */
  }
}

export const useUpdates = create<UpdateState>((set, get) => ({
  phase: "idle",
  update: null,
  progress: null,

  check: async (manual = false) => {
    if (!IS_TAURI || windowRole() !== "operator") return;
    // One operation at a time: a background tick must not close the resource
    // the modal is currently showing.
    if (get().phase !== "idle") return;

    set({ phase: "checking" });
    try {
      const update = await check({ timeout: 30_000 });
      if (!update) {
        set({ phase: "idle", update: null, progress: null });
        if (manual) toast("success", "CrossPresenter is up to date.");
        return;
      }

      // A version the operator already waved away stays quiet for background
      // checks, but an explicit "Check for updates" always surfaces it.
      if (!manual && readDismissed() === update.version) {
        await update.close().catch(() => {});
        set({ phase: "idle", update: null, progress: null });
        return;
      }

      set({ phase: "available", update, progress: null });
      if (manual) toast("info", `Version ${update.version} is available.`);
    } catch (err) {
      set({ phase: "idle", update: null, progress: null });
      // Background failures stay silent — an offline laptop is not an error
      // the operator needs to see while running a service.
      if (manual) toast("error", `Could not check for updates: ${errorMessage(err)}`);
      else console.warn("update check failed", err);
    }
  },

  install: async () => {
    const update = get().update;
    if (!update) return;

    set({ phase: "downloading", progress: null });
    let received = 0;
    let total: number | null = null;

    const onEvent = (event: DownloadEvent) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
        set({ progress: total && total > 0 ? 0 : null });
      } else if (event.event === "Progress") {
        received += event.data.chunkLength;
        set({
          progress:
            total && total > 0
              ? Math.min(100, Math.round((received / total) * 100))
              : null,
        });
      } else {
        // The bytes are on disk; the NSIS installer takes over from here.
        set({ phase: "installing", progress: 100 });
      }
    };

    try {
      await update.downloadAndInstall(onEvent);
      // On Windows the process exits after the installer is launched and the
      // installer restarts the app. On other platforms this explicit relaunch
      // is what starts the new version.
      await relaunch();
    } catch (err) {
      set({ phase: "available", progress: null });
      toast("error", `Update failed: ${errorMessage(err)}`);
    }
  },

  dismiss: () => {
    const update = get().update;
    if (update) {
      rememberDismissed(update.version);
      // Free the native update resource until it is needed again.
      update.close().catch(() => {});
    }
    set({ phase: "idle", update: null, progress: null });
  },
}));
