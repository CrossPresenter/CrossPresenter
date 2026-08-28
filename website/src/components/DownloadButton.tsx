import { Download, Apple, Laptop } from 'lucide-react'

interface DownloadButtonProps {
  label?: string
  sub?: string
  href?: string
  platform?: 'windows' | 'macos' | 'linux'
}

export default function DownloadButton({ label, sub, href, platform = 'windows' }: DownloadButtonProps) {
  const icons = {
    windows: <Download size={18} />,
    macos: <Apple size={18} />,
    linux: <Laptop size={18} />,
  }
  const disabled = !href
  const Wrapper = disabled ? 'div' : 'a'

  return (
    <Wrapper
      {...(!disabled ? { href, target: '_blank', rel: 'noreferrer' } : {})}
      className={`group flex w-full max-w-sm flex-col gap-1 rounded-2xl p-5 text-left transition-all ${
        disabled
          ? 'cursor-not-allowed border border-white/10 bg-white/[0.03]'
          : 'border border-brand/40 bg-gradient-to-b from-brand/25 to-brand/10 hover:border-brand/70 hover:shadow-[0_0_30px_rgba(124,106,247,0.25)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            disabled ? 'bg-white/5 text-white/35' : 'bg-brand text-white'
          }`}
        >
          {icons[platform]}
        </span>
        <span>
          <span className={`block text-base font-semibold ${disabled ? 'text-white/40' : 'text-white'}`}>
            {label ?? 'Download for Windows'}
          </span>
          {sub && <span className="block text-xs text-white/50">{sub}</span>}
        </span>
      </div>
    </Wrapper>
  )
}
