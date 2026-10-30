/**
 * The update prompt.
 *
 * A modal rather than a toast: installing is a deliberate action that closes
 * the app and reopens it, so the operator gets one clear decision with the
 * version number and release notes. Background checks only ever surface the
 * modal when there is something to install.
 */

import { useEffect } from "react";

import { IS_TAURI, windowRole } from "../../lib/tauri";
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_FIRST_CHECK_MS,
  useUpdates,
} from "../../state/updates";
import { Modal } from "../common/Modal";

export function UpdatePrompt() {
  const phase = useUpdates((s) => s.phase);
  const update = useUpdates((s) => s.update);
  const progress = useUpdates((s) => s.progress);
  const check = useUpdates((s) => s.check);
  const install = useUpdates((s) => s.install);
  const dismiss = useUpdates((s) => s.dismiss);

  useEffect(() => {
    if (!IS_TAURI || windowRole() !== "operator") return;
    // Give the app time to paint and reconnect to any live output before
    // spending a moment on the network.
    const first = window.setTimeout(() => void check(), UPDATE_FIRST_CHECK_MS);
    const timer = window.setInterval(() => void check(), UPDATE_CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [check]);

  if (!update || (phase !== "available" && phase !== "downloading" && phase !== "installing")) {
    return null;
  }

  const busy = phase !== "available";
  const notes = update.body?.trim();

  return (
    <Modal
      title={phase === "installing" ? "Installing update…" : "Update available"}
      onClose={busy ? () => {} : dismiss}
      widthClassName="max-w-md"
      footer={
        busy ? (
          <span className="text-[11px] text-ink-500">
            {phase === "installing"
              ? "Restarting with the new version…"
              : "Please keep the app open while it downloads."}
          </span>
        ) : (
          <>
            <button className="cp-btn cp-btn-ghost" onClick={dismiss}>
              Later
            </button>
            <button className="cp-btn cp-btn-primary" onClick={() => void install()}>
              Install update
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-200">
          CrossPresenter{" "}
          <span className="font-semibold text-ink-50">{update.version}</span> is ready to
          install. You are on {update.currentVersion}.
        </p>

        {notes && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-md border border-shell-800 bg-shell-900 p-3 text-[11.5px] leading-relaxed text-ink-300">
            {notes}
          </div>
        )}

        {busy && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-shell-800">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-200"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <span className="text-[11px] text-ink-500">
              {progress === null ? "Downloading…" : `${progress}% downloaded`}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
