import { useEffect, useState } from 'react'
import { ArrowDown, Download, FolderOpen, MonitorPlay } from 'lucide-react'
import AppMockup from '../components/AppMockup'
import DownloadCta from '../components/DownloadCta'
import Features from '../components/Features'
import Marquee from '../components/Marquee'
import Reveal from '../components/Reveal'
import ScreenShowcase from '../components/ScreenShowcase'
import SectionHeading from '../components/SectionHeading'
import { getLatestRelease } from '../lib/releases'

interface HomeProps {
  onNavigate: (path: string) => void
}

const steps = [
  {
    icon: Download,
    title: 'Download and install',
    body: 'One installer, about 100 MB. No account, no email wall, no licence key.',
  },
  {
    icon: FolderOpen,
    title: 'Plan the service',
    body: 'Songs, readings and media in one running order. Rearrange by dragging; nothing to import.',
  },
  {
    icon: MonitorPlay,
    title: 'Go live',
    body: 'Choose your displays and press play. Stage view and the phone remote take over from there.',
  },
]

const faqs = [
  {
    q: 'Is it really free?',
    a: 'Yes. There is no pro tier, no trial and no subscription. The source is published under GPLv3, so anyone can read it, fork it or improve it.',
  },
  {
    q: 'Do we need internet on Sunday?',
    a: 'No. Everything runs offline once installed. Internet is only used if you choose a YouTube background or pull a new Bible translation.',
  },
  {
    q: 'Will it work with our projector and stream?',
    a: 'It outputs to any extra display your PC can see — projectors, HDMI screens, capture cards — and includes NDI output for a streaming computer on the same network.',
  },
  {
    q: 'Can volunteers pick it up quickly?',
    a: 'That is the point. The control window shows the current slide, the next slide and the running order; advancing is one key or one click. Most volunteers are comfortable after a single rehearsal.',
  },
  {
    q: 'What do we need to run it?',
    a: 'Windows 10 or 11, 64-bit. 2 GB of RAM is enough and 4 GB is comfortable. A second display is optional, but it is what makes the room feel finished.',
  },
]

export default function Home({ onNavigate }: HomeProps) {
  const [downloads, setDownloads] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getLatestRelease().then((r) => {
      if (cancelled || !r) return
      const total = r.assets.reduce((sum, a) => sum + a.download_count, 0)
      if (total > 0) setDownloads(total)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const facts = [
    { label: 'Price', value: 'Free' },
    { label: 'Licence', value: 'GPLv3' },
    { label: 'Runs on', value: 'Windows 10+' },
    { label: 'Downloads', value: downloads === null ? '—' : downloads.toLocaleString() },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <div className="grid gap-16 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <p className="animate-reveal font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                Church presentation software
                <span className="mx-2 text-line">/</span>
                <span className="text-accent">Free &amp; open source</span>
              </p>

              <h1 className="display mt-8 text-[clamp(3.2rem,8vw,6.8rem)] font-semibold">
                <span className="block overflow-hidden">
                  <span className="animate-reveal block [animation-delay:60ms]">Sunday,</span>
                </span>
                <span className="block overflow-hidden">
                  <span className="animate-reveal block italic font-light text-paper/85 [animation-delay:160ms]">
                    handled.
                  </span>
                </span>
              </h1>

              <p className="animate-reveal mt-8 max-w-lg text-base leading-relaxed text-muted [animation-delay:260ms] sm:text-lg">
                Lyrics, scripture, media and live video on every screen in the room — and on the stream. Built for
                volunteers, free for any church, learned in an afternoon.
              </p>

              <div className="animate-reveal mt-10 flex flex-col items-start gap-5 [animation-delay:340ms] sm:flex-row sm:items-center">
                <button
                  onClick={() => onNavigate('/downloads')}
                  className="group inline-flex items-center gap-3 bg-accent px-7 py-4 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-accent-dark"
                >
                  <Download
                    size={16}
                    strokeWidth={1.75}
                    className="transition-transform duration-200 group-hover:translate-y-0.5"
                  />
                  Download for Windows
                </button>
                <a
                  href="#features"
                  className="link-line inline-flex items-center gap-2 py-2 text-sm font-medium text-paper/80 transition-colors duration-200 hover:text-paper"
                >
                  See what it does
                  <ArrowDown size={15} strokeWidth={1.5} />
                </a>
              </div>

              <dl className="animate-reveal mt-16 grid grid-cols-2 gap-y-6 border-t border-line pt-6 [animation-delay:420ms] sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{fact.label}</dt>
                    <dd className="font-display mt-1.5 text-lg font-medium text-paper">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="animate-reveal [animation-delay:300ms] lg:col-span-5">
              <AppMockup />
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      <Features />

      {/* Statement */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-9">
              <Reveal>
                <p className="display text-[clamp(1.75rem,3.6vw,3.25rem)] font-medium leading-[1.12] text-paper">
                  No subscription. No account. No licence key.{' '}
                  <span className="text-accent">Free, forever</span> — because the work is the point, not the invoice.
                </p>
              </Reveal>
            </div>
            <div className="md:col-span-3 md:border-l md:border-line md:pl-8">
              <Reveal delay={100}>
                <p className="text-sm italic leading-relaxed text-muted">
                  “Freely you have received; freely give.”
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Matthew 10:8</p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <ScreenShowcase />

      {/* How it works */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <Reveal>
            <SectionHeading
              label="03 / Getting started"
              title={
                <>
                  Three steps,
                  <br />
                  no setup marathon.
                </>
              }
            />
          </Reveal>

          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 90}>
                <div className="border-t border-line pt-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] text-accent">0{i + 1}</span>
                    <step.icon size={18} strokeWidth={1.5} className="text-muted" />
                  </div>
                  <h3 className="font-display mt-8 text-xl font-medium tracking-tight text-paper">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <Reveal>
                <SectionHeading
                  label="04 / Questions"
                  title={
                    <>
                      Answers,
                      <br />
                      before you ask.
                    </>
                  }
                  sub="If something is missing, the issue tracker on GitHub is the fastest way to reach us."
                />
              </Reveal>
            </div>

            <div className="md:col-span-7 md:col-start-6">
              <div className="border-t border-line">
                {faqs.map((faq, i) => (
                  <Reveal key={faq.q} delay={i * 50}>
                    <details className="group border-b border-line">
                      <summary className="flex cursor-pointer list-none items-baseline gap-5 py-6 transition-colors duration-200 hover:text-accent sm:gap-8">
                        <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
                        <span className="flex-1 font-display text-base font-medium text-paper transition-colors duration-200 group-hover:text-accent sm:text-lg">
                          {faq.q}
                        </span>
                        <span className="relative mt-1 h-3 w-3 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 group-open:text-accent">
                          <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
                          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current" />
                        </span>
                      </summary>
                      <p className="max-w-2xl pb-7 pl-9 pr-8 text-sm leading-relaxed text-muted sm:pl-12">{faq.a}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <DownloadCta onNavigate={onNavigate} />
    </>
  )
}
