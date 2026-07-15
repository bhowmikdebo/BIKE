import { Component, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AsyncState } from '../../components/ui'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <div className="container route-empty">
      <h1>Couldn’t load this page</h1>
      <AsyncState error="Reload the page to try again." onRetry={() => window.location.reload()} />
    </div>
  }
}

function PageNavigation() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    let scrolled = !hash
    if (scrolled) window.scrollTo(0, 0)

    function syncPage() {
      const title = main?.querySelector('h1')?.textContent ?? 'Bike rentals'
      const pageTitle = pathname === '/' ? 'RIDEON — Your Ride. Your Rules.' : `${title} | RIDEON`
      if (document.title !== pageTitle) document.title = pageTitle
      if (!scrolled) {
        const target = document.getElementById(hash.slice(1))
        if (target) {
          target.scrollIntoView({ block: 'start' })
          scrolled = true
        }
      }
    }

    syncPage()
    const observer = new MutationObserver(syncPage)
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname, hash])

  return null
}

export function Layout() {
  const { pathname } = useLocation()
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Navbar key={pathname} />
    <main id="main">
      <PageErrorBoundary key={pathname}>
        <Suspense fallback={<div className="container route-empty"><p className="async-state" role="status">Loading page…</p></div>}>
          <Outlet />
        </Suspense>
      </PageErrorBoundary>
    </main>
    <Footer />
    <PageNavigation />
  </>
}
