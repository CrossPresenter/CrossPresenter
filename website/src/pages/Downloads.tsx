import { useEffect, useState, type ReactNode } from 'react'
import {
  Apple,
  BadgeCheck,
  Box,
  Cpu,
  Disc,
  Download,
  ExternalLink,
  FileArchive,
  Laptop,
  Monitor,
  Package,
  Scale,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import Accordion, { type AccordionItem } from '../components/Accordion'
import HardwareGrid from '../components/HardwareGrid'
import PackageCard from '../components/PackageCard'
import TerminalSnippets, { type Snippet } from '../components/TerminalSnippets'
import { detectArch, detectOs } from '../lib/platform'
import {
  LICENSE_URL,
  RELEASES_URL,
  formatDate,
  formatBytes,
  getLatestRelease,
  linuxAppImageAsset,
  linuxDebAsset,
  linuxTarAsset,
  macDmgAsset,
  windowsPortableAsset,
  windowsSetupAsset,
} from '../lib/releases'
import type { Release, ReleaseAsset } from '../lib/releases'

type PlatformKey = 'windows' | 'macos' | 'linux'

function nameOr(asset: ReleaseAsset | undefined, fallback: string): string {
  return asset?.name ?? fallback
}

/** Minimal markdown renderer for GitHub release bodies (headings, bullets, paragraphs). */
function renderChangelog(md: string): ReactNode[] {
  const out: ReactNode[] = []
  let bullets: string[] = []

  const flush = () => {
    if (bullets.length === 0) return
    out.push(
      <ul key={`ul-${out.length}`} className="mt-2 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  md.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) {
      flush()
      return
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      out.push(
        <h4 key={i} className="mt-4 text-sm font-semibold text-white first:mt-0">
          {heading[1]}
        </h4>,
      )
      return
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1])
      return
    }
    flush()
    out.push(
      <p key={i} className="mt-1">
        {line}
      </p>,
    )
  })
  flush()
  return out
}

export default function Downloads() {
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getLatestRelease().then((r) => {
      if (cancelled) return
      setRelease(r)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const os = detectOs()
  const arch = detectArch()

  const winSetup = windowsSetupAsset(release)
  const winPortable = windowsPortableAsset(release)
  const macArm = macDmgAsset(release, 'arm64')
  const macIntel = macDmgAsset(release, 'x64')
  const linuxApp = linuxAppImageAsset(release)
  const linuxDeb = linuxDebAsset(release)
  const linuxTar = linuxTarAsset(release)

  const primaryPlatform: PlatformKey = os === 'unknown' ? 'windows' : os
  const primaryAsset =
    primaryPlatform === 'windows'
      ? winSetup
      : primaryPlatform === 'macos'
        ? arch === 'x64'
          ? macIntel
          : macArm
        : linuxApp

  const platformName = primaryPlatform === 'windows' ? 'Windows' : primaryPlatform === 'macos' ? 'macOS' : 'Linux'
  const detectedLabel =
    primaryPlatform === 'windows'
      ? 'Windows 64-bit'
      : primaryPlatform === 'macos'
        ? arch === 'x64'
          ? 'macOS · Intel'
          : arch === 'arm64'
            ? 'macOS · Apple Silicon'
            : 'macOS'
        : 'Linux 64-bit'

  const primaryExt = primaryAsset ? (/\.[^.]+$/.exec(primaryAsset.name)?.[0] ?? '') : ''

  interface Alternate {
    label: string
    asset?: ReleaseAsset
  }
  const alternates: Alternate[] =
    primaryPlatform === 'windows'
      ? [{ label: 'Portable (.zip)', asset: winPortable }]
      : primaryPlatform === 'macos'
        ? [
            { label: 'Apple Silicon (.dmg)', asset: macArm },
            { label: 'Intel (.dmg)', asset: macIntel },
          ]
        : [
            { label: 'AppImage', asset: linuxApp },
            { label: 'Debian (.deb)', asset: linuxDeb },
            { label: 'Tarball (.tar.gz)', asset: linuxTar },
          ]
  const otherPackages = alternates.filter((a) => a.asset && a.asset !== primaryAsset)

  const totalDownloads = release?.assets.reduce((sum, a) => sum + a.download_count, 0) ?? 0

  // Terminal snippets — detected platform listed first.
  const winSnippet: Snippet = {
    key: 'windows',
    label: 'Windows',
    lines: winPortable
      ? [
          '# Portable build — extract and run, no installation required',
          `Expand-Archive .\\${winPortable.name} -DestinationPath .\\CrossPresenter`,
          '.\\CrossPresenter\\CrossPresenter.exe',
        ]
      : [
          '# Silent install of the setup package (or double-click to install)',
          `.\\${nameOr(winSetup, 'CrossPresenter.Setup.exe')} /S`,
        ],
  }
  const macSnippet: Snippet = {
    key: 'macos',
    label: 'macOS',
    lines: [
      '# Mount the disk image, copy the app, then eject',
      `hdiutil attach "${nameOr(macArm ?? macIntel, 'CrossPresenter.dmg')}"`,
      'cp -R "/Volumes/CrossPresenter/CrossPresenter.app" /Applications/',
      'hdiutil detach "/Volumes/CrossPresenter"',
    ],
  }
  const linuxLines = [
    '# Make the AppImage executable, then launch it',
    `chmod +x "${nameOr(linuxApp, 'CrossPresenter.AppImage')}"`,
    `"./${nameOr(linuxApp, 'CrossPresenter.AppImage')}"`,
  ]
  if (linuxDeb) {
    linuxLines.push('', '# Or install the Debian / Ubuntu package', `sudo apt install ./${linuxDeb.name}`)
  }
  const linuxSnippet: Snippet = { key: 'linux', label: 'Linux', lines: linuxLines }

  const allSnippets = [winSnippet, macSnippet, linuxSnippet]
  const detectedIndex = allSnippets.findIndex((s) => s.key === primaryPlatform)
  const snippets: Snippet[] =
    detectedIndex > 0
      ? [allSnippets[detectedIndex], ...allSnippets.filter((_, i) => i !== detectedIndex)]
      : allSnippets

  const columns: {
    key: PlatformKey
    label: string
    icon: LucideIcon
    packages: { icon: LucideIcon; title: string; subtitle: string; asset?: ReleaseAsset }[]
  }[] = [
    {
      key: 'windows',
      label: 'Windows',
      icon: Monitor,
      packages: [
        { icon: Package, title: 'Installer', subtitle: '.exe · one-click setup', asset: winSetup },
        { icon: FileArchive, title: 'Portable', subtitle: '.zip · run without installing', asset: winPortable },
      ],
    },
    {
      key: 'macos',
      label: 'macOS',
      icon: Apple,
      packages: [
        { icon: Disc, title: 'Apple Silicon', subtitle: '.dmg · ARM64', asset: macArm },
        { icon: Disc, title: 'Intel', subtitle: '.dmg · x64', asset: macIntel },
      ],
    },
    {
      key: 'linux',
      label: 'Linux',
      icon: Laptop,
      packages: [
        { icon: Box, title: 'AppImage', subtitle: '.AppImage · universal', asset: linuxApp },
        { icon: Package, title: 'Debian / Ubuntu', subtitle: '.deb · apt package', asset: linuxDeb },
        { icon: FileArchive, title: 'Tarball', subtitle: '.tar.gz · archive', asset: linuxTar },
      ],
    },
  ]

  const faqItems: AccordionItem[] = [
    {
      id: 'install',
      title: 'Do I need to install CrossPresenter?',
      content: (
        <p>
          No. Every platform ships a portable option — the Windows <strong className="text-white/70">.zip</strong>, the
          Linux <strong className="text-white/70">AppImage</strong>, and the macOS <strong className="text-white/70">.app</strong>{' '}
          inside the disk image all run without admin rights or a system install. The <strong className="text-white/70">.exe</strong>{' '}
          and <strong className="text-white/70">.deb</strong> packages are there if you prefer a traditional install.
        </p>
      ),
    },
    {
      id: 'license',
      title: 'What license is CrossPresenter released under?',
      content: (
        <p>
          CrossPresenter is free and open-source software released under the{' '}
          <strong className="text-white/70">GNU General Public License v3.0</strong>. You can use, study, and share it —
          even commercially — provided derivative works remain GPL-licensed and keep the branding rules described in the{' '}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
            license
          </a>
          . No accounts, no subscriptions, no lock-in.
        </p>
      ),
    },
    {
      id: 'verify',
      title: 'How do I verify the SHA-256 checksum?',
      content: (
        <p>
          Each package above lists its SHA-256 digest (toggle <em>Show SHA-256 checksum</em>). After downloading, compare
          it against your file's hash — on Windows run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-white/70">Get-FileHash</code>,
          on macOS / Linux run <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-white/70">sha256sum</code>. If they match,
          the download is intact and authentic.
        </p>
      ),
    },
    {
      id: 'choose',
      title: 'Which package should I download?',
      content: (
        <p>
          On <strong className="text-white/70">Windows</strong>, use the <strong className="text-white/70">.exe installer</strong> for a
          standard setup or the <strong className="text-white/70">.zip</strong> for a portable copy. On <strong className="text-white/70">macOS</strong>,
          pick the <strong className="text-white/70">.dmg</strong> matching your chip — Apple Silicon (M-series) or Intel. On{' '}
          <strong className="text-white/70">Linux</strong>, the <strong className="text-white/70">AppImage</strong> works almost anywhere,
          the <strong className="text-white/70">.deb</strong> fits Debian/Ubuntu, and the <strong className="text-white/70">.tar.gz</strong> suits manual installs.
        </p>
      ),
    },
    {
      id: 'requirements',
      title: 'What are the minimum system requirements?',
      content: (
        <p>
          A 64-bit CPU (x86-64 or ARM64), 4 GB RAM (8 GB recommended), ~1 GB of free disk space, and any GPU that can
          drive your output display — hardware decode is recommended for smooth 4K backgrounds. See the full grid above.
        </p>
      ),
    },
    {
      id: 'offline',
      title: 'Does it require an account or internet connection?',
      content: (
        <p>
          No account and no internet connection are required for core presenting. NDI output, phone remote control, and
          online audience features work over your local network, and the built-in Bible and song bank work fully offline.
        </p>
      ),
    },
  ]

  const changelogItems: AccordionItem[] = release
    ? [
        {
          id: release.tag_name,
          title: `${release.tag_name} — ${formatDate(release.published_at)}`,
          content: (
            <>
              {renderChangelog(release.body ?? '')}
              <a
                href={`${RELEASES_URL}/tag/${release.tag_name}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-cyan-300 transition-colors hover:text-cyan-200"
              >
                View full release notes <ExternalLink size={13} />
              </a>
            </>
          ),
        },
      ]
    : [
        {
          id: 'unavailable',
          title: 'Release notes',
          content: (
            <p>
              Could not load release notes right now.{' '}
              <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
                View them on GitHub
              </a>
              .
            </p>
          ),
        },
      ]

  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-36">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-cyan-400/[0.07] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Downloads</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Download{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
              CrossPresenter
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/50">
            Free, open-source presentation software for Windows, macOS and Linux — lightweight, hardware-accelerated, and
            portable. Pick your platform below.
          </p>
        </div>

        {/* Release meta */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/45">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-md bg-cyan-400/15 px-2.5 py-1 text-xs font-bold text-cyan-200 ring-1 ring-cyan-400/30">
              {release?.tag_name ?? (loading ? 'Loading…' : 'Latest release')}
            </span>
            {release?.published_at && <span>{formatDate(release.published_at)}</span>}
          </span>
          {totalDownloads > 0 && <span>{totalDownloads.toLocaleString()} total downloads</span>}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan-300/80 transition-colors hover:text-white"
          >
            All releases <ExternalLink size={13} />
          </a>
        </div>

        {!loading && !release && (
          <p className="mx-auto mt-6 max-w-md rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-200/90">
            Couldn't reach GitHub for release info.{' '}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              View releases
            </a>{' '}
            directly.
          </p>
        )}

        {/* Primary (OS-detected) card */}
        <div className="relative mt-10 overflow-hidden rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/10 via-slate-900/40 to-blue-600/10 p-8 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                <BadgeCheck size={13} /> Detected: {detectedLabel}
              </span>
              <h2 className="mt-4 text-2xl font-bold text-white">CrossPresenter for {platformName}</h2>
              <p className="mt-2 max-w-md text-sm text-white/55">
                {primaryAsset
                  ? `${primaryPlatform === 'windows' ? 'Installer' : primaryPlatform === 'macos' ? 'Disk image' : 'AppImage'} · ${formatBytes(primaryAsset.size)} · ${primaryAsset.download_count.toLocaleString()} downloads`
                  : `The native ${platformName} build is being prepared. In the meantime, grab another package below or build from source.`}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              {primaryAsset ? (
                <a
                  href={primaryAsset.browser_download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(34,211,238,0.35)] transition-all hover:from-cyan-300 hover:to-blue-400"
                >
                  <Download size={18} /> Download {primaryExt}
                </a>
              ) : (
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  View releases <ExternalLink size={16} />
                </a>
              )}
              <span className="font-mono text-xs text-white/35">{primaryAsset?.name ?? `crosspresenter-${primaryPlatform}`}</span>
            </div>
          </div>

          {otherPackages.length > 0 && (
            <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
              <span className="text-xs font-medium text-white/40">Other {platformName} packages:</span>
              {otherPackages.map((alt) => (
                <a
                  key={alt.label}
                  href={alt.asset?.browser_download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  {alt.label} <Download size={12} />
                </a>
              ))}
            </div>
          )}

          <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/45">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-cyan-300" /> Per-file SHA-256 checksums
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Monitor size={14} className="text-cyan-300" /> Hardware-accelerated 4K output
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Package size={14} className="text-cyan-300" /> Portable — no install needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Scale size={14} className="text-cyan-300" /> Free & open source (GPL v3)
            </span>
          </div>
        </div>

        {/* All downloads */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold text-white">All downloads</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/45">
            Every package for the latest release, each with its own SHA-256 checksum.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {columns.map((col) => (
              <div
                key={col.key}
                className={`rounded-2xl border p-4 ${
                  col.key === primaryPlatform ? 'border-cyan-400/30 bg-cyan-400/[0.04]' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="mb-4 flex items-center gap-3 px-1">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
                    <col.icon size={18} />
                  </span>
                  <span className="text-base font-semibold text-white">{col.label}</span>
                  {col.key === primaryPlatform && (
                    <span className="ml-auto rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                      Detected
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {col.packages.map((pkg) => (
                    <PackageCard
                      key={pkg.title}
                      icon={pkg.icon}
                      title={pkg.title}
                      subtitle={pkg.subtitle}
                      asset={pkg.asset}
                      accent={pkg.asset != null && pkg.asset === primaryAsset}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware requirements */}
        <div className="mt-16">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
            <Cpu size={20} className="text-cyan-300" /> Hardware requirements
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/45">
            Engineered for low latency and smooth 4K presentation output.
          </p>
          <div className="mt-8">
            <HardwareGrid />
          </div>
        </div>

        {/* Terminal snippets */}
        <div className="mt-16">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
            <Terminal size={20} className="text-cyan-300" /> Launch from the terminal
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/45">
            Prefer the command line? Download, extract and run CrossPresenter with a single copy-paste.
          </p>
          <div className="mx-auto mt-8 max-w-3xl">
            <TerminalSnippets snippets={snippets} />
          </div>
        </div>

        {/* FAQ + changelog */}
        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-white">Frequently asked questions</h2>
            <div className="mt-5">
              <Accordion items={faqItems} />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Release notes</h2>
            <div className="mt-5">
              <Accordion items={changelogItems} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
