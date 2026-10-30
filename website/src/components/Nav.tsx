import { useEffect, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'

function useClock() {
  const [time, setTime] = useState('')
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
import { REPO_URL } from '../lib/releases'
import Logo from './Logo'

interface NavProps {
  onNavigate: (path: string) => void
  active?: 'home' | 'downloads'
}

const navLinks = [
  { label: 'Features', path: '/#features' },
  { label: 'Screens', path: '/#screens' },
  { label: 'Downloads', path: '/downloads' },
]

export default function Nav({ onNavigate, active = 'home' }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const clock = useClock()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (path: string) => {
    setMenuOpen(false)
    onNavigate(path)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || menuOpen ? 'border-b border-line bg-ink/90 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[88rem] items-center justify-between px-6 lg:px-10">
        <button onClick={() => go('/')} className="group flex items-center gap-3" aria-label="CrossPresenter home">
          <span className="text-paper transition-colors duration-200 group-hover:text-accent">
            <Logo size={21} />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-paper">CrossPresenter</span>
        </button>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => go(link.path)}
              className={`link-line font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200 ${
                link.path === '/downloads' && active === 'downloads'
                  ? 'text-paper'
                  : 'text-muted hover:text-paper'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <span className="hidden font-mono text-[10px] tabular-nums tracking-[0.18em] text-muted sm:block">
            {clock}
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="link-line hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-paper sm:block"
          >
            GitHub
          </a>
          <button
            onClick={() => go('/downloads')}
            className="group inline-flex items-center gap-2 bg-accent px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors duration-200 hover:bg-accent-dark"
          >
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Get app</span>
            <ArrowUpRight
              size={14}
              strokeWidth={1.75}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </button>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="-mr-2 p-2 text-paper transition-colors duration-200 hover:text-accent md:hidden"
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`overflow-hidden border-line bg-ink transition-[max-height,opacity] duration-300 md:hidden ${
          menuOpen ? 'max-h-96 border-b opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-[88rem] flex-col px-6 pb-6" aria-label="Mobile">
          {navLinks.map((link, i) => (
            <button
              key={link.label}
              onClick={() => go(link.path)}
              className="group flex items-baseline justify-between border-b border-line py-4 text-left"
            >
              <span className="display text-2xl font-medium text-paper transition-colors duration-200 group-hover:text-accent">
                {link.label}
              </span>
              <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
            </button>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-baseline justify-between py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-paper"
          >
            Source on GitHub <ArrowUpRight size={13} strokeWidth={1.5} />
          </a>
        </nav>
      </div>
    </header>
  )
}
