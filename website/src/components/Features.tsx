import {
  BookOpen,
  Camera,
  CalendarDays,
  Clock,
  Film,
  Image,
  Mic,
  Monitor,
  Radio,
  Smartphone,
  Type,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeading from './SectionHeading'
import Reveal from './Reveal'

interface BentoCard {
  icon: LucideIcon
  title: string
  body: string
  accent: string
  span: string
  visual?: 'lyrics'
}

const bento: BentoCard[] = [
  {
    icon: Type,
    title: 'Live lyrics & scripture',
    body: 'Type or edit lyrics on the fly and pull scripture with one click — a built-in Bible with multiple translations, ready the moment you need it.',
    accent: 'from-[#7c6af7] to-[#47bfff]',
    span: 'sm:col-span-2',
    visual: 'lyrics',
  },
  {
    icon: Monitor,
    title: 'Multi-view & stage output',
    body: 'A different look for the main screens, the online audience and the stage — all driven from one control window.',
    accent: 'from-[#10b981] to-[#22d3ee]',
    span: 'sm:col-span-2',
  },
  {
    icon: Film,
    title: 'Video & YouTube backgrounds',
    body: 'Play local clips or YouTube videos as full-screen backgrounds, synced across every machine.',
    accent: 'from-[#f43f5e] to-[#fb923c]',
    span: 'sm:col-span-2',
  },
  {
    icon: CalendarDays,
    title: 'Service plans',
    body: 'Songs, readings, media and notes in one clean order. Tap to go live.',
    accent: 'from-[#22d3ee] to-[#3b82f6]',
    span: 'sm:col-span-1',
  },
  {
    icon: Smartphone,
    title: 'Remote control',
    body: 'Advance slides from a phone or tablet over WiFi.',
    accent: 'from-[#3b82f6] to-[#6366f1]',
    span: 'sm:col-span-1',
  },
  {
    icon: Radio,
    title: 'NDI output',
    body: 'Send output over NDI straight to your streaming computer.',
    accent: 'from-[#f59e0b] to-[#f97316]',
    span: 'sm:col-span-1',
  },
  {
    icon: Camera,
    title: 'Camera backgrounds',
    body: 'Use a webcam — or your phone camera over WiFi — as a live background.',
    accent: 'from-[#a855f7] to-[#ec4899]',
    span: 'sm:col-span-1',
  },
  {
    icon: BookOpen,
    title: 'Open source, free forever',
    body: 'GPLv3 licensed. No subscriptions, no lock-in, no annual fees — freely given, so freely given.',
    accent: 'from-[#22c55e] to-[#10b981]',
    span: 'sm:col-span-2',
  },
]

const chips = [
  { icon: Clock, label: 'Clocks & countdowns' },
  { icon: Mic, label: 'Recording' },
  { icon: Users, label: 'Built for teams' },
  { icon: Image, label: 'Images & media' },
]

function MiniLyrics() {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-light">Verse 2 of 4</p>
      <p className="font-display mt-2 text-lg font-bold leading-snug text-white">
        How great is our <span className="text-brand-light">God</span>
      </p>
      <div className="mt-3 space-y-1.5" aria-hidden>
        <span className="block h-1.5 w-3/4 rounded-full bg-white/15" />
        <span className="block h-1.5 w-1/2 rounded-full bg-white/10" />
      </div>
    </div>
  )
}

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute bottom-32 -left-32 h-80 w-80 rounded-full bg-[#47bfff]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Key Features"
          title="Everything you need to lead a service"
          sub="Lyrics, scripture, media and live video in one fast, intuitive interface — built for volunteers, powerful enough for full production."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bento.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i, 7) * 70} className={`h-full ${f.span}`}>
              <article className="group glass relative flex h-full flex-col rounded-3xl border border-white/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_28px_60px_-35px_rgba(124,106,247,1)]">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${f.accent} text-white shadow-[0_12px_26px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-110`}
                >
                  <f.icon size={20} />
                </span>
                <h3 className="font-display mt-4 text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/45">{f.body}</p>
                {f.visual === 'lyrics' && <MiniLyrics />}
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {chips.map((c, i) => (
            <Reveal key={c.label} delay={i * 70}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/55 transition-all hover:border-brand/40 hover:text-white">
                <c.icon size={14} className="text-brand-light" /> {c.label}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
