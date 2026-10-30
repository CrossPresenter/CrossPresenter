import { BadgeCheck, Download, HeartHandshake, MonitorDown, UserRoundX } from 'lucide-react'

interface DownloadCtaProps {
  onNavigate: (path: string) => void
}

const reassurance = [
  { icon: BadgeCheck, label: 'Free forever' },
  { icon: UserRoundX, label: 'No account needed' },
  { icon: HeartHandshake, label: 'GPLv3 open source' },
  { icon: MonitorDown, label: 'Windows 10+' },
]

export default function DownloadCta({ onNavigate }: DownloadCtaProps) {
  return (
    <section className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-brand/25 via-[#12121f] to-[#12121f] px-6 py-14 text-center sm:px-16 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden />
          <div
            className="animate-aurora absolute -top-40 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand/35 blur-3xl"
            aria-hidden
          />
          <div
            className="animate-aurora absolute -bottom-40 -right-20 h-64 w-64 rounded-full bg-[#47bfff]/15 blur-3xl [animation-delay:-8s]"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-light">Get started</p>
            <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Ready when your service is
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/55">
              Download CrossPresenter for Windows — free, open source and yours to keep. No accounts, no trials, no
              cost.
            </p>
            <button
              onClick={() => onNavigate('/downloads')}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-semibold text-[#0c0c1a] shadow-[0_18px_45px_-18px_rgba(255,255,255,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_-20px_rgba(255,255,255,0.4)] active:translate-y-0"
            >
              <Download size={18} /> Download for Windows
            </button>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/50">
              {reassurance.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <item.icon size={15} className="text-brand-light" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
