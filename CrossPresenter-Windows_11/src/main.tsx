/**
 * Single entry point for every window in the app.
 *
 * Operator, live-projection and stage windows all load this same bundle —
 * `windowRole()` tells them apart by window label prefix — so there is one
 * warm JS context and one place to fix a rendering bug, not a second HTML
 * document to keep in sync.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../src/styles.css";
import { onLiveStateRequest, publishLiveState, windowRole } from "./lib/tauri";
import { App } from "./App";
import { LiveOutputView } from "./components/live/LiveOutputView";
import { useStore } from "./state/store";

/**
 * There's no error boundary anywhere in the tree, and the body background is
 * near-black (#08090c) — so an uncaught render/effect error unmounts React
 * back to nothing and looks exactly like the screen "going black". This
 * surfaces the real error on top of that black background instead of hiding
 * it, so the actual crash is visible instead of a silent blank screen.
 */
function showCrashOverlay(label: string, detail: unknown) {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.zIndex = "999999";
  el.style.background = "#08090c";
  el.style.color = "#ff6b6b";
  el.style.font = "12px/1.5 Consolas, monospace";
  el.style.whiteSpace = "pre-wrap";
  el.style.padding = "24px";
  el.style.overflow = "auto";
  el.style.cursor = "pointer";
  const stack = detail instanceof Error ? detail.stack : undefined;
  el.textContent = `${label}\n\n${stack ?? String(detail)}\n\n— click anywhere or press Esc to dismiss —`;
  // Dismissible: once the operator has read it, they must be able to clear the
  // screen and keep working without restarting the app.
  const dismiss = () => el.remove();
  el.addEventListener("click", dismiss, { once: true });
  el.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dismiss();
  });
  el.tabIndex = -1;
  document.body.appendChild(el);
  el.focus();
}

window.addEventListener("error", (event) => {
  showCrashOverlay(`Uncaught error: ${event.message}`, event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  showCrashOverlay("Unhandled promise rejection:", event.reason);
});

function Root() {
  const role = windowRole();
  if (role === "live") return <LiveOutputView />;
  // Stage windows are not opened separately today (see monitors.rs) — the
  // Stage view lives as an in-app tab in the operator window instead.
  return <App />;
}

// A live window mounts with no state of its own and asks to be re-sent
// whatever is on air; the operator window answers that request.
if (windowRole() !== "live") {
  onLiveStateRequest(() => {
    const store = useStore.getState();
    store.republishLive();
    publishLiveState(useStore.getState().live);
  }).catch((err) => {
    console.warn("could not subscribe to live-state requests", err);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
