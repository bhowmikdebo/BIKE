import { useState } from 'react'
import type { FormEvent } from 'react'
import { Star } from 'lucide-react'
import type { BookingRecord } from '../../../../shared/types.ts'
import { Dialog } from '../../components/ui'
import { api, errorMessage } from '../../utils/api'

const stars = [1, 2, 3, 4, 5]

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
