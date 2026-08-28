import { Github } from 'lucide-react'
import { REPO_URL } from '../lib/releases'
import Logo from './Logo'

interface FooterProps {
  onNavigate: (path: string) => void
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-white/5 bg-[#0c0c1a]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Logo size={22} />
              <span className="text-base font-bold text-white">CrossPresenter</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Free and open-source church presentation software for lyrics, Bible, media and live video backgrounds.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/35">Product</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <button onClick={() => onNavigate('/')} className="text-white/60 transition-colors hover:text-white">
                    Home
                  </button>
                </li>
                <li>
                  <a href="/#features" className="text-white/60 transition-colors hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <button onClick={() => onNavigate('/downloads')} className="text-white/60 transition-colors hover:text-white">
                    Downloads
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/35">Community</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-white/60 transition-colors hover:text-white">
                    Source code
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/CrossPresenter/CrossPresenter/issues" 
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white"
                  >
                    <Github size={14} /> Report a bug / request a feature
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/5 pt-6">
          <p className="text-xs leading-relaxed text-white/30">
            CrossPresenter and its logo are trademarks of Beniel Sugirthan / GiveFreely studios. Source code is free to
            fork under the GNU General Public License v3.0 — you must change the name, branding and logos if you
            distribute a modified or fork version of this software.
          </p>
        </div>
      </div>
    </footer>
  )
}
