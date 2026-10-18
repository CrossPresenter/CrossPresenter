import { ArrowDown, CheckCircle2, Download, Github, MonitorPlay, Settings2, Sparkles } from 'lucide-react'
import AppMockup from '../components/AppMockup'
import DownloadCta from '../components/DownloadCta'
import Features from '../components/Features'
import SectionHeading from '../components/SectionHeading'
import { REPO_URL } from '../lib/releases'

interface HomeProps {
  onNavigate: (path: string) => void
}

const stats = [
  { value: '$0', label: 'Cost, forever' },
  { value: 'GPLv3', label: 'Open source' },
  { value: '0', label: 'Accounts required' },
  { value: '10+', label: 'Outputs & views' },
]

const steps = [
  {
    icon: Download,
    title: 'Download & install',
    body: 'Grab the Windows installer and you are running in minutes — no sign-up, no licence key.',
  },
  {
    icon: Settings2,
    title: 'Plan the service',
    body: 'Add songs, scripture, videos and notes to a service plan. Reorder everything with drag and drop.',
  },
  {
    icon: MonitorPlay,
    title: 'Go live on every screen',
    body: 'Pick your displays and present. Stage view, remote control and NDI take care of the rest.',
  },
]

const faqs = [
  {
    q: 'Is CrossPresenter really free?',
    a: 'Yes — completely free, forever. There is no pro tier, no trial and no subscription. The source code is published under the GNU GPL v3 so anyone can inspect, fork or improve it.',
  },
  {
    q: 'Do I need an account or internet connection?',
    a: 'No accounts and no sign-ups, and everything works fully offline once installed. Internet is only needed if you choose YouTube backgrounds or fetch a new Bible translation.',
  },
  {
    q: 'Does it work with our projector and streaming setup?',
    a: 'CrossPresenter outputs to any extra display connected to your PC — projectors, HDMI screens or capture cards — and includes built-in NDI output for sending the feed to a streaming computer over the network.',
  },
  {
    q: 'Can volunteers learn it quickly?',
    a: 'That is the design goal. The control window shows the current slide, the next slide and the service order, and advancing is a single click or key press. Most volunteers are comfortable within one rehearsal.',
  },
  {
    q: 'What does it run on?',
    a: 'Windows 10 or later (64-bit) today, with macOS and Linux builds on the roadmap. It runs comfortably on modest hardware — 2 GB RAM is enough, 4 GB recommended.',
  },
]

export default function Home({ onNavigate }: HomeProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-36 sm:pb-28 sm:pt-44">
        {/* Aurora backdrop */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="animate-aurora absolute -top-56 left-1/2 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand/30 blur-3xl" />
          <div className="animate-aurora absolute -top-24 right-[-8rem] h-96 w-96 rounded-full bg-[#47bfff]/15 blur-3xl [animation-delay:-6s]" />
          <div className="animate-aurora absolute top-64 left-[-8rem] h-80 w-80 rounded-full bg-[#ff5fa2]/10 blur-3xl [animation-delay:-12s]" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#07070f]" aria-hidden />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span
            className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-medium text-brand-light backdrop-blur-sm"
            style={{ animationDelay: '40ms' }}
          >
            <Sparkles size={12} /> Free &amp; open source — no subscriptions, ever
          </span>

          <h1
            className="font-display animate-fade-up mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-tight text-balance text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            Church presentations,{' '}
            <span className="text-gradient">elevated</span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55"
            style={{ animationDelay: '200ms' }}
          >
            Lyrics, Bible, media and live video backgrounds — with multi-display output, stage views and NDI
            streaming. One fast app for the whole service, built for the church and given freely.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '280ms' }}
          >
            <button
              onClick={() => onNavigate('/downloads')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-[#6a8dff] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_45px_-18px_rgba(124,106,247,1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_-20px_rgba(124,106,247,1)] active:translate-y-0 sm:w-auto"
            >
              <Download size={18} /> Download for Windows
            </button>
            <a
              href="/#features"
              className="glass inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-8 py-4 text-base font-semibold text-white/80 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:text-white sm:w-auto"
            >
              <ArrowDown size={18} /> Explore features
            </a>
          </div>

          <p
            className="animate-fade-up mt-7 text-sm text-white/40"
            style={{ animationDelay: '350ms' }}
          >
            <CheckCircle2 size={14} className="mr-1.5 inline text-emerald-400" />
            Windows 10 or later
            <span className="mx-2 text-white/20">·</span>
            <Github size={14} className="mr-1.5 inline" />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              GPLv3 source on GitHub
            </a>
          </p>

          {/* Mockup */}
          <div className="animate-fade-up mt-16" style={{ animationDelay: '420ms' }}>
            <AppMockup />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="glass animate-fade-up rounded-2xl border border-white/10 px-5 py-6 text-center"
              >
                <p className="font-display text-2xl font-bold text-white sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Features />

      {/* How it works */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rule-gradient" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="How it works"
            title="From download to live in three steps"
            sub="No configuration marathons, no account setup — install it, plan the service and press go."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="animate-fade-up glass relative rounded-3xl border border-white/10 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="font-display absolute right-6 top-5 text-4xl font-extrabold text-white/10">
                  {i + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#47bfff] text-white shadow-[0_12px_26px_-12px_rgba(124,106,247,0.9)]">
                  <s.icon size={20} />
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/45">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission band */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-[#0d0d1c] to-[#0a1f33]" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-light">Our mission</p>
          <h2 className="font-display mt-4 text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            High-end presentation software, given freely to the Church
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">
            Every church deserves professional presentation software — regardless of budget. CrossPresenter is built
            by and for the church community so more of every offering can go toward the mission instead of software
            fees.
          </p>
          <figure className="mx-auto mt-10 max-w-xl">
            <blockquote className="font-display text-xl font-semibold italic leading-relaxed text-white sm:text-2xl">
              &ldquo;Freely you have received; freely give.&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-sm text-white/45">— Matthew 10:8</figcaption>
          </figure>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions, answered"
            sub="Everything you need to know before putting CrossPresenter in front of your congregation."
          />
          <div className="mt-12 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={f.q}
                className="glass animate-fade-up group rounded-2xl border border-white/10 px-5 transition-colors open:border-brand/40"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-white sm:text-base">
                  {f.q}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/50 transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-sm leading-relaxed text-white/50">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <DownloadCta onNavigate={onNavigate} />
    </>
  )
}
