import { ChevronDown, Play, Quote } from 'lucide-react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { BikeGrid } from '../components/BikeCard'
import { SearchBar } from '../components/Search'
import { ImageAsset, Reveal, SectionHeading } from '../components/ui'
import { benefits, faqs, reviews, steps } from '../data/content'
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
    <section className="container home-section benefits-section">
      <SectionHeading title="Why choose RIDEON?" />
      <div className="benefits-grid grid">{benefits.map(({ icon: Icon, title, detail }) => <div key={title}><span className="section-icon"><Icon size={23} /></span><h3>{title}</h3><p>{detail}</p></div>)}</div>
    </section>
    <section className="steps-band" id="how-it-works"><div className="container home-section">
      <SectionHeading kicker="THE RENTAL EXPERIENCE" title="How it works" />
      <Reveal className="steps-grid grid">{steps.map(({ icon: Icon, title, detail }, index) => <article key={title}><div className="step-top"><span className="section-icon"><Icon size={25} /></span><span>Step {index + 1}</span></div><h3>{title}</h3><p>{detail}</p></article>)}</Reveal>
    </div></section>
    <section className="road-banner">
      <ImageAsset src="/images/open-road.webp" width={1600} height={800} alt="" loading="lazy" />
      <div className="container"><h2>Every Great Journey<br className="hidden sm:block" /> Starts With a Ride.</h2><Link to="/bikes" className="button primary">Explore Bikes</Link></div>
    </section>
    <section className="container home-section reviews-section">
      <SectionHeading kicker="DEMO REVIEWS" title="A few rides imagined" description="Illustrative reviews from fictional riders." />
      <div className="reviews-grid grid">{reviews.map(review => <figure key={review.name}>
        <Quote className="quote-icon" size={27} /><blockquote>“{review.quote}”</blockquote>
        <figcaption><span className="review-avatar" aria-hidden="true">{review.name.slice(0, 1)}</span><span><strong>{review.name}</strong><small>{review.location}</small></span></figcaption>
      </figure>)}</div>
    </section>
    <section className="faq-band"><div className="container home-section faq-layout grid">
      <div><SectionHeading kicker="BEFORE YOU RIDE" title="Good to know." description="Illustrative rental policies for this frontend demo." /><Link className="faq-contact" to="/contact">Contact us</Link></div>
      <div className="faq-list">{faqs.map(faq => <details className="faq-item" key={faq.question} name="rental-faq">
        <summary>{faq.question}<ChevronDown size={20} /></summary><p>{faq.answer}</p>
      </details>)}</div>
    </div></section>
  </>
}
