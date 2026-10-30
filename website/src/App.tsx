import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import { useRoute } from './router'

export default function App() {
  const { route, navigate } = useRoute()

  return (
    <div className="min-h-screen bg-ink text-paper">
      <a
        href="#main"
        className="sr-only z-[100] bg-accent px-4 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav onNavigate={navigate} active={route} />
      <div key={route} id="main" className="animate-reveal">
        {route === 'downloads' ? <Downloads /> : <Home onNavigate={navigate} />}
      </div>
      <Footer onNavigate={navigate} />
    </div>
  )
}
