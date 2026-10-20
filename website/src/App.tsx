import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import { useRoute } from './router'

export default function App() {
  const { route, navigate } = useRoute()

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <a
        href="#main"
        className="sr-only z-[100] rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div className="grain pointer-events-none fixed inset-0 z-40 opacity-[0.04]" aria-hidden />
      <Nav onNavigate={navigate} active={route} />
      <div key={route} id="main" className="animate-fade-up">
        {route === 'downloads' ? <Downloads /> : <Home onNavigate={navigate} />}
      </div>
      <Footer onNavigate={navigate} />
    </div>
  )
}
