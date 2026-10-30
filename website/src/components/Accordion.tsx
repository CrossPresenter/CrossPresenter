import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
}

export default function Accordion({ items }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null)

  return (
    <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      {items.map((item) => {
        const isOpen = open === item.id
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-sm font-semibold text-white">{item.title}</span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-cyan-300/70 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className="px-5 pb-5 text-sm leading-relaxed text-white/55">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
