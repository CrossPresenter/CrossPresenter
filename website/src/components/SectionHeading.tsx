interface SectionHeadingProps {
  eyebrow: string
  title: string
  sub?: string
  align?: 'center' | 'left'
}

export default function SectionHeading({ eyebrow, title, sub, align = 'center' }: SectionHeadingProps) {
  const centered = align === 'center'
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-brand/70" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-light">{eyebrow}</p>
        {centered && <span className="h-px w-8 bg-gradient-to-l from-transparent to-brand/70" />}
      </div>
      <h2 className="font-display mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-white/50">{sub}</p>}
    </div>
  )
}
