import { useEffect, useState } from 'react'

function useClock() {
  const [time, setTime] = useState('10:02:41')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map((n) => String(n).padStart(2, '0'))
          .join(':'),
      )
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])
  return time
}

/**
 * Hero composition: the projected output in front, the stage confidence
 * view tucked behind it. Drawn with hairlines rather than glossy cards.
 */
export default function AppMockup() {
  const clock = useClock()

  return (
    <div className="relative mx-auto w-full max-w-[27rem]">
      {/* Stage view, behind and above */}
      <div className="relative w-[76%] border border-line bg-ink-2">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          <span>Stage</span>
          <span className="text-paper/70">{clock}</span>
        </div>
        <div className="px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">Next</p>
          <p className="mt-1.5 font-display text-[13px] font-medium leading-snug text-paper/80">
            John 3:16 — For God so loved the world
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 font-mono text-[9px] uppercase tracking-[0.16em]">
            <span className="text-accent">04:12 left</span>
            <span className="text-muted">38:20 in</span>
          </div>
        </div>
      </div>

      {/* Main output, in front */}
      <div className="animate-drift relative z-10 -mt-6 ml-auto w-[94%] border border-line bg-ink-2 shadow-[0_36px_70px_-45px_rgba(0,0,0,0.95)]">
        {/* Registration marks */}
        <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t border-paper/40" aria-hidden />
        <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t border-paper/40" aria-hidden />
        <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l border-paper/40" aria-hidden />
        <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r border-paper/40" aria-hidden />

        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          <span className="flex items-center gap-2 text-paper/80">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
            Output 01
          </span>
          <span>1920 × 1080</span>
        </div>

        <div className="flex aspect-[4/3] flex-col justify-center px-6 sm:px-8">
          <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-accent">Verse 2 of 4</p>
          <p className="display mt-3 text-[1.6rem] font-medium text-paper sm:text-[1.85rem]">
            How great is our God
            <span className="animate-caret ml-1 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] bg-accent align-baseline" />
          </p>
          <div className="mt-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              How great is our God · chorus
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          <span>Lyrics · live</span>
          <span className="text-paper/70">Space to advance</span>
        </div>
      </div>
    </div>
  )
}
