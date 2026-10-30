// Builds a zero-install portable Windows package.
//
// Tauri ships a single self-contained release executable that runs without an
// installer or administrator rights. This script zips that executable into a
// portable archive and writes an accompanying SHA-256 sidecar so the download
// can be verified — matching the "portable execution" + "security integrity"
// requirements.
//
// Usage (after a release build):
//   npm run bundle:portable
//     ...or explicitly:  cargo build --release && node scripts/make-portable-zip.mjs
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = join(root, "src-tauri", "target", "release");

// Product name + version come from the Tauri config so naming stays in sync.
const conf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const version = conf.version ?? "0.0.0";
const productName = conf.productName ?? "CrossPresenter";

if (!existsSync(releaseDir)) {
  console.error(`No release build found at ${releaseDir}.`);
  console.error("Build one first:  npm run bundle   (or: cargo build --release)");
  process.exit(1);
}

// Locate the standalone release executable (fall back to any .exe in the dir).
let exePath = join(releaseDir, "crosspresenter.exe");
if (!existsSync(exePath)) {
  const candidate = readdirSync(releaseDir).find((f) => f.toLowerCase().endsWith(".exe"));
  if (candidate) exePath = join(releaseDir, candidate);
}
if (!existsSync(exePath)) {
  console.error(`No release executable located in ${releaseDir}.`);
  console.error("Build one first:  npm run bundle   (or: cargo build --release)");
  process.exit(1);
}

const outDir = join(root, "dist-portable");
mkdirSync(outDir, { recursive: true });

const zipName = `${productName}-${version}-windows-x64-portable.zip`;
const zipPath = join(outDir, zipName);
rmSync(zipPath, { force: true });

// Stage the exe under a friendly name plus a short usage note.
const stage = join(outDir, "_stage");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
copyFileSync(exePath, join(stage, `${productName}.exe`));
writeFileSync(
  join(stage, "README-portable.txt"),
  [
    `${productName} ${version} — Portable (Windows x64)`,
    ``,
    `Run ${productName}.exe directly. No installation and no administrator`,
    `rights are required. Settings and shows are stored under your user`,
    `profile (%APPDATA%).`,
    ``,
    `Verify this archive with the accompanying .sha256 file.`,
  ].join("\n"),
);

execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipPath}' -Force`,
  ],
  { stdio: "inherit" },
);
rmSync(stage, { recursive: true, force: true });

const zipBytes = readFileSync(zipPath);
const hash = createHash("sha256").update(zipBytes).digest("hex");
writeFileSync(`${zipPath}.sha256`, `${hash}  ${zipName}\n`);

console.log(`Portable package : ${zipPath}`);
console.log(`Size             : ${(zipBytes.length / 1048576).toFixed(1)} MB`);
console.log(`SHA-256          : ${hash}`);
