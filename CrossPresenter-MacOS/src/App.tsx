/**
 * The operator window's shell: topbar + whichever view is active. Main is the
 * three-column live-control layout; Edit and Stage are full-bleed views below
 * the same topbar, per the spec's tab model (they are not separate OS windows —
 * see monitors.rs, which never opens a `stage-` labelled window).
 */

import { useEffect } from "react";

import { useStore } from "./state/store";
import { TopBar } from "./components/layout/TopBar";
import { LeftSidebar } from "./components/layout/LeftSidebar";
import { CenterWorkspace } from "./components/layout/CenterWorkspace";
import { RightPanel } from "./components/layout/RightPanel";
import { EditView } from "./components/edit/EditView";
import { StageView } from "./components/stage/StageView";
import { BibleModal } from "./components/bible/BibleModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { Toasts } from "./components/common/Toasts";

export function App() {
  const view = useStore((s) => s.view);
  const refreshMonitors = useStore((s) => s.refreshMonitors);
  const bibleOpen = useStore((s) => s.bibleOpen);
  const settingsOpen = useStore((s) => s.settingsOpen);

  useEffect(() => {
    refreshMonitors();
  }, [refreshMonitors]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-shell-950 text-ink-200">
      <TopBar />

      {view === "main" && (
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar />
          <CenterWorkspace />
          <RightPanel />
        </div>
      )}

      {view === "edit" && <EditView />}
      {view === "stage" && <StageView />}

      {bibleOpen && <BibleModal />}
      {settingsOpen && <SettingsModal />}
      <Toasts />
    </div>
  );
}
