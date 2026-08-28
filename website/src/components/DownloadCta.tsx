import { Download } from 'lucide-react'

interface DownloadCtaProps {
  onNavigate: (path: string) => void
}

export default function DownloadCta({ onNavigate }: DownloadCtaProps) {
  return (
    <section className="py-10 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/25 via-surface-light to-surface p-10 text-center sm:p-16">
          <div className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to get started?</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/55">
              Download CrossPresenter for Windows — free, open source, and yours to keep. No accounts, no trials, no
              cost.
            </p>
            <button
              onClick={() => onNavigate('/downloads')}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(124,106,247,0.4)] transition-all hover:bg-brand-dark"
            >
              <Download size={18} /> Download for Windows
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
