import { useEffect, useState, useCallback } from 'react'

export type Route = 'home' | 'downloads'

function pathToRoute(path: string): Route {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/'
  if (clean === '/downloads') return 'downloads'
  return 'home'
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => pathToRoute(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path)
    setRoute(pathToRoute(path))
    window.scrollTo(0, 0)
  }, [])

  return { route, navigate }
}
