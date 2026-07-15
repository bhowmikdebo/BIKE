import { useState } from 'react'
import { Heart, Menu, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Wordmark } from '../../components/ui'
import { useAuth } from '../../features/account/auth'
import { NotificationBell } from '../../features/notifications/NotificationBell'
import { useFavorites } from '../../hooks/favorites'
import { errorMessage } from '../../utils/api'
import { siteLinks } from './site-links'
import { ThemePicker } from './ThemePicker'

export function Navbar() {
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
      <nav className="desktop-nav" aria-label="Main navigation">{siteLinks.map(link =>
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
      {siteLinks.map(link => <Link key={link.to} to={link.to} onClick={() => setMenu(false)}>{link.label}</Link>)}
      <Link to="/host" onClick={() => setMenu(false)}>{hostLabel}</Link>
      {account ? <><Link to={portal} onClick={() => setMenu(false)}>{portalLabel}</Link><button className="text-button" onClick={leave}>Sign Out</button></> :
        <Link to="/sign-in" onClick={() => setMenu(false)}>Sign In</Link>}
      <Link className="button primary" to="/bikes" onClick={() => setMenu(false)}>Rent a Bike</Link>
    </nav>}
    {sessionError && <p className="container field-error" role="alert">{sessionError}</p>}
  </header>
}
