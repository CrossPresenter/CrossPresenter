import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import { useRoute } from './router'

export default function App() {
  const { route, navigate } = useRoute()

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <Nav onNavigate={navigate} active={route} />
      <div key={route} className="animate-fade-up">
        {route === 'downloads' ? <Downloads /> : <Home onNavigate={navigate} />}
      </div>
      <Footer onNavigate={navigate} />
    </div>
  )
}
