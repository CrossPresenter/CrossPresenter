import { useEffect, useState } from 'react'
import { ArrowUpRight, FileText } from 'lucide-react'
import DownloadButton from '../components/DownloadButton'
import Reveal from '../components/Reveal'
import {
  RELEASES_URL,
  windowsAsset,
  getLatestRelease,
  formatBytes,
  formatDate,
} from '../lib/releases'
import type { Release } from '../lib/releases'

const requirements = [
  'Windows 10 or Windows 11, 64-bit',
  '2 GB RAM (4 GB recommended)',
  'Any modern CPU and GPU',
  'Optional: a second display, NDI receiver or capture card',
]

const installSteps = [
  {
    title: 'Download the installer',
    body: 'One .exe file, around 100 MB. No account, no email wall, no licence key.',
  },
  {
    title: 'Run it and install',
    body: 'Accept the defaults. It installs in seconds and adds itself to the Start menu.',
  },
  {
    title: 'Choose your displays',
    body: 'Pick the projector and the stage screen, load a service plan and press play.',
  },
]

const quickAnswers = [
  {
    q: 'Is it really free?',
    a: 'Yes — free forever, licensed GPLv3. No pro tier, no trial, no card.',
  },
  {
    q: 'Does it need an account?',
    a: 'No accounts and no sign-ups. It works offline after installation.',
  },
  {
    q: 'Can it stream over NDI?',
    a: 'NDI output is built in, alongside HDMI and windowed output.',
  },
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
    <main className="border-b border-line pb-24 pt-32 sm:pt-40">
      <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
        <div className="grid gap-16 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <p className="animate-reveal font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
              Downloads
            </p>
            <h1 className="display mt-6 text-5xl font-semibold sm:text-6xl lg:text-7xl">
              <span className="block overflow-hidden">
                <span className="animate-reveal block">Take it</span>
              </span>
              <span className="block overflow-hidden">
                <span className="animate-reveal block italic font-light text-paper/85 [animation-delay:100ms]">
                  to Sunday.
                </span>
              </span>
            </h1>
            <p className="animate-reveal mt-7 max-w-md text-[15px] leading-relaxed text-muted [animation-delay:200ms]">
              The Windows build is ready now. macOS and Linux are on the roadmap. Every release is built from the same
              public source you can read on GitHub.
            </p>

            <dl className="mt-12 grid max-w-md grid-cols-2 gap-y-6 border-t border-line pt-6">
              {[
                { label: 'Version', value: release ? release.tag_name : '—' },
                { label: 'Published', value: release?.published_at ? formatDate(release.published_at) : '—' },
                { label: 'Licence', value: 'GPLv3' },
                { label: 'Price', value: 'Free' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{item.label}</dt>
                  <dd className="font-display mt-1.5 text-base font-medium text-paper">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="md:col-span-5 md:col-start-8">
            <div className="border-t border-line">
              <DownloadButton
                platform="windows"
                label="Windows"
                sub={
                  asset
                    ? `${formatBytes(asset.size)} · ${asset.download_count.toLocaleString()} downloads`
                    : error
                      ? 'See all releases on GitHub'
                      : 'Fetching the latest build…'
                }
                href={asset?.browser_download_url}
              />
              <DownloadButton platform="macos" label="macOS" sub="Coming soon" />
              <DownloadButton platform="linux" label="Linux" sub="Coming soon" />
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              <span>Signed installer</span>
              <span>Works offline</span>
              <span>No telemetry</span>
            </div>

            {release && (
              <a
                href={`${RELEASES_URL}/tag/${release.tag_name}`}
                target="_blank"
                rel="noreferrer"
                className="link-line mt-7 inline-flex items-center gap-2 text-sm font-medium text-paper/80 transition-colors duration-200 hover:text-paper"
              >
                <FileText size={14} strokeWidth={1.5} />
                View the changelog
                <ArrowUpRight size={13} strokeWidth={1.5} />
              </a>
            )}

            <p className="mt-7 max-w-sm text-sm leading-relaxed text-muted">
              {totalDownloads > 0
                ? `${totalDownloads.toLocaleString()} downloads across all releases so far.`
                : error
                  ? 'Release information is unavailable right now — the full list lives on GitHub.'
                  : 'Fetching release information from GitHub…'}
            </p>
          </div>
        </div>

        {/* Install steps */}
        <div className="mt-24 grid gap-10 border-t border-line pt-12 md:grid-cols-3 md:gap-8">
          {installSteps.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] text-accent">0{i + 1}</span>
                  <span className="h-px w-8 bg-line" />
                </div>
                <h2 className="font-display mt-6 text-lg font-medium text-paper">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Requirements and quick answers */}
        <div className="mt-20 grid gap-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Reveal>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">System requirements</h2>
              <ul className="mt-6 border-t border-line">
                {requirements.map((req) => (
                  <li key={req} className="flex gap-4 border-b border-line py-3.5 text-sm text-muted">
                    <span className="font-mono text-[10px] text-line">—</span>
                    {req}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <Reveal delay={80}>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">Quick answers</h2>
              <dl className="mt-6 space-y-6 border-t border-line pt-6">
                {quickAnswers.map((item) => (
                  <div key={item.q}>
                    <dt className="font-display text-base font-medium text-paper">{item.q}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </div>
    </main>
  )
}
