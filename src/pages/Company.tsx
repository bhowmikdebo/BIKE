import { Compass, Route, Wrench } from 'lucide-react'
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
