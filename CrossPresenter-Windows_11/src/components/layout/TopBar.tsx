/**
 * The app's only chrome outside the three-column workspace: brand mark, the
 * Main/Edit/Stage view switcher, and the Go Live control. Fixed height,
 * always visible regardless of which view is active.
 */

import { useEffect } from "react";

import { selectIsLive, useStore, type ViewName } from "../../state/store";
import { SettingsIcon } from "../common/Icons";

const TABS: { id: ViewName; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "edit", label: "Edit" },
  { id: "stage", label: "Stage" },
  { id: "bible", label: "Bible" },
];

export function TopBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const isLive = useStore(selectIsLive);
  const busy = useStore((s) => s.busy);
  const goLive = useStore((s) => s.goLive);
  const stopLive = useStore((s) => s.stopLive);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const monitors = useStore((s) => s.monitors);
  const selectedMonitorId = useStore((s) => s.selectedMonitorId);
  const setSelectedMonitorId = useStore((s) => s.setSelectedMonitorId);
  const refreshMonitors = useStore((s) => s.refreshMonitors);

  useEffect(() => {
    void refreshMonitors();
  }, [refreshMonitors]);

  const selectedId =
    selectedMonitorId ?? (monitors.length > 0 ? monitors[0].id : "");

  return (
    <header className="flex h-11 flex-none items-center justify-between border-b border-shell-800 bg-shell-900 px-3">
      <div className="flex w-56 items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-600 text-[13px] font-bold text-white">
          C
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-ink-50">CrossPresenter</span>
      </div>

      <nav className="flex items-center gap-1" role="tablist" aria-label="View">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={view === tab.id}
            className="cp-tab"
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex w-56 items-center justify-end gap-2">
        <select
          className="cp-btn !px-2 !py-1 text-[11px] max-w-[150px]"
          title="Display to broadcast to"
          value={selectedId}
          disabled={busy != null || isLive}
          onChange={(event) => setSelectedMonitorId(event.target.value || null)}
        >
          {monitors.length === 0 ? (
            <option value="">No displays</option>
          ) : (
            monitors.map((monitor) => (
              <option key={monitor.id} value={monitor.id}>
                {monitor.name} ({monitor.width}×{monitor.height})
              </option>
            ))
          )}
        </select>
        <button
          className="cp-go-live"
          data-live={isLive}
          disabled={busy != null}
          title={isLive ? "Stop live output" : "Go live"}
          aria-pressed={isLive}
          onClick={() => (isLive ? stopLive() : goLive())}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-white">
            {isLive ? "On" : "Go"}
          </span>
        </button>
        <button className="cp-btn-ghost cp-btn !px-1.5" title="Settings" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
