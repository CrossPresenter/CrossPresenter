import {
  BookOpen,
  Camera,
  CalendarDays,
  Clock,
  Film,
  Mic,
  Monitor,
  Radio,
  Smartphone,
  Type,
  Video,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  body: string
}

const features: Feature[] = [
  {
    icon: Type,
    title: 'Live Lyrics & Scripture',
    body: 'Type or edit lyrics on the fly, and pull scripture with one click — built-in Bible with multiple translations.',
  },
  {
    icon: CalendarDays,
    title: 'Service Plans',
    body: 'Plan the whole service: songs, readings, media and notes in one clean order. Tap to go live.',
  },
  {
    icon: Film,
    title: 'Video & YouTube Backgrounds',
    body: 'Play local videos or YouTube clips as full-screen backgrounds, synced across machines.',
  },
  {
    icon: Camera,
    title: 'Camera Backgrounds',
    body: 'Use your webcam — or even your phone camera over WiFi — as a live background behind your lyrics.',
  },
  {
    icon: Monitor,
    title: 'Multi-View & Stage Output',
    body: 'Different looks for your screens, your online audience, and a stage view for leaders and musicians.',
  },
  {
    icon: Radio,
    title: 'NDI Output',
    body: 'Send your output over NDI to your streaming computer — no converters or SDI cables needed.',
  },
  {
    icon: Smartphone,
    title: 'Remote Control',
    body: 'Advance slides from a phone or tablet over WiFi. Perfect for rehearsals and smaller teams.',
  },
  {
    icon: Clock,
    title: 'Clock, Timer & Countdowns',
    body: 'A service clock, countdown timers and alarms keep everyone on schedule.',
  },
  {
    icon: Mic,
    title: 'Recording',
    body: 'Record the live presenter output as video with audio — or capture quick audio messages.',
  },
  {
    icon: Video,
    title: 'Images & Media',
    body: 'Drag in images and media as backgrounds and stage them with a single click.',
  },
  {
    icon: Users,
    title: 'Built for Teams',
    body: 'Made for churches and worship teams of any size — simple enough for a volunteer, powerful enough for full production.',
  },
  {
    icon: BookOpen,
    title: 'Open Source, Free Forever',
    body: 'GPLv3 licensed. No subscriptions, no lock-in, no annual fees. Freely given, so freely given.',
  },
]

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-light">Key Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to lead a service
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/50">
            CrossPresenter brings together lyrics, scripture, media and live video in one fast, intuitive interface.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition-all hover:border-brand/30 hover:bg-white/[0.05]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand-light ring-1 ring-brand/20 transition-colors group-hover:bg-brand group-hover:text-white">
                <f.icon size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
