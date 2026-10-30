import { useState } from 'react'
import { Check, Copy, Download, ShieldCheck, type LucideIcon } from 'lucide-react'
import { formatBytes, sha256Of, type ReleaseAsset } from '../lib/releases'

interface PackageCardProps {
  icon: LucideIcon
  title: string
  subtitle: string
  asset?: ReleaseAsset
  accent?: boolean
}

export default function PackageCard({ icon: Icon, title, subtitle, asset, accent }: PackageCardProps) {
  const [showHash, setShowHash] = useState(false)
  const [copied, setCopied] = useState(false)
  const hash = sha256Of(asset)

  async function copyHash() {
    if (!hash) return
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        asset
          ? accent
            ? 'border-cyan-400/40 bg-gradient-to-br from-cyan-400/10 to-blue-600/10'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
          : 'border-white/5 bg-white/[0.015]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              asset ? 'bg-gradient-to-br from-cyan-400/90 to-blue-500/90 text-white' : 'bg-white/5 text-white/30'
            }`}
          >
            <Icon size={18} />
          </span>
          <span>
            <span className={`block text-sm font-semibold ${asset ? 'text-white' : 'text-white/45'}`}>{title}</span>
            <span className="block text-xs text-white/45">{subtitle}</span>
          </span>
        </div>

        {asset && (
          <a
            href={asset.browser_download_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-200"
            title={`Download ${asset.name}`}
          >
            <Download size={16} />
          </a>
        )}
      </div>

      {asset ? (
        <p className="mt-3 text-xs text-white/40">
          {formatBytes(asset.size)} · {asset.download_count.toLocaleString()} downloads
        </p>
      ) : (
        <p className="mt-3 text-xs text-white/35">Not published yet — scheduled for a future release.</p>
      )}

      <div className="mt-3 border-t border-white/5 pt-3">
        {asset && hash ? (
          <>
            <button
              type="button"
              onClick={() => setShowHash((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-300/80 transition-colors hover:text-cyan-200"
            >
              <ShieldCheck size={13} /> {showHash ? 'Hide' : 'Show'} SHA-256 checksum
            </button>
            {showHash && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-black/40 p-2">
                <code className="flex-1 break-all font-mono text-[11px] leading-relaxed text-white/60">{hash}</code>
                <button
                  type="button"
                  onClick={copyHash}
                  title="Copy checksum"
                  className="shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? <Check size={14} className="text-cyan-300" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/30">
            <ShieldCheck size={13} /> SHA-256 not published for this package
          </span>
        )}
      </div>
    </div>
  )
}
