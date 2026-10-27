import { useState } from 'react'
import { Compass, Mail, MapPin, MessageCircle, Route, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { ImageAsset, SectionHeading } from '../components/ui'

export function About() {
  return <>
    <section className="about-hero"><div className="container about-grid grid">
      <div><p className="eyebrow">About RIDEON</p><h1>The freedom<br />to take the<br />long way.</h1><p>RIDEON is a motorcycle and scooter rental concept for people who want to explore on two wheels, at their own pace.</p><Link className="button primary" to="/bikes">Explore Bikes</Link></div>
      <ImageAsset src="/images/open-road.webp" alt="A motorcycle rider following a winding Himalayan road" width={1600} height={800} fetchPriority="high" />
    </div></section>
    <section className="container home-section"><SectionHeading title="What guides RIDEON" />
      <div className="about-values grid">
        <article><span className="section-icon"><Compass size={24} /></span><h3>Our mission</h3><p>Make a ride easier to plan by bringing bikes, pickup cities and daily estimates into one place.</p></article>
        <article><span className="section-icon"><Wrench size={24} /></span><h3>Our approach</h3><p>Put clear specifications, transparent estimates and thoughtful pickup preparation at the centre of each rental.</p></article>
        <article><span className="section-icon"><Route size={24} /></span><h3>Why riding matters</h3><p>On two wheels, the route becomes part of the trip. There’s room for a quiet road, a wrong turn and a place worth stopping for.</p></article>
      </div>
    </section>
  </>
}

export function Contact() {
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">Contact RIDEON</p><h1>Let’s talk rides.</h1><p>Send a sample question about the fleet, pickup or rental estimates.</p></div></section>
    <div className="container contact-layout grid">
      <section className="contact-info">
        <h2>Get in touch</h2><p>Sample contact details for the RIDEON demo.</p>
        <div><span className="section-icon"><Mail size={21} /></span><span><strong>Email</strong><small>hello@rideon.example</small></span></div>
        <div><span className="section-icon"><MapPin size={21} /></span><span><strong>Location</strong><small>Bengaluru, India · Demo location</small></span></div>
        <div><span className="section-icon"><MessageCircle size={21} /></span><span><strong>Rental questions</strong><Link to="/#how-it-works">See how it works</Link></span></div>
      </section>
      <section className="panel contact-panel" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">Send a demo message</h2>
        <form className="contact-form" onChange={() => { setError(''); setFeedback('') }} onSubmit={event => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          if (['name', 'subject', 'message'].some(field => !String(values.get(field) ?? '').trim())) {
            setError('Enter your name, a subject and a message.')
            return
          }
          setFeedback('Demo message completed. Your message stayed on this page.')
          event.currentTarget.reset()
        }}>
          <div className="form-pair"><label className="field"><span>Name</span><input name="name" required autoComplete="name" maxLength={100} /></label><label className="field"><span>Email</span><input name="email" required type="email" autoComplete="email" /></label></div>
          <label className="field"><span>Subject</span><input name="subject" required maxLength={120} /></label>
          <label className="field"><span>Message</span><textarea name="message" required rows={5} maxLength={2000} /></label>
          {error && <p className="field-error" role="alert">{error}</p>}
          {feedback && <p className="form-success" role="status">{feedback}</p>}
          <button className="button primary" type="submit">Submit Demo Message</button>
        </form>
      </section>
    </div>
  </>
}
