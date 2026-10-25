import { Play } from 'lucide-react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { BikeGrid } from '../components/BikeCard'
import { SearchBar } from '../components/Search'
import { ImageAsset, Reveal, SectionHeading } from '../components/ui'
import { bikes, categories } from '../data/fleet'
import { searchString } from '../utils/rental'

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

function CategorySection() {
  return <section className="container home-section category-section">
    <SectionHeading kicker="THE FLEET" title="Find your kind of ride." description="Five ways to get out and go." action={<Link className="button button-outline heading-action" to="/bikes">Browse all bikes</Link>} />
    <div className="category-grid grid">{categories.map(category =>
      <Link to={`/bikes${searchString({ category: category.name })}`} key={category.name} className={`category-card cat-${category.tone}`}>
        <ImageAsset src={`/images/category-${category.tone}.webp`} alt="" loading="lazy" width={510} height={510} />
        <div><h3>{category.name}</h3><p>{category.detail}</p></div>
      </Link>)}</div>
  </section>
}

export function Home() {
  return <>
    <Hero />
    <div className="container home-search"><SearchBar integrated /></div>
    <CategorySection />
    <section className="feature-band"><div className="container home-section">
      <SectionHeading kicker="DEMO FLEET" title="Featured bikes" description="Explore illustrative fleet images and daily rates." action={<Link className="button button-outline heading-action" to="/bikes">Explore the fleet</Link>} />
      <Reveal><BikeGrid bikes={bikes.slice(0, 6)} /></Reveal>
    </div></section>
  </>
}
