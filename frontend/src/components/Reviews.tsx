import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Star } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import type { BikeRating, BikeReview, BikeReviewPage, BookingRecord } from '../../../shared/types.ts'
import { useApi } from '../hooks/api'
import { api, errorMessage } from '../utils/api'
import { AsyncState, Dialog } from './ui'

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

export function LeaveReview({ booking, onClose, onPublish }: { booking: BookingRecord; onClose: () => void; onPublish: () => void }) {
  const [rating, setRating] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim()
    setBusy(true)
    setError('')
    try {
      await api(`/api/bookings/${booking.id}/review`, { method: 'POST', body: { rating, body } })
      onPublish()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title="Review your rental" onClose={() => { if (!busy) onClose() }}>
    <form className="contact-form review-form" onSubmit={publish} onChange={() => setError('')}>
      <p>{booking.bikeName} · {booking.id}</p>
      <fieldset className="review-fieldset">
        <legend>Your rating</legend>
        <div className="review-rating-input">{stars.map(star => <label key={star}>
          <input className="sr-only" type="radio" name="rating" value={star} required checked={star === rating}
            onChange={() => setRating(star)} disabled={busy} />
          <span className="sr-only">{star} {star === 1 ? 'star' : 'stars'}</span>
          <span className="review-star-input"><Star size={22} fill={star <= rating ? 'currentColor' : 'none'} aria-hidden="true" /></span>
        </label>)}</div>
      </fieldset>
      <label className="field"><span>Write a review</span><textarea name="body" rows={4} minLength={10} maxLength={600} required disabled={busy} /></label>
      <p className="small-note">Your first name and review will appear on this bike’s listing.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish review'}</button>
    </form>
  </Dialog>
}
