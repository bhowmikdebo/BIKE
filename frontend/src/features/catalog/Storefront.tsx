import { Link, useParams } from 'react-router'
import { BikeGrid } from './BikeCard'
import { AsyncState, EmptyState } from '../../components/ui'
import { useApi } from '../../hooks/api'
import type { HostStorefront } from '../../../../shared/types.ts'

export function Storefront() {
  const { slug } = useParams()
  const storefront = useApi<HostStorefront>(slug ? `/api/hosts/${encodeURIComponent(slug)}` : null)
  if (!storefront.data) return <div className="container route-empty"><AsyncState error={storefront.error} onRetry={storefront.reload} label="Loading host storefront…" /></div>
  const { host, bikes } = storefront.data
  return <>
    <section className="page-banner"><div className="container host-dashboard-heading">
      <div><p className="eyebrow">Host storefront</p><h1>{host.name}</h1>{host.bio && <p>{host.bio}</p>}</div>
      <Link className="button button-outline" to="/bikes">Browse marketplace</Link>
    </div></section>
    <section className="container portal-content" aria-labelledby="storefront-listings">
      <div className="portal-toolbar"><div><h2 id="storefront-listings">Published bikes</h2><p>Open a listing to check its pickup cities and rental dates.</p></div></div>
      {bikes.length ? <BikeGrid bikes={bikes} /> :
        <EmptyState title="This host has no published bikes" description="You can still browse other bikes on RIDEON." action={<Link className="button primary" to="/bikes">Explore bikes</Link>} />}
    </section>
  </>
}
