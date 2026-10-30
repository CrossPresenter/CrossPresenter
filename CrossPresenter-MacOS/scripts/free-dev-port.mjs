// Kills whatever is still bound to the Vite dev port before a new "tauri dev"
// launch starts one. Tauri's beforeDevCommand only replaces its own child
// process tree; a prior session killed uncleanly (Ctrl+C that didn't
// propagate, or an external kill of just the top-level node process) can
// leave its vite child bound to the port, which makes the next launch fail
// with "Port 1420 is already in use" while a stray CrossPresenter window from
// that prior session sits open against a dev server that no longer exists.
import { execFileSync } from "node:child_process";

const PORT = 1420;

function pidsOnPort(port) {
  let out;
  try {
    out = execFileSync("lsof", ["-i", `tcp:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    });
  } catch {
    return [];
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

for (const pid of pidsOnPort(PORT)) {
  try {
    execFileSync("kill", ["-9", pid], { stdio: "ignore" });
    console.log(`[free-dev-port] killed stale process ${pid} on port ${PORT}`);
  } catch {
    // Already gone, or not killable — either way, don't block the dev launch.
  }
}
