import { ArrowUpRight } from 'lucide-react'

interface DownloadCtaProps {
  onNavigate: (path: string) => void
}

export default function DownloadCta({ onNavigate }: DownloadCtaProps) {
  return (
    <section className="bg-accent text-ink">
      <div className="mx-auto max-w-[88rem] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/60">Get started</p>
            <h2 className="display mt-6 text-4xl font-semibold sm:text-5xl lg:text-6xl">
              Install it this week.
              <br />
              Use it this Sunday.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink/70">
              Free and open source, about two minutes to install. No account, no trial, no card, no upsell.
            </p>
          </div>
          <div className="md:col-span-4 md:flex md:justify-end">
            <button
              onClick={() => onNavigate('/downloads')}
              className="group inline-flex items-center gap-3 bg-ink px-7 py-4 text-sm font-semibold text-paper transition-colors duration-200 hover:bg-paper hover:text-ink"
            >
              Download for Windows
              <ArrowUpRight
                size={16}
                strokeWidth={1.75}
                className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
