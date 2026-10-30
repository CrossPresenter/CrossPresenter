#!/usr/bin/env node
// Bump the Android app version, commit it, tag it, and push. The tag triggers
// .github/workflows/android.yml, which builds a signed APK on GitHub and
// publishes it as a non-"latest" GitHub release (so the desktop updater keeps
// pointing at desktop releases).
//
//   node tool/release.mjs patch
//   node tool/release.mjs minor
//   node tool/release.mjs major
//   node tool/release.mjs --version 1.2.0
//
// Requires a clean working tree, an authenticated `git` remote, and the
// Android signing secrets configured in the GitHub repository.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const project = join(here, '..');
const repo = join(project, '..');
const pubspecPath = join(project, 'pubspec.yaml');

const args = process.argv.slice(2);
const versionFlag = args.indexOf('--version');
const explicitVersion = versionFlag >= 0 ? args[versionFlag + 1] : null;
const bump = args.find((arg) => ['major', 'minor', 'patch'].includes(arg)) ?? 'patch';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  }).trim();
}

const dirty = git(['status', '--porcelain']);
if (dirty && !args.includes('--allow-dirty')) {
  console.error('Working tree is not clean. Commit your changes first.\n');
  console.error(dirty);
  process.exit(1);
}

const pubspec = readFileSync(pubspecPath, 'utf8');
const match = pubspec.match(/^version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)(?:\+([0-9]+))?\s*$/m);
if (!match) {
  console.error('Could not find a version line in pubspec.yaml.');
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);
let build = Number(match[4] ?? '0');

let version;
if (explicitVersion) {
  const parsed = explicitVersion.trim().match(/^([0-9]+)\.([0-9]+)\.([0-9]+)$/);
  if (!parsed) {
    console.error('--version must look like 1.2.3');
    process.exit(1);
  }
  major = Number(parsed[1]);
  minor = Number(parsed[2]);
  patch = Number(parsed[3]);
  version = explicitVersion.trim();
} else if (bump === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
  version = `${major}.${minor}.${patch}`;
} else if (bump === 'minor') {
  minor += 1;
  patch = 0;
  version = `${major}.${minor}.${patch}`;
} else {
  patch += 1;
  version = `${major}.${minor}.${patch}`;
}

build += 1;
const fullVersion = `${version}+${build}`;
const tag = `mobile-v${version}`;

if (git(['tag', '--list', tag])) {
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
}

const updated = pubspec.replace(
  /^version:\s*.*$/m,
  `version: ${fullVersion}`,
);
writeFileSync(pubspecPath, updated, 'utf8');

git(['add', 'CrossPresenter-Android/pubspec.yaml']);
git(['commit', '-m', `Release Android v${version}`], { stdio: 'inherit' });
git(['tag', '-a', tag, '-m', `CrossPresenter Remote v${version}`], {
  stdio: 'inherit',
});
git(['push', 'origin', 'HEAD'], { stdio: 'inherit' });
git(['push', 'origin', tag], { stdio: 'inherit' });

console.log(`\nPushed ${tag}. GitHub Actions is building the signed APK.`);
console.log(
  `Watch: https://github.com/CrossPresenter/CrossPresenter/actions/workflows/android.yml`,
);
