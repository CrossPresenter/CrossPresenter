import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import { useRoute } from './router'

export default function App() {
  const { route, navigate } = useRoute()

  return (
    <div className="min-h-screen bg-[#0c0c1a] text-white">
      <Nav onNavigate={navigate} />
      {route === 'downloads' ? <Downloads /> : <Home onNavigate={navigate} />}
      <Footer onNavigate={navigate} />
    </div>
  )
}
