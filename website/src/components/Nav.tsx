import { Github } from 'lucide-react'
import { RELEASES_URL } from '../lib/releases'
import Logo from './Logo'

interface NavProps {
  onNavigate: (path: string) => void
}

export default function Nav({ onNavigate }: NavProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0c0c1a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-white">CrossPresenter</span>
        </button>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onNavigate('/')}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Home
          </button>
          <a
            href="/#features"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Features
          </a>
          <button
            onClick={() => onNavigate('/downloads')}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            Downloads
          </button>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center justify-center rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            title="GitHub"
          >
            <Github size={18} />
          </a>
        </nav>
      </div>
    </header>
  )
}
