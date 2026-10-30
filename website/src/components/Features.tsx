import { ArrowUpRight } from 'lucide-react'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const capabilities = [
  {
    title: 'Lyrics, live',
    body: 'Type a line and it is already on screen. No slide decks, no saving, no rebuilding between verses — just the words as they come.',
  },
  {
    title: 'Scripture, one click',
    body: 'Search a reference, choose a translation and send it. Multiple English translations plus Tamil, all built in and available offline.',
  },
  {
    title: 'Service plans',
    body: 'Songs, readings, media and notes in the order you will actually use them. Drag to rearrange, click to put anything live.',
  },
  {
    title: 'Every display, its own view',
    body: 'The projector, the stage tablet and the stream each get the right content — all driven from a single control window.',
  },
  {
    title: 'Camera and video',
    body: 'A webcam, a phone camera over Wi-Fi, a local clip or a YouTube video can sit behind the lyrics as a full-screen background.',
  },
  {
    title: 'Remote and recording',
    body: 'Advance slides from a phone on the same network. Record the output with audio when you want a copy of the service.',
  },
]

const also = [
  'NDI output',
  'Clocks and countdowns',
  'Images and media',
  'Team presets',
  'Multiple Bibles',
  'No telemetry',
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4 lg:col-span-3">
            <Reveal>
              <SectionHeading
                label="01 / Capabilities"
                title={
                  <>
                    The whole service,
                    <br />
                    one window.
                  </>
                }
                sub="CrossPresenter does the handful of things a Sunday morning actually needs, and does them without ceremony."
              />
            </Reveal>
          </div>

          <div className="md:col-span-8 lg:col-span-8 lg:col-start-5">
            <ul className="border-t border-line">
              {capabilities.map((item, i) => (
                <li key={item.title} className="border-b border-line">
                  <Reveal delay={i * 60}>
                    <div className="group flex items-start gap-5 py-6 transition-colors duration-200 hover:bg-ink-2/50 sm:gap-8 sm:py-7">
                      <span className="mt-1 font-mono text-[10px] text-muted transition-colors duration-200 group-hover:text-accent">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-xl font-medium tracking-tight text-paper transition-transform duration-300 group-hover:translate-x-1 sm:text-2xl">
                          {item.title}
                        </h3>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{item.body}</p>
                      </div>
                      <ArrowUpRight
                        size={16}
                        strokeWidth={1.5}
                        className="mt-1.5 shrink-0 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
                      />
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>

            <p className="mt-7 font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-muted">
              Also included
              <span className="mx-3 text-line">/</span>
              {also.map((item, i) => (
                <span key={item}>
                  {item}
                  {i < also.length - 1 && <span className="mx-3 text-line">·</span>}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
