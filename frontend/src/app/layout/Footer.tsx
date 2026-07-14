import { useState } from 'react'
import { Camera, Mail, MapPin, Video } from 'lucide-react'
import { Link } from 'react-router'
import { categories } from '../../../../shared/fleet.ts'
import { searchString } from '../../../../shared/rental.ts'
import { Dialog, Wordmark } from '../../components/ui'
import { siteLinks } from './site-links'

export function Footer() {
  const [subscribed, setSubscribed] = useState(false)
  const [info, setInfo] = useState('')
  return <footer className="footer">
    <div className="container">
      <div className="footer-grid grid">
        <div className="footer-brand"><Wordmark /><p>Rent a motorcycle or scooter from a local host, or list your own bike.</p><div className="socials">
          <button className="icon-button" aria-label="Instagram information" onClick={() => setInfo('Instagram')}><Camera size={18} /></button>
          <button className="icon-button" aria-label="YouTube information" onClick={() => setInfo('YouTube')}><Video size={18} /></button>
        </div></div>
        <div><h2>RIDEON</h2>{siteLinks.slice(1).map(link => <Link key={link.to} to={link.to}>{link.label}</Link>)}<Link to="/host">List your bike</Link></div>
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
