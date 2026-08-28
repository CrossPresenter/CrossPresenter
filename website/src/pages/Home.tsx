import { ArrowDown, Download, Github, Sparkles } from 'lucide-react'
import AppMockup from '../components/AppMockup'
import DownloadCta from '../components/DownloadCta'
import Features from '../components/Features'

interface HomeProps {
  onNavigate: (path: string) => void
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-[#47bfff]/10 blur-3xl" />
          <div className="absolute top-72 -right-32 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-light">
              <Sparkles size={12} /> Free & open source — no subscriptions
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Elevate your church{' '}
              <span className="bg-gradient-to-r from-brand-light to-[#47bfff] bg-clip-text text-transparent">
                presentations
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
              CrossPresenter is a free, open-source presenter built for churches — lyrics, Bible, media and live video
              backgrounds, with multi-display output and NDI streaming.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => onNavigate('/downloads')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(124,106,247,0.4)] transition-all hover:bg-brand-dark"
              >
                <Download size={18} /> Download for Windows
              </button>
              <a
                href="/#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
              >
                <ArrowDown size={18} /> View features
              </a>
            </div>
            <p className="mt-5 text-sm text-white/35">
              <Github size={14} className="mr-1 inline" />
              Open source under the GNU GPL v3 —{' '}
              <a
                href="https://github.com/CrossPresenter/CrossPresenter"
                target="_blank"
                rel="noreferrer"
                className="text-white/55 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
              >
                view the source
              </a>
            </p>
          </div>

          <AppMockup />
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-white/5 bg-white/[0.02] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-light">Our Mission</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            High-end presentation software, given freely to the Church
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/50">
            Every church deserves professional presentation software — regardless of budget. CrossPresenter is built by
            and for the church community, offered free of charge so that more of every offering can go toward the
            mission instead of software fees.
          </p>
          <blockquote className="mx-auto mt-8 max-w-xl rounded-2xl border border-brand/20 bg-brand/5 p-6">
            <p className="text-lg font-medium italic text-brand-light">"Freely you have received; freely give."</p>
            <cite className="mt-2 block text-sm not-italic text-white/40">— Matthew 10:8</cite>
          </blockquote>
        </div>
      </section>

      <Features />
      <DownloadCta onNavigate={onNavigate} />
    </>
  )
}
