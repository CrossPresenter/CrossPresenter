import { useEffect, useState, useCallback } from 'react'

export type Route = 'home' | 'downloads'

function pathToRoute(path: string): Route {
  const clean = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  if (clean === '/downloads') return 'downloads'
  return 'home'
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => pathToRoute(window.location.pathname))

  useEffect(() => {
    const onPop = () => {
      setRoute(pathToRoute(window.location.pathname))
      const hash = window.location.hash.slice(1)
      if (hash) {
        requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((path: string) => {
    const [, hash = ''] = path.split('#')
    window.history.pushState(null, '', path)
    setRoute(pathToRoute(path))

    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else window.scrollTo(0, 0)
      })
    } else {
      window.scrollTo(0, 0)
    }
  }, [])

  return { route, navigate }
}
