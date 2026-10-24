import { Play } from 'lucide-react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { SearchBar } from '../components/Search'
import { ImageAsset } from '../components/ui'

function Hero() {
  const reduced = useReducedMotion()
  return <section className="hero" aria-labelledby="home-title">
    <picture className="hero-picture">
      <source media="(max-width: 640px)" srcSet="/images/hero-mobile.webp" />
      <ImageAsset src="/images/hero.webp" alt="" width={1920} height={800} fetchPriority="high" />
    </picture>
    <div className="container hero-inner">
      <motion.div className="hero-copy" initial={reduced ? false : { opacity: .7, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .48 }}>
        <p className="eyebrow hero-eyebrow">Motorcycle & scooter rentals</p>
        <h1 id="home-title">Your Ride.<br /><em>Your Rules.</em></h1>
        <p className="hero-description">Discover the freedom of the open road. Rent premium bikes, explore new places, and ride on your own terms.</p>
        <div className="flex flex-wrap gap-3 hero-actions"><Link to="/bikes" className="button primary">Explore Bikes</Link><Link to="/#how-it-works" className="button light-outline"><Play size={16} />How It Works</Link></div>
      </motion.div>
    </div>
  </section>
}

export function Home() {
  return <>
    <Hero />
    <div className="container home-search"><SearchBar integrated /></div>
  </>
}
