import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import type { BikeRating, BikeReview, BikeReviewPage } from '../../../../shared/types.ts'
import { useApi } from '../../hooks/api'
import { AsyncState } from '../../components/ui'

const stars = [1, 2, 3, 4, 5]
const reviewDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })

export function RatingSummary({ rating }: { rating?: BikeRating }) {
  if (!rating?.count || rating.average === null) return <span className="rating-summary">No reviews yet</span>
  return <span className="rating-summary"><Star className="review-star" size={15} fill="currentColor" aria-hidden="true" />
    <span><strong>{rating.average.toFixed(1)}</strong><span className="sr-only"> out of 5 stars</span> · {rating.count} {rating.count === 1 ? 'review' : 'reviews'}</span>
  </span>
}

export function ReviewCards({ reviews, showBike = false }: { reviews: BikeReview[]; showBike?: boolean }) {
  return <div className={`review-cards${showBike ? ' reviews-grid grid' : ''}`}>{reviews.map(review => <figure key={review.id}>
    <span className="review-stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
      {stars.map(star => <Star key={star} size={16} fill={star <= review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}
    </span>
    <blockquote>{review.body}</blockquote>
    <figcaption>
      <span><strong>{review.author}</strong><time dateTime={review.createdAt}>{reviewDate.format(new Date(review.createdAt))}</time></span>
      {showBike && <Link to={`/bikes/${review.bikeId}#bike-reviews`}>{review.bikeName}</Link>}
    </figcaption>
  </figure>)}</div>
}

export function BikeReviews({ bikeId }: { bikeId: string }) {
  const [page, setPage] = useState(1)
  const { hash, key } = useLocation()
  const section = useRef<HTMLElement>(null)
  const reviews = useApi<BikeReviewPage>(`/api/bikes/${bikeId}/reviews?page=${page}`)
  useEffect(() => {
    if (hash === '#bike-reviews') section.current?.scrollIntoView({ block: 'start' })
  }, [hash, key])
  return <section id="bike-reviews" ref={section} className="bike-reviews" aria-labelledby="bike-reviews-title">
    <h2 id="bike-reviews-title">Verified rental reviews</h2>
    {!reviews.data ? <AsyncState label="Loading reviews…" error={reviews.error} onRetry={reviews.reload} /> :
      reviews.data.items.length ? <ReviewCards reviews={reviews.data.items} /> : <p>No reviews for this bike yet.</p>}
    {(page > 1 || reviews.data?.hasMore) && <nav className="review-pagination" aria-label="Review pages">
      <button className="button button-outline" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page}</span>
      <button className="button button-outline" type="button" disabled={!reviews.data?.hasMore} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </section>
}
