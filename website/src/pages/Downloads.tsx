import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Globe, ShieldCheck } from 'lucide-react'
import DownloadButton from '../components/DownloadButton'
import {
  RELEASES_URL,
  windowsAsset,
  getLatestRelease,
  formatBytes,
  formatDate,
} from '../lib/releases'
import type { Release } from '../lib/releases'

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
    <main className="pt-28 pb-20 sm:pt-36">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-light">Downloads</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Download CrossPresenter</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">
            Free forever, open source, and ready to use in minutes. Windows installer below — macOS and Linux are on
            the way.
          </p>
        </div>

        {/* Latest release */}
        <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-brand/15 px-3 py-1.5 text-sm font-bold text-brand-light ring-1 ring-brand/30">
                {release ? release.tag_name.replace(/^v/, 'v') : error ? 'Latest release' : 'Loading release…'}
              </span>
              {release?.published_at && (
                <span className="text-sm text-white/40">{formatDate(release.published_at)}</span>
              )}
            </div>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-light transition-colors hover:text-white"
            >
              See all releases <ExternalLink size={13} />
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

          <div className="mt-8 flex flex-col gap-2 border-t border-white/5 pt-6 text-sm text-white/45 sm:flex-row sm:gap-8">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} className="text-brand-light" /> Signed and verified installer
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe size={15} className="text-brand-light" /> Requires Windows 10 or later
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

        {/* Requirements */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-white">System requirements</h2>
            <ul className="mt-3 list-inside space-y-1.5 text-sm text-white/50">
              <li>Windows 10 or Windows 11 (64-bit)</li>
              <li>2 GB RAM (4 GB recommended)</li>
              <li>Any modern CPU and GPU</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-white">Frequently asked</h2>
            <ul className="mt-3 list-inside space-y-1.5 text-sm text-white/50">
              <li>Is CrossPresenter really free? Yes — free forever.</li>
              <li>Can I use it with NDI? Yes, NDI output is built in.</li>
              <li>Do I need an account? No accounts, no sign-ups.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
