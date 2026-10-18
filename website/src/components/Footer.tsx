import { ArrowUpRight, Github } from 'lucide-react'
import { REPO_URL } from '../lib/releases'
import Logo from './Logo'

interface FooterProps {
  onNavigate: (path: string) => void
}

const productLinks = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/#features' },
  { label: 'Downloads', path: '/downloads' },
]

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative border-t border-white/10 bg-[#05050b]">
      <div className="rule-gradient absolute inset-x-0 top-0" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <Logo size={26} />
              <span className="font-display text-lg font-bold text-white">
                Cross<span className="text-brand-light">Presenter</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/45">
              Free, open-source church presentation software for lyrics, Bible, media and live video backgrounds —
              built by the church, for the church.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white/65 transition-all hover:border-brand/40 hover:text-white"
              >
                <Github size={15} /> GitHub
              </a>
              <button
                onClick={() => onNavigate('/downloads')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-[#6a8dff] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(124,106,247,1)] transition-all hover:-translate-y-0.5"
              >
                Download <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/35">Product</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => onNavigate(link.path)}
                    className="text-white/60 transition-all hover:translate-x-0.5 hover:text-white"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/35">Community</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-white/60 transition-all hover:translate-x-0.5 hover:text-white"
                >
                  Source code <ArrowUpRight size={13} className="opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/CrossPresenter/CrossPresenter/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-white/60 transition-all hover:translate-x-0.5 hover:text-white"
                >
                  <Github size={14} /> Report a bug / request a feature
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="rule-gradient mt-12" aria-hidden />
        <p className="mt-6 text-xs leading-relaxed text-white/30">
          CrossPresenter and its logo are trademarks of Beniel Sugirthan / GiveFreely studios. Source code is free to
          fork under the GNU General Public License v3.0 — you must change the name, branding and logos if you
          distribute a modified or fork version of this software.
        </p>
      </div>
    </footer>
  )
}
