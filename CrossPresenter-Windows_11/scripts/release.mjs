#!/usr/bin/env node
/**
 * Build and publish a signed CrossPresenter release from this laptop.
 *
 * Why local: a release build is the one thing that takes long in CI, and the
 * operator wants to ship a fix without waiting for a matrix of three runners.
 * GitHub Actions still builds every push for verification; this script is the
 * release path.
 *
 * What it does:
 *   1. bumps the version in package.json, tauri.conf.json, Cargo.toml and
 *      src/lib/defaults.ts (all four must agree),
 *   2. builds the signed NSIS installer + MSI with the updater key,
 *   3. commits and pushes the version bump,
 *   4. publishes a GitHub Release with the installer, its signature and the
 *      `latest.json` manifest the in-app updater reads.
 *
 * Usage:
 *   npm run release
 *   npm run release -- --bump minor --notes "New song search"
 *   npm run release -- --version 1.2.0
 *
 * The signing key lives outside the repo by default:
 *   %USERPROFILE%\.tauri\crosspresenter.key
 *   %USERPROFILE%\.tauri\crosspresenter.password
 * Override with TAURI_SIGNING_PRIVATE_KEY_PATH / TAURI_SIGNING_KEY_PASSWORD_FILE.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "CrossPresenter/CrossPresenter";
const DEFAULT_NOTES = "CrossPresenter update — signed build published from the release laptop.";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

function takeValue(flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) {
    fail(`${flag} needs a value`);
  }
  argv.splice(i, 2);
  return value;
}

const allowDirty = argv.includes("--allow-dirty");
if (allowDirty) argv.splice(argv.indexOf("--allow-dirty"), 1);

const exactVersion = takeValue("--version");
const bump = takeValue("--bump") ?? (exactVersion ? undefined : "patch");
const notes = takeValue("--notes") ?? DEFAULT_NOTES;

if (argv.length > 0) {
  fail(`Unknown argument${argv.length === 1 ? "" : "s"}: ${argv.join(", ")}`);
}
if (bump && !["patch", "minor", "major"].includes(bump)) {
  fail(`--bump must be patch, minor or major (got "${bump}")`);
}
if (exactVersion && !/^\d+\.\d+\.\d+$/.test(exactVersion)) {
  fail(`--version must look like 1.2.3 (got "${exactVersion}")`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function write(file, contents) {
  fs.writeFileSync(path.join(ROOT, file), contents);
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function releaseExists(tag) {
  const result = spawnSync(
    "gh",
    ["release", "view", tag, "--repo", REPO, "--json", "tagName"],
    { cwd: ROOT, stdio: "ignore" },
  );
  return result.status === 0;
}

function bumpVersion(current, kind) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function replaceOnce(file, pattern, replacement) {
  const contents = read(file);
  if (!pattern.test(contents)) {
    fail(`Could not find the version string in ${file}`);
  }
  write(file, contents.replace(pattern, replacement));
}

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

if (!fs.existsSync(path.join(ROOT, "src-tauri", "tauri.conf.json"))) {
  fail("Run this from the CrossPresenter-Windows_11 tree.");
}

if (!allowDirty) {
  const dirty = capture("git", ["status", "--porcelain"]);
  if (dirty) {
    fail(
      "The working tree has uncommitted changes. Commit them first so the release\n" +
        "matches the tag, or pass --allow-dirty if you know what you are doing.\n\n" +
        dirty,
    );
  }
}

const confPath = "src-tauri/tauri.conf.json";
const conf = JSON.parse(read(confPath));
const currentVersion = conf.version;
const version = exactVersion ?? bumpVersion(currentVersion, bump);

if (version === currentVersion) {
  fail(`Version ${version} is already the current version.`);
}
if (releaseExists(`v${version}`)) {
  fail(`Release v${version} already exists on GitHub.`);
}

const keyPath =
  process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ??
  path.join(os.homedir(), ".tauri", "crosspresenter.key");
const passwordPath =
  process.env.TAURI_SIGNING_KEY_PASSWORD_FILE ??
  path.join(os.homedir(), ".tauri", "crosspresenter.password");

if (!fs.existsSync(keyPath)) {
  fail(
    `Signing key not found at ${keyPath}\n` +
      "Generate one with:  npx tauri signer generate -w <path>\n" +
      "Then add its public key to tauri.conf.json → plugins.updater.pubkey.",
  );
}
if (!fs.existsSync(passwordPath)) {
  fail(
    `Signing key password not found at ${passwordPath}\n` +
      "Put the password on one line in that file (or set TAURI_SIGNING_KEY_PASSWORD_FILE).",
  );
}

const password = fs.readFileSync(passwordPath, "utf8").trim();

// ---------------------------------------------------------------------------
// Version bump
// ---------------------------------------------------------------------------

console.log(`\n→ Bumping CrossPresenter ${currentVersion} → ${version}\n`);

const pkg = JSON.parse(read("package.json"));
pkg.version = version;
write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

conf.version = version;
write(confPath, `${JSON.stringify(conf, null, 2)}\n`);

replaceOnce("src-tauri/Cargo.toml", /^version = "[^"]+"$/m, `version = "${version}"`);
replaceOnce(
  "src/lib/defaults.ts",
  /export const APP_VERSION = "[^"]+";/,
  `export const APP_VERSION = "${version}";`,
);

// ---------------------------------------------------------------------------
// Build (signed)
// ---------------------------------------------------------------------------

console.log("→ Building the signed Windows bundle (this is the slow part)…\n");

const build = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "bundle"],
  {
    cwd: ROOT,
    stdio: "inherit",
    // .cmd files need a shell on Windows.
    shell: process.platform === "win32",
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password,
    },
  },
);

if (build.status !== 0) {
  fail("The release build failed. The version files were bumped but nothing was committed.");
}

// ---------------------------------------------------------------------------
// Locate artifacts
// ---------------------------------------------------------------------------

const bundleDir = path.join(ROOT, "src-tauri", "target", "release", "bundle");
const nsisDir = path.join(bundleDir, "nsis");
const msiDir = path.join(bundleDir, "msi");

if (!fs.existsSync(nsisDir)) {
  fail("No NSIS output folder — did the bundle step run?");
}

const installer = fs
  .readdirSync(nsisDir)
  .find((name) => name.endsWith("-setup.exe") && name.includes(version));
if (!installer) {
  fail(`No NSIS installer for v${version} in ${nsisDir}`);
}

const installerPath = path.join(nsisDir, installer);
const signaturePath = `${installerPath}.sig`;
if (!fs.existsSync(signaturePath)) {
  fail(
    "The installer was built without an updater signature.\n" +
      "Check that createUpdaterArtifacts is true and the signing key is valid.",
  );
}

const msi = fs.existsSync(msiDir)
  ? fs.readdirSync(msiDir).find((name) => name.endsWith(".msi") && name.includes(version))
  : undefined;

const progressDir = path.join(ROOT, "src-tauri", "target", "release");
const latestJsonPath = path.join(progressDir, "latest.json");
const notesPath = path.join(progressDir, "release-notes.md");

const downloadUrl =
  `https://github.com/${REPO}/releases/download/v${version}/` +
  encodeURIComponent(installer);

fs.writeFileSync(
  latestJsonPath,
  `${JSON.stringify(
    {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: {
        "windows-x86_64": {
          signature: fs.readFileSync(signaturePath, "utf8").trim(),
          url: downloadUrl,
        },
      },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(notesPath, `${notes}\n`);

// ---------------------------------------------------------------------------
// Commit, push, publish
// ---------------------------------------------------------------------------

console.log("\n→ Committing the version bump and pushing…\n");

capture("git", [
  "add",
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src/lib/defaults.ts",
]);
capture("git", ["commit", "-m", `chore: release v${version}`]);
capture("git", ["push", "origin", "HEAD"]);
const sha = capture("git", ["rev-parse", "HEAD"]);

console.log("→ Publishing the GitHub Release…\n");

const assets = [installerPath, signaturePath, latestJsonPath];
if (msi) assets.push(path.join(msiDir, msi));

const releaseArgs = [
  "release",
  "create",
  `v${version}`,
  ...assets,
  "--repo",
  REPO,
  "--target",
  sha,
  "--title",
  `CrossPresenter v${version}`,
  "--notes-file",
  notesPath,
  "--latest",
];

const release = spawnSync("gh", releaseArgs, {
  cwd: ROOT,
  stdio: "inherit",
});

if (release.status !== 0) {
  fail(
    `The build and commit succeeded, but publishing failed.\n` +
      `Retry with:  gh release create v${version} …  (assets are in ${bundleDir})`,
  );
}

console.log(`
✔ Released CrossPresenter v${version}
  https://github.com/${REPO}/releases/tag/v${version}
  Installer: ${installerPath}

Apps on an older version will show the update prompt on their next check
(at launch, or every four hours while open).
`);
