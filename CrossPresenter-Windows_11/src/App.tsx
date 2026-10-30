/**
 * The operator window's shell: topbar + whichever view is active. Main is the
 * three-column live-control layout; Edit and Stage are full-bleed views below
 * the same topbar, per the spec's tab model (they are not separate OS windows —
 * see monitors.rs, which never opens a `stage-` labelled window).
 */

import { useEffect } from "react";

import { useStore } from "./state/store";
import { TopBar } from "./components/layout/TopBar";
import { MainView } from "./components/layout/MainView";
import { EditView } from "./components/edit/EditView";
import { StageView } from "./components/stage/StageView";
import { BibleView } from "./components/bible/BibleView";
import { BibleModal } from "./components/bible/BibleModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { Toasts } from "./components/common/Toasts";
import { UpdatePrompt } from "./components/updates/UpdatePrompt";
import { useRemoteBridge } from "./lib/remoteBridge";

export function App() {
  const view = useStore((s) => s.view);
  const refreshMonitors = useStore((s) => s.refreshMonitors);
  const bibleOpen = useStore((s) => s.bibleOpen);
  const settingsOpen = useStore((s) => s.settingsOpen);

  useRemoteBridge();

  useEffect(() => {
    refreshMonitors();
  }, [refreshMonitors]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-shell-950 text-ink-200">
      <TopBar />

      {view === "main" && <MainView />}

      {view === "edit" && <EditView />}
      {view === "stage" && <StageView />}
      {view === "bible" && <BibleView />}

      {bibleOpen && <BibleModal />}
      {settingsOpen && <SettingsModal />}
      <UpdatePrompt />
      <Toasts />
    </div>
  );
}
