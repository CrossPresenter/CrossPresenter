import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

function MainOutput() {
  return (
    <div className="relative flex h-full flex-col justify-center bg-ink-2 px-6">
      <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-accent">Verse 2 of 4</p>
      <p className="display mt-2 text-xl font-medium leading-tight text-paper sm:text-2xl">
        How great is our God
      </p>
      <span className="mt-5 h-px w-10 bg-line" />
    </div>
  )
}

function StageView() {
  return (
    <div className="flex h-full flex-col justify-between bg-ink-2 p-4">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <span>Stage</span>
        <span className="text-paper/70">10:02:41</span>
      </div>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Next</p>
        <p className="mt-1 font-display text-[13px] font-medium leading-snug text-paper/85">
          Bible reading — John 3:16
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[9px] uppercase tracking-[0.16em]">
        <span className="text-accent">04:12 left</span>
        <span className="text-muted">38:20 in</span>
      </div>
    </div>
  )
}

function StreamView() {
  return (
    <div className="relative flex h-full flex-col justify-end bg-[#080807] p-4">
      <span className="absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
        NDI · OBS
      </span>
      <span className="absolute right-4 top-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent">
        <span className="animate-pulse-dot h-1 w-1 rounded-full bg-accent" /> On air
      </span>
      <div className="border-l border-accent pl-3">
        <p className="font-display text-sm font-medium leading-snug text-paper">How great is our God</p>
        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-muted">Lower third · auto</p>
      </div>
    </div>
  )
}

const screens = [
  {
    label: '01 / Main',
    title: 'What the room sees',
    body: 'Full-screen lyrics, scripture and video on the projector or TV, switched the moment you send it.',
    visual: <MainOutput />,
    span: 'md:col-span-5',
  },
  {
    label: '02 / Stage',
    title: 'What your team sees',
    body: 'A confidence view for leaders and musicians — next line, service clock and a countdown, sized for a tablet.',
    visual: <StageView />,
    span: 'md:col-span-4',
  },
  {
    label: '03 / Stream',
    title: 'What online sees',
    body: 'A clean feed for OBS or your streaming PC over NDI or HDMI. No capture card, no extra converters.',
    visual: <StreamView />,
    span: 'md:col-span-3',
  },
]

export default function ScreenShowcase() {
  return (
    <section id="screens" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
        <div className="grid items-end gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <Reveal>
              <SectionHeading
                label="02 / Every screen"
                title={
                  <>
                    One desk,
                    <br />
                    three live views.
                  </>
                }
              />
            </Reveal>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <Reveal delay={80}>
              <p className="text-[15px] leading-relaxed text-muted">
                Plug in another display and CrossPresenter gives it the right content — instantly, with no lag between
                what you click and what the room hears.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-12 md:gap-6">
          {screens.map((screen, i) => (
            <Reveal key={screen.label} delay={i * 90} className={screen.span}>
              <div className="group">
                <div className="relative aspect-[4/3] overflow-hidden border border-line transition-colors duration-300 group-hover:border-paper/30">
                  {screen.visual}
                </div>
                <div className="mt-5 flex items-baseline gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{screen.label}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <h3 className="font-display mt-3 text-lg font-medium tracking-tight text-paper">{screen.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{screen.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
