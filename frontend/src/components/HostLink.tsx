import { Link } from 'react-router'
import type { HostIdentity } from '../../../shared/types.ts'

export function HostLink({ host }: { host?: HostIdentity | null }) {
  return <span className="host-byline">Hosted by {host ? <Link to={`/hosts/${host.slug}`}>{host.name}</Link> : <strong>RIDEON fleet</strong>}</span>
}
