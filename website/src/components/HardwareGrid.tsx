import { Cpu, HardDrive, Layers, MemoryStick, MonitorSmartphone, type LucideIcon } from 'lucide-react'

interface SpecRow {
  icon: LucideIcon
  label: string
  minimum: string
  recommended: string
}

const ROWS: SpecRow[] = [
  { icon: Cpu, label: 'Processor', minimum: 'Dual-core 64-bit (x86-64 / ARM64)', recommended: 'Quad-core or faster' },
  { icon: MemoryStick, label: 'Memory', minimum: '4 GB RAM', recommended: '8 GB RAM or more' },
  { icon: HardDrive, label: 'Storage', minimum: '1 GB free disk space', recommended: '2 GB+ on an SSD' },
  { icon: MonitorSmartphone, label: 'Display', minimum: '1280 × 720 output', recommended: '4K (3840 × 2160) with hardware decode' },
  { icon: Layers, label: 'Operating system', minimum: 'Windows 10 · macOS 12 · Ubuntu 20.04', recommended: 'Windows 11 · macOS 14 · Ubuntu 24.04' },
]

export default function HardwareGrid() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      {/* Header */}
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/35">Component</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/35">Minimum</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">Recommended</span>
      </div>

      {ROWS.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-4 border-b border-white/5 px-5 py-4 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300/80">
              <row.icon size={16} />
            </span>
            <span className="text-sm font-medium text-white">{row.label}</span>
          </div>
          <span className="text-sm text-white/50">{row.minimum}</span>
          <span className="text-sm text-white/75">{row.recommended}</span>
        </div>
      ))}
    </div>
  )
}
