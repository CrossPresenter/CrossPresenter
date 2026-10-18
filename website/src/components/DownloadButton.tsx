import { Apple, ArrowRight, Download, Laptop } from 'lucide-react'

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
      className={`group flex w-full items-center justify-between gap-3 rounded-2xl border p-5 text-left transition-all duration-300 ${
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/[0.03]'
          : 'border-white/15 bg-white/[0.05] hover:-translate-y-1 hover:border-brand/50 hover:bg-brand/10 hover:shadow-[0_22px_50px_-25px_rgba(124,106,247,1)]'
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
            disabled
              ? 'bg-white/5 text-white/35'
              : 'bg-gradient-to-br from-brand to-[#6a8dff] text-white shadow-[0_12px_26px_-12px_rgba(124,106,247,1)] group-hover:scale-105'
          }`}
        >
          {icons[platform]}
        </span>
        <span>
          <span className={`font-display block text-base font-semibold ${disabled ? 'text-white/40' : 'text-white'}`}>
            {label ?? 'Download for Windows'}
          </span>
          {sub && <span className="block text-xs text-white/50">{sub}</span>}
        </span>
      </span>
      {disabled ? (
        <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Soon
        </span>
      ) : (
        <ArrowRight
          size={16}
          className="shrink-0 text-white/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
        />
      )}
    </Wrapper>
  )
}
