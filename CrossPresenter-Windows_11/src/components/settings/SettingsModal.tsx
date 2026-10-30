/**
 * Settings: the two things an operator actually needs mid-service — which
 * displays are receiving the live output, and what transition new slides
 * project with by default. Everything here is backed by store state and Rust
 * commands that already exist (`monitors.rs`'s enumeration + window commands),
 * so this is exposing wiring, not inventing it.
 */

import { useEffect } from "react";

import { APP_VERSION } from "../../lib/defaults";
import { TRANSITIONS } from "../../lib/types";
import { useStore } from "../../state/store";
import { useUpdates } from "../../state/updates";
import { MonitorIcon } from "../common/Icons";
import { Modal } from "../common/Modal";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";

export function SettingsModal() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const monitors = useStore((s) => s.monitors);
  const liveMonitors = useStore((s) => s.liveMonitors);
  const refreshMonitors = useStore((s) => s.refreshMonitors);
  const toggleMonitor = useStore((s) => s.toggleMonitor);
  const transition = useStore((s) => s.transition);
  const setTransition = useStore((s) => s.setTransition);
  const updatePhase = useUpdates((s) => s.phase);
  const checkForUpdates = useUpdates((s) => s.check);
  const remoteInfo = useStore((s) => s.remoteInfo);
  const remoteClients = useStore((s) => s.remoteClients);
  const setRemoteInfo = useStore((s) => s.setRemoteInfo);
  const setRemoteClients = useStore((s) => s.setRemoteClients);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    refreshMonitors();
    (async () => {
      try {
        await invoke("remote_start");
        const info = (await invoke("remote_info")) as {
          connected: number;
        } & Record<string, unknown>;
        setRemoteInfo(info as never);
        setRemoteClients(info.connected ?? 0);
      } catch (error) {
        console.warn("remote server did not start", error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateToken = async () => {
    try {
      const info = (await invoke("remote_regenerate_token")) as {
        connected: number;
      } & Record<string, unknown>;
      setRemoteInfo(info as never);
      setRemoteClients(info.connected ?? 0);
      toast("success", "Pairing rotated. Rescan the QR on every phone.");
    } catch (error) {
      toast("error", String(error));
    }
  };

  return (
    <Modal title="Settings" onClose={() => setSettingsOpen(false)} widthClassName="max-w-md">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="cp-label">Projection Displays</span>
            <button className="cp-btn-ghost cp-btn !px-2 !py-1" onClick={() => refreshMonitors()}>
              Refresh
            </button>
          </div>

          {monitors.length === 0 ? (
            <p className="px-1 text-[12px] text-ink-500">
              No secondary display detected. Connect a projector or extend your desktop.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {monitors.map((m) => {
                const isLive = liveMonitors.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="cp-panel flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 text-[12px] text-ink-200">
                      <MonitorIcon className="h-4 w-4 flex-none text-ink-500" />
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-50">{m.name}</span>
                        <span className="text-[11px] text-ink-500">
                          {m.width}×{m.height}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`cp-btn !px-2.5 !py-1 ${isLive ? "cp-btn-primary" : ""}`}
                      onClick={() => toggleMonitor(m.id)}
                    >
                      {isLive ? "Live" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className="cp-label">Default Transition</span>
          <div className="flex flex-wrap gap-1.5">
            {TRANSITIONS.map((t) => (
              <button
                key={t.value}
                className="cp-tab"
                aria-selected={transition === t.value}
                onClick={() => setTransition(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between border-t border-shell-800 pt-3">
          <div className="flex flex-col">
            <span className="text-[12px] text-ink-200">Updates</span>
            <span className="text-[11px] text-ink-500">CrossPresenter v{APP_VERSION}</span>
          </div>
          <button
            className="cp-btn !px-2.5 !py-1"
            disabled={updatePhase !== "idle"}
            onClick={() => void checkForUpdates(true)}
          >
            {updatePhase === "checking" ? "Checking…" : "Check for updates"}
          </button>
        </section>

        <section className="flex flex-col gap-2 border-t border-shell-800 pt-3">
          <span className="cp-label">Remote Control</span>
          {remoteInfo ? (
            <>
              <p className="text-[11px] text-ink-500">
                {remoteClients} phone{remoteClients === 1 ? "" : "s"} connected · port{" "}
                {remoteInfo.port}
              </p>
              <div className="flex justify-center rounded-xl bg-white p-3">
                <QRCodeSVG value={remoteInfo.pairUri} size={176} />
              </div>
              <p className="break-all text-[10px] text-ink-500">{remoteInfo.pairUri}</p>
              <button className="cp-btn !px-2.5 !py-1 self-start" onClick={() => void rotateToken()}>
                Rotate pairing token
              </button>
            </>
          ) : (
            <p className="text-[12px] text-ink-500">Starting the remote server…</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
