import { useEffect, useState } from 'react'
import { Camera, Heart, Mail, MapPin, Menu, Video, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { categories } from '../../../shared/fleet.ts'
import { useAuth } from '../hooks/auth'
import { useFavorites } from '../hooks/favorites'
import { errorMessage } from '../utils/api'
import { searchString } from '../../../shared/rental.ts'
import { ThemePicker } from './ThemePicker'
import { NotificationBell } from './NotificationBell'
import { Dialog, Wordmark } from './ui'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Explore Bikes', to: '/bikes' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

function Navbar() {
  const [menu, setMenu] = useState(false)
  const { account, signOut } = useAuth()
  const [sessionError, setSessionError] = useState('')
  const navigate = useNavigate()
  const portal = account?.role === 'admin' ? '/admin' : '/my-bookings'
  const portalLabel = account?.role === 'admin' ? 'Admin' : 'My Bookings'
  const hostLabel = account?.host ? 'Host dashboard' : 'List your bike'
  async function leave() {
    try {
      await signOut()
      setMenu(false)
      navigate('/')
    } catch (error) {
      setSessionError(errorMessage(error))
    }
  }
  const { ids } = useFavorites()
  return <header className="site-header">
    <div className="container nav-bar">
      <Wordmark />
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(link =>
        link.to.includes('#') ? <Link key={link.to} to={link.to}>{link.label}</Link> :
        <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}<NavLink to="/host">{hostLabel}</NavLink></nav>
      <div className="nav-actions">
        <Link className="icon-button saved-link" aria-label={`Saved bikes${ids.length ? `, ${ids.length} saved` : ''}`} to="/bikes?saved=1"><Heart size={19} />{ids.length > 0 && <span>{ids.length}</span>}</Link>
        <ThemePicker />
        {account && <NotificationBell key={account.id} />}
        {account ? <><Link className="text-button desktop-signin" to={portal}>{portalLabel}</Link><button className="text-button desktop-signin" onClick={leave}>Sign Out</button></> :
          <Link className="text-button desktop-signin" to="/sign-in">Sign In</Link>}
        <Link className="button primary nav-cta" to="/bikes">Rent a Bike</Link>
        <button className="icon-button menu-toggle" type="button" aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close navigation' : 'Open navigation'} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </div>
    </div>
    {menu && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" onKeyDown={event => { if (event.key === 'Escape') setMenu(false) }}>
      {links.map(link => <Link key={link.to} to={link.to} onClick={() => setMenu(false)}>{link.label}</Link>)}
      <Link to="/host" onClick={() => setMenu(false)}>{hostLabel}</Link>
      {account ? <><Link to={portal} onClick={() => setMenu(false)}>{portalLabel}</Link><button className="text-button" onClick={leave}>Sign Out</button></> :
        <Link to="/sign-in" onClick={() => setMenu(false)}>Sign In</Link>}
      <Link className="button primary" to="/bikes" onClick={() => setMenu(false)}>Rent a Bike</Link>
    </nav>}
    {sessionError && <p className="container field-error" role="alert">{sessionError}</p>}
  </header>
}

function Footer() {
  const [subscribed, setSubscribed] = useState(false)
  const [info, setInfo] = useState('')
  return <footer className="footer">
    <div className="container">
      <div className="footer-grid grid">
        <div className="footer-brand"><Wordmark /><p>Rent a motorcycle or scooter from a local host, or list your own bike.</p><div className="socials">
          <button className="icon-button" aria-label="Instagram information" onClick={() => setInfo('Instagram')}><Camera size={18} /></button>
          <button className="icon-button" aria-label="YouTube information" onClick={() => setInfo('YouTube')}><Video size={18} /></button>
        </div></div>
        <div><h2>RIDEON</h2>{links.slice(1).map(link => <Link key={link.to} to={link.to}>{link.label}</Link>)}<Link to="/host">List your bike</Link></div>
        <div><h2>Explore</h2>{categories.map(category => <Link key={category.name} to={`/bikes${searchString({ category: category.name })}`}>{category.name}</Link>)}</div>
        <div className="footer-news"><h2>Stay in the loop</h2><p>Ride ideas and fleet updates.</p>
          <form onSubmit={event => { event.preventDefault(); setSubscribed(true); event.currentTarget.reset() }}>
            <label className="sr-only" htmlFor="newsletter-email">Newsletter email</label>
            <input type="email" id="newsletter-email" placeholder="Your email address" required />
            <button className="button primary" type="submit">Join</button>
          </form>
          {subscribed && <p className="footer-feedback" role="status">Demo complete. Your email stayed on this page.</p>}
          <p className="footer-contact"><Mail size={15} /> hello@rideon.example</p>
          <p className="footer-contact"><MapPin size={15} /> Bengaluru, India · Demo location</p>
        </div>
      </div>
      <div className="footer-bottom"><p>© {new Date().getFullYear()} RIDEON</p><div>
        <button onClick={() => setInfo('Terms')}>Terms</button><button onClick={() => setInfo('Privacy')}>Privacy</button>
      </div></div>
    </div>
    {info && <Dialog title={info} onClose={() => setInfo('')}><div className="dialog-body"><p className="demo-tag">Frontend demo</p><p>{info === 'Privacy' ? 'Favorites are stored in this browser. Your contact information is shared with your host after they confirm your reservation.' : info === 'Terms' ? 'Submitting a reservation creates a request for pickup. The host or marketplace staff confirms requests in the booking portal.' : `A RIDEON ${info} profile has yet to be published.`}</p></div></Dialog>}
  </footer>
}

function PageNavigation() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const header = document.querySelector('h1')
    document.title = pathname === '/' ? 'RIDEON — Your Ride. Your Rules.' : `${header?.textContent ?? 'Bike rentals'} | RIDEON`
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }))
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  return <><a className="skip-link" href="#main">Skip to content</a><Navbar key={pathname} /><main id="main"><Outlet /></main><Footer /><PageNavigation /></>
}
