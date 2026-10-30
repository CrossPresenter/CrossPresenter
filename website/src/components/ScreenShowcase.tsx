import { MonitorPlay, Radio, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionHeading from './SectionHeading'
import Reveal from './Reveal'

interface ScreenCard {
  icon: LucideIcon
  label: string
  title: string
  body: string
}

const screens: ScreenCard[] = [
  {
    icon: MonitorPlay,
    label: 'Main output',
    title: 'What the room sees',
    body: 'Full-screen lyrics, scripture and video on your projector or TV, switched instantly from the control window.',
  },
  {
    icon: Users,
    label: 'Stage view',
    title: 'What your team sees',
    body: 'A confidence view for leaders and musicians — next line, timer and service clock, sized for a tablet on a stand.',
  },
  {
    icon: Radio,
    label: 'Stream & NDI',
    title: 'What online sees',
    body: 'A clean feed for OBS or your streaming PC over NDI or HDMI — no capture card, no extra converters.',
  },
]

function StageMockup() {
  return (
    <div className="flex h-full flex-col justify-between bg-[#0a0a16] p-4">
      <div className="flex items-center justify-between text-[9px] text-white/40">
        <span className="rounded bg-white/10 px-1.5 py-0.5">SERVICE CLOCK</span>
        <span className="text-brand-light">10:02:41</span>
      </div>
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Next</p>
        <p className="mt-1 text-sm font-semibold text-white">Bible Reading — John 3:16</p>
      </div>
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-center">
        <p className="text-[10px] font-semibold text-amber-300">04:12 remaining</p>
      </div>
    </div>
  )
}

export default function ScreenShowcase() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rule-gradient" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-[#47bfff]/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Every screen"
          title="One control window, three live views"
          sub="Plug in extra displays and CrossPresenter gives each of them the right content — automatically, with zero lag between them."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {screens.map((s, i) => (
            <Reveal key={s.label} delay={i * 110} className="h-full">
              <article className="group glass flex h-full flex-col rounded-3xl border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
                {/* Visual */}
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10">
                  {i === 0 && (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'radial-gradient(120% 130% at 25% 0%, #4a37a0 0%, #1a1447 50%, #0b0920 100%)',
                        }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-5 text-center">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-brand-light">
                          Verse 2 of 4
                        </p>
                        <p className="font-display text-base font-bold leading-tight text-white sm:text-lg">
                          How great is our <span className="text-brand-light">God</span>
                        </p>
                      </div>
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[8px] text-white/60 backdrop-blur">
                        <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-[#f43f5e]" /> LIVE
                      </span>
                    </>
                  )}
                  {i === 1 && <StageMockup />}
                  {i === 2 && (
                    <>
                      <div className="absolute inset-0 bg-[#05050c]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-medium text-white/50">
                          OBS · NDI source connected
                        </span>
                      </div>
                      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/60 px-3 py-2 backdrop-blur">
                        <p className="truncate text-[10px] font-semibold text-white">
                          How great is our God
                        </p>
                        <div className="mt-1 h-1 w-2/3 rounded-full bg-brand/70" />
                      </div>
                    </>
                  )}
                </div>

                {/* Copy */}
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-[#47bfff] text-white">
                      <s.icon size={15} />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-light">
                        {s.label}
                      </p>
                      <h3 className="font-display text-sm font-semibold text-white">{s.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/45">{s.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
