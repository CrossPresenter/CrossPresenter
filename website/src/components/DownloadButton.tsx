import { useState } from 'react'
import { Apple, ArrowDown, Check, Copy, Laptop, MonitorDown, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { sha256Of, type ReleaseAsset } from '../lib/releases'

interface DownloadButtonProps {
  label?: string
  sub?: string
  href?: string
  platform?: 'windows' | 'macos' | 'linux'
  asset?: ReleaseAsset | null
  name?: string
}

const platformIcons: Record<NonNullable<DownloadButtonProps['platform']>, LucideIcon> = {
  windows: MonitorDown,
  macos: Apple,
  linux: Laptop,
}

export default function DownloadButton({
  label,
  sub,
  href,
  platform = 'windows',
  asset,
  name,
}: DownloadButtonProps) {
  const [showHash, setShowHash] = useState(false)
  const [copied, setCopied] = useState(false)
  const disabled = !href
  const Icon = platformIcons[platform]
  const hash = sha256Of(asset ?? null)
  const Wrapper = disabled ? 'div' : 'a'

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
    <div className="border-b border-line py-5">
      <Wrapper
        {...(!disabled ? { href, target: '_blank', rel: 'noreferrer' } : {})}
        className={`group flex items-center justify-between gap-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'hover:bg-ink-2/60 -mx-2 px-2'
        }`}
      >
        <div className="flex items-center gap-4">
          <Icon
            size={18}
            strokeWidth={1.5}
            className={disabled ? 'text-muted/50' : 'text-muted transition-colors duration-200 group-hover:text-accent'}
          />
          <div>
            <span className={`font-display block text-lg font-medium ${disabled ? 'text-muted' : 'text-paper'}`}>
              {label ?? 'Windows'}
            </span>
            {sub && (
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{sub}</span>
            )}
            {name && !disabled && (
              <span className="mt-1 block font-mono text-[9px] text-muted/70">{name}</span>
            )}
          </div>
        </div>
        {disabled ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Soon</span>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors duration-200 group-hover:border-accent group-hover:text-accent">
            <ArrowDown size={15} strokeWidth={1.5} />
          </span>
        )}
      </Wrapper>

      {!disabled && hash && (
        <div className="mt-3 pl-[34px]">
          <button
            type="button"
            onClick={() => setShowHash((v) => !v)}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors duration-200 hover:text-accent"
          >
            <ShieldCheck size={12} strokeWidth={1.5} />
            {showHash ? 'Hide' : 'Show'} SHA-256
          </button>
          {showHash && (
            <div className="mt-2 flex items-center gap-2 border border-line bg-ink-2 p-2">
              <code className="flex-1 break-all font-mono text-[10px] leading-relaxed text-muted">{hash}</code>
              <button
                type="button"
                onClick={copyHash}
                title="Copy checksum"
                className="shrink-0 border border-line p-1 text-muted transition-colors duration-200 hover:border-accent hover:text-accent"
              >
                {copied ? <Check size={13} strokeWidth={1.75} className="text-accent" /> : <Copy size={13} strokeWidth={1.5} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
