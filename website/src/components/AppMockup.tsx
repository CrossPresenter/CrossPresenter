import { BookOpen, Camera, Clock, Film, ListMusic, Mic, Monitor, Smartphone } from 'lucide-react'

const serviceItems = [
  { time: '10:00', label: 'Opening Prayer', active: false },
  { time: '10:02', label: 'Worship — How Great Is Our God', active: true },
  { time: '10:20', label: 'Bible Reading — John 3:16', active: false },
  { time: '10:25', label: 'Announcements', active: false },
  { time: '10:30', label: 'Message — The Gospel', active: false },
]

export default function AppMockup() {
  return (
    <div className="relative animate-float pb-8">
      <div className="absolute -inset-8 rounded-[2rem] bg-brand/20 blur-3xl" aria-hidden />

      {/* Control window */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-black/50 transition-transform duration-500 ease-out lg:[transform:perspective(1600px)_rotateY(-7deg)_rotateX(2deg)] lg:hover:[transform:perspective(1600px)_rotateY(0deg)_rotateX(0deg)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-surface-light px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 hidden rounded-md bg-black/30 px-3 py-1 text-[10px] text-white/40 sm:block">
            CrossPresenter — Control window
          </span>
          <span className="ml-auto hidden items-center gap-1.5 rounded-md bg-[#f43f5e]/15 px-2 py-1 text-[9px] font-semibold tracking-wider text-[#fb7185] ring-1 ring-[#f43f5e]/30 sm:flex">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-[#f43f5e]" /> LIVE
          </span>
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/5 bg-surface-light px-3 py-2">
          <div className="flex items-center gap-1.5">
            {[Monitor, ListMusic, BookOpen, Film].map((Icon, i) => (
              <span
                key={i}
                className={`flex h-6 w-6 items-center justify-center rounded-md ${
                  i === 1 ? 'bg-brand text-white shadow-[0_0_14px_rgba(124,106,247,0.5)]' : 'text-white/35'
                }`}
              >
                <Icon size={13} />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-2 text-[9px] text-white/50">
              <Clock size={10} className="text-brand-light" /> 10:02
            </span>
            <span className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-2 text-[9px] text-white/50">
              <Camera size={10} className="text-brand-light" /> Phone cam
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex">
          {/* Left panel */}
          <div className="hidden w-44 shrink-0 border-r border-white/5 bg-surface-light/60 p-2.5 sm:block">
            <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-white/30">Service Order</p>
            <div className="space-y-1">
              {serviceItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg px-2 py-1.5 transition-colors ${
                    item.active
                      ? 'bg-brand/20 ring-1 ring-brand/40 shadow-[0_0_16px_-6px_rgba(124,106,247,0.8)]'
                      : 'bg-white/[0.03]'
                  }`}
                >
                  <p className={`truncate text-[9px] font-medium ${item.active ? 'text-white' : 'text-white/45'}`}>
                    {item.label}
                  </p>
                  <p className="text-[8px] text-white/30">{item.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="relative flex-1">
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(120% 120% at 20% 0%, #4a37a0 0%, #1c1550 45%, #0d0b24 100%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(80% 60% at 50% 100%, rgba(71,191,255,0.18) 0%, transparent 70%)',
              }}
              aria-hidden
            />
            <div className="relative flex h-56 flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-light">
                Verse 2 of 4
              </p>
              <h3 className="max-w-xs text-2xl font-bold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-3xl">
                How great is our <span className="text-brand-light">God</span>
              </h3>
              <p className="text-xs text-white/60">— Worship — How Great Is Our God</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/30 px-3 py-1.5 backdrop-blur">
              <span className="flex items-center gap-1 text-[9px] text-white/45">
                <Smartphone size={10} /> Remote ready
              </span>
              <span className="flex items-center gap-1 text-[9px] text-white/45">
                <Mic size={10} /> Rec off
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating live-output window (what the congregation sees) */}
      <div className="absolute -bottom-2 -right-3 hidden w-56 rotate-[2.5deg] overflow-hidden rounded-xl border border-white/15 bg-surface shadow-[0_34px_70px_-30px_rgba(0,0,0,1)] transition-transform duration-500 hover:rotate-0 md:block lg:-right-8 lg:w-64">
        <div className="flex items-center gap-2 border-b border-white/5 bg-surface-light px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="text-[9px] text-white/45">Live output — Display 2</span>
          <span className="ml-auto text-[8px] text-white/30">1920×1080</span>
        </div>
        <div
          className="flex h-28 flex-col items-center justify-center gap-1 px-4 text-center lg:h-32"
          style={{ background: 'radial-gradient(120% 130% at 30% 0%, #4a37a0 0%, #171243 55%, #0a0820 100%)' }}
        >
          <p className="font-display text-base font-bold leading-tight text-white lg:text-lg">
            How great is our God
          </p>
          <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-brand-light">Verse 2 of 4</p>
        </div>
      </div>
    </div>
  )
}
