import type { ReactNode } from 'react'

interface SectionHeadingProps {
  label: string
  title: ReactNode
  sub?: string
  className?: string
}

export default function SectionHeading({ label, title, sub, className = '' }: SectionHeadingProps) {
  return (
    <div className={className}>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{label}</p>
      <h2 className="display mt-5 text-3xl font-semibold text-paper sm:text-4xl lg:text-[2.6rem]">{title}</h2>
      {sub && <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{sub}</p>}
    </div>
  )
}
