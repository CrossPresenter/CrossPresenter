import { useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'

export interface Snippet {
  key: string
  label: string
  lines: string[]
}

interface TerminalSnippetsProps {
  snippets: Snippet[]
}

export default function TerminalSnippets({ snippets }: TerminalSnippetsProps) {
  const [active, setActive] = useState(snippets[0]?.key ?? '')
  const [copied, setCopied] = useState(false)

  const current = snippets.find((s) => s.key === active) ?? snippets[0]

  async function copy() {
    if (!current) return
    const runnable = current.lines.filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).join('\n')
    try {
      await navigator.clipboard.writeText(runnable)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable (insecure context / denied) */
    }
  }

  if (!current) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
        <div className="flex gap-1">
          {snippets.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                s.key === current.key
                  ? 'bg-gradient-to-r from-cyan-400/90 to-blue-500/90 text-white shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          title="Copy commands"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
        >
          {copied ? <Check size={13} className="text-cyan-300" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code */}
      <div className="flex items-start gap-3 px-5 py-4">
        <Terminal size={16} className="mt-1 shrink-0 text-cyan-300/60" />
        <pre className="flex-1 overflow-x-auto text-[13px] leading-relaxed">
          {current.lines.map((line, i) => {
            const isComment = line.trim().startsWith('#')
            return (
              <div key={i} className={isComment ? 'text-white/35' : 'text-white/85'}>
                {line === '' ? ' ' : line}
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}
