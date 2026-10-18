import { useEffect, useState } from 'react'
import { Download, Github, Menu, X } from 'lucide-react'
import { RELEASES_URL } from '../lib/releases'
import Logo from './Logo'

interface NavProps {
  onNavigate: (path: string) => void
  active?: 'home' | 'downloads'
}

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/#features' },
  { label: 'Downloads', path: '/downloads' },
]

export default function Nav({ onNavigate, active = 'home' }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (path: string) => {
    setMenuOpen(false)
    onNavigate(path)
  }

  const isActive = (path: string) =>
    (path === '/' && active === 'home') || (path === '/downloads' && active === 'downloads')

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
        {/* Floating pill */}
        <div
          className={`flex items-center justify-between rounded-2xl px-3 py-2 transition-all duration-300 sm:px-4 ${
            scrolled || menuOpen
              ? 'border border-white/10 bg-[#07070f]/85 shadow-[0_20px_60px_-30px_rgba(0,0,0,1)] backdrop-blur-xl'
              : 'border border-white/5 bg-white/[0.03] backdrop-blur-md'
          }`}
        >
          <button onClick={() => go('/')} className="group flex items-center gap-2.5" aria-label="CrossPresenter home">
            <span className="transition-transform duration-300 group-hover:scale-105">
              <Logo size={24} />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              Cross<span className="text-brand-light">Presenter</span>
            </span>
          </button>

          {/* Desktop links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => go(link.path)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive(link.path)
                    ? 'bg-white/10 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className="hidden rounded-xl p-2 text-white/45 transition-all hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              <Github size={18} />
            </a>
            <button
              onClick={() => go('/downloads')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-[#6a8dff] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,106,247,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(124,106,247,1)]"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:text-white md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            menuOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#07070f]/92 p-2 backdrop-blur-xl">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => go(link.path)}
                className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-brand/15 text-white ring-1 ring-brand/30'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            ))}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Github size={15} /> Source on GitHub
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
