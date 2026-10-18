import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Globe, ShieldCheck, Sparkles } from 'lucide-react'
import DownloadButton from '../components/DownloadButton'
import {
  RELEASES_URL,
  windowsAsset,
  getLatestRelease,
  formatBytes,
  formatDate,
} from '../lib/releases'
import type { Release } from '../lib/releases'

const requirements = [
  'Windows 10 or Windows 11 (64-bit)',
  '2 GB RAM (4 GB recommended)',
  'Any modern CPU and GPU',
  'Optional: a second display for output, NDI or a capture card',
]

export default function Downloads() {
  const [release, setRelease] = useState<Release | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getLatestRelease().then((r) => {
      if (cancelled) return
      if (r) setRelease(r)
      else setError(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const asset = release ? windowsAsset(release) : undefined
  const totalDownloads = release?.assets.reduce((sum, a) => sum + a.download_count, 0) ?? 0

  return (
    <main className="relative overflow-hidden pb-24 pt-36 sm:pt-44">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-aurora absolute -top-40 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#07070f]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-medium text-brand-light backdrop-blur-sm">
            <Sparkles size={12} /> Free forever — no account required
          </span>
          <h1 className="font-display animate-fade-up mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Download <span className="text-gradient">CrossPresenter</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-5 max-w-xl text-lg text-white/55" style={{ animationDelay: '100ms' }}>
            Ready to use in minutes. The Windows installer is below — macOS and Linux are on the way.
          </p>
        </div>

        {/* Release card */}
        <div
          className="animate-fade-up glass mt-12 rounded-[2rem] border border-white/10 p-6 shadow-[0_40px_100px_-60px_rgba(124,106,247,1)] sm:p-10"
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl bg-brand/15 px-3 py-1.5 text-sm font-bold text-brand-light ring-1 ring-brand/30">
                {release ? release.tag_name : error ? 'Latest release' : 'Loading release…'}
              </span>
              {release?.published_at && (
                <span className="text-sm text-white/40">{formatDate(release.published_at)}</span>
              )}
            </div>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-light transition-colors hover:text-white"
            >
              See all releases
              <ExternalLink
                size={13}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <DownloadButton
              platform="windows"
              label="Windows"
              sub={
                asset
                  ? `${formatBytes(asset.size)} · ${asset.download_count.toLocaleString()} downloads`
                  : error
                    ? 'Check releases on GitHub'
                    : 'Preparing link…'
              }
              href={asset?.browser_download_url}
            />
            <DownloadButton platform="macos" label="macOS" sub="Coming soon" />
            <DownloadButton platform="linux" label="Linux" sub="Coming soon" />
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:gap-8">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} className="text-brand-light" /> Signed and verified installer
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe size={15} className="text-brand-light" /> Works offline — no account, no telemetry
            </span>
            {release && (
              <a
                href={`${RELEASES_URL}/tag/${release.tag_name}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-brand-light transition-colors hover:text-white"
              >
                <FileText size={15} /> View changelog
              </a>
            )}
          </div>

          {!error && !release && (
            <p className="mt-6 text-sm text-white/35">
              {totalDownloads > 0
                ? `${totalDownloads.toLocaleString()} total downloads across all platforms.`
                : 'Fetching release info from GitHub…'}
            </p>
          )}
        </div>

        {/* Requirements + FAQ */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-brand/30">
            <h2 className="font-display text-base font-semibold text-white">System requirements</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/50">
              {requirements.map((r) => (
                <li key={r} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-light" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-brand/30">
            <h2 className="font-display text-base font-semibold text-white">Frequently asked</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/50">
              <li>
                <span className="font-medium text-white/80">Is it really free?</span> Yes — free forever, GPLv3
                licensed.
              </li>
              <li>
                <span className="font-medium text-white/80">Can I use it with NDI?</span> NDI output is built in.
              </li>
              <li>
                <span className="font-medium text-white/80">Do I need an account?</span> No accounts, no sign-ups.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
