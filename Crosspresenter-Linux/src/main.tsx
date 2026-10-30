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
import { windowRole } from "./lib/tauri";
import { App } from "./App";
import { LiveOutputView } from "./components/live/LiveOutputView";

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
  const stack = detail instanceof Error ? detail.stack : undefined;
  el.textContent = `${label}\n\n${stack ?? String(detail)}`;
  document.body.appendChild(el);
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
