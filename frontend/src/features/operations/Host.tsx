import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bike, CalendarRange, ClipboardList, Settings2, Store } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AsyncState, ImageAsset } from '../../components/ui'
import { useAuth } from '../account/auth'
import type { HostProfile } from '../../../../shared/types.ts'
import { errorMessage } from '../../utils/api'
import { BookingManager } from './BookingManager'
import { FleetManager } from './FleetManager'

const hostingSteps = [
  { icon: Bike, title: 'Create your listing', text: 'Add photos, a daily rate, and the cities where riders can pick up your bike.' },
  { icon: CalendarRange, title: 'Set your availability', text: 'Block time for your own rides or maintenance and offer the remaining dates.' },
  { icon: ClipboardList, title: 'Manage each rental', text: 'Review requests and record pickup and return from your host dashboard.' },
]

function HostWelcome() {
  return <>
    <section className="host-hero">
      <div className="container host-hero-content">
        <div className="host-hero-copy">
          <p className="eyebrow">For bike owners</p>
          <h1>List your bike.<br />Host your way.</h1>
          <p>Rent out your motorcycle or scooter on the days you choose. Manage your listing, calendar, and rider requests from one place.</p>
          <div className="portal-actions">
            <Link className="button primary" to="/register?next=%2Fhost">Create a host account</Link>
            <Link className="button button-outline" to="/sign-in?next=%2Fhost">Sign in</Link>
          </div>
        </div>
        <ImageAsset src="/images/open-road.webp" alt="A rider on a winding mountain road" width={1600} height={800} />
      </div>
    </section>
    <section className="container portal-content host-steps" aria-labelledby="host-how">
      <h2 id="host-how">How hosting works</h2>
      <div className="host-step-grid">{hostingSteps.map(({ icon: Icon, title, text }) => <article key={title}>
        <Icon size={23} aria-hidden="true" />
        <h3>{title}</h3><p>{text}</p>
      </article>)}</div>
    </section>
  </>
}

function HostProfileForm({ profile }: { profile?: HostProfile }) {
  const { saveHostProfile } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await saveHostProfile(String(form.get('name')), String(form.get('bio') ?? ''))
      if (profile) setSaved(true)
      else navigate('/host?tab=listings', { replace: true })
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel host-profile-panel" aria-labelledby="host-profile-title">
    <h2 id="host-profile-title">{profile ? 'Public profile' : 'Create your host profile'}</h2>
    <p>Riders can see this name and introduction on your storefront. Your account email stays private.</p>
    <form className="contact-form" onSubmit={submit}>
      <label className="field"><span>Public host name</span><input name="name" required maxLength={80} defaultValue={profile?.name} placeholder="Your name or rental business" /></label>
      <label className="field"><span>Introduction</span><textarea name="bio" rows={4} maxLength={400} defaultValue={profile?.bio} placeholder="Tell riders a little about your bikes or rental business." /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      {saved && <p className="form-success" role="status">Public profile updated.</p>}
      <button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : profile ? 'Save profile' : 'Start hosting'}</button>
    </form>
  </section>
}

export function Host() {
  const { account, error, retry } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab')
  const activeTab = tab === 'requests' || tab === 'profile' ? tab : 'listings'
  if (account === undefined) return <div className="container route-empty"><AsyncState error={error} onRetry={retry} label="Loading your host workspace…" /></div>
  if (!account) return <HostWelcome />

  if (!account.host) return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">Host onboarding</p><h1>Start hosting</h1><p>Set up your storefront and publish your first bike using this account.</p></div></section>
    <div className="container portal-content"><HostProfileForm /></div>
  </>

  return <>
    <section className="page-banner"><div className="container host-dashboard-heading">
      <div><p className="eyebrow">Host dashboard</p><h1>{account.host.name}</h1><p>Manage the bikes and reservations on your storefront.</p></div>
      <Link className="button button-outline" to={`/hosts/${account.host.slug}`}><Store size={17} />View storefront</Link>
    </div></section>
    <div className="container portal-content">
      <nav aria-label="Host dashboard sections" className="portal-tabs">
        <button type="button" aria-pressed={activeTab === 'listings'} onClick={() => setParams({ tab: 'listings' })}><Bike size={18} />Listings</button>
        <button type="button" aria-pressed={activeTab === 'requests'} onClick={() => setParams({ tab: 'requests' })}><ClipboardList size={18} />Requests</button>
        <button type="button" aria-pressed={activeTab === 'profile'} onClick={() => setParams({ tab: 'profile' })}><Settings2 size={18} />Profile</button>
      </nav>
      {activeTab === 'requests' ? <BookingManager scope="host" /> : activeTab === 'profile' ?
        <HostProfileForm profile={account.host} /> : <FleetManager scope="host" />}
    </div>
  </>
}
