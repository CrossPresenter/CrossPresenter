import { ArrowUpRight } from 'lucide-react'
import { REPO_URL, RELEASES_URL } from '../lib/releases'
import Logo from './Logo'

interface FooterProps {
  onNavigate: (path: string) => void
}

const productLinks = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/#features' },
  { label: 'Screens', path: '/#screens' },
  { label: 'Downloads', path: '/downloads' },
]

const elsewhereLinks = [
  { label: 'Source code', href: REPO_URL },
  { label: 'Releases', href: RELEASES_URL },
  { label: 'Issues', href: `${REPO_URL}/issues` },
]

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
        <div className="grid gap-12 py-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <Logo size={19} />
              <span className="font-display text-sm font-semibold tracking-tight text-paper">CrossPresenter</span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              Presentation software for churches — lyrics, scripture, media and live video on every screen. Free and
              open source, built by the people who use it.
            </p>
          </div>

          <div className="md:col-span-3 md:col-start-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Product</p>
            <ul className="mt-5 space-y-3 text-sm">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => onNavigate(link.path)}
                    className="text-paper/70 transition-colors duration-200 hover:text-paper"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Elsewhere</p>
            <ul className="mt-5 space-y-3 text-sm">
              {elsewhereLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-1.5 text-paper/70 transition-colors duration-200 hover:text-paper"
                  >
                    {link.label}
                    <ArrowUpRight
                      size={12}
                      strokeWidth={1.5}
                      className="text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p
          className="display select-none border-t border-line pt-10 text-[clamp(2.5rem,8vw,6.5rem)] font-semibold leading-none text-ink-3"
          aria-hidden="true"
        >
          CrossPresenter
        </p>

        <div className="flex flex-col gap-3 border-t border-line py-8 md:flex-row md:items-start md:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            © 2026 CrossPresenter · GPLv3
          </p>
          <p className="max-w-xl text-[11px] leading-relaxed text-muted/70">
            CrossPresenter and its logo are trademarks of Beniel Sugirthan / GiveFreely Studios. Forks must change the
            name, branding and logos before distributing.
          </p>
        </div>
      </div>
    </footer>
  )
}
