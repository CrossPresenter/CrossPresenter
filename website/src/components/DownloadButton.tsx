import { Apple, ArrowDown, Laptop, MonitorDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface DownloadButtonProps {
  label?: string
  sub?: string
  href?: string
  platform?: 'windows' | 'macos' | 'linux'
}

const platformIcons: Record<NonNullable<DownloadButtonProps['platform']>, LucideIcon> = {
  windows: MonitorDown,
  macos: Apple,
  linux: Laptop,
}

export default function DownloadButton({ label, sub, href, platform = 'windows' }: DownloadButtonProps) {
  const disabled = !href
  const Icon = platformIcons[platform]
  const Wrapper = disabled ? 'div' : 'a'

  return (
    <Wrapper
      {...(!disabled ? { href, target: '_blank', rel: 'noreferrer' } : {})}
      className={`group flex items-center justify-between gap-4 border-b border-line py-5 transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed' : 'hover:bg-ink-2/60'
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
  )
}
