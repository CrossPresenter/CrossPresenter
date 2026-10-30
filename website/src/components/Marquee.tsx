const items = [
  'Live lyrics',
  'Scripture',
  'Video backgrounds',
  'Stage view',
  'NDI output',
  'Remote control',
  'Phone camera',
  'Recording',
  'Service plans',
]

export default function Marquee() {
  return (
    <div className="group overflow-hidden border-y border-line py-5" aria-hidden="true">
      <div className="animate-marquee flex w-max group-hover:[animation-play-state:paused]">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0">
            {items.map((item) => (
              <span
                key={`${half}-${item}`}
                className="flex items-center gap-6 pr-6 font-mono text-[10px] uppercase tracking-[0.26em] text-muted"
              >
                {item}
                <span className="h-1 w-1 rounded-full bg-accent/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
