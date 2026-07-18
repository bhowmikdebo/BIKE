import { useId, useLayoutEffect, useRef } from 'react'
import type { ImgHTMLAttributes, ReactNode } from 'react'
import { Bike, X } from 'lucide-react'
import { Link } from 'react-router'

export function Wordmark() {
  return <Link className="wordmark" to="/" aria-label="RIDEON home"><span className="wordmark-icon"><Bike size={22} strokeWidth={2.15} /></span><span>RIDE<span className="wordmark-accent">ON</span></span></Link>
}

export function SectionHeading({ kicker, title, description, action }: { kicker?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading">
    <div>{kicker && <p className="eyebrow">{kicker}</p>}<h2>{title}</h2>{description && <p className="section-description">{description}</p>}</div>
    {action}
  </div>
}

export function ImageAsset({ onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} onError={event => {
    onError?.(event)
    if (!event.currentTarget.src.endsWith('/fleet-fallback.webp')) {
      event.currentTarget.removeAttribute('srcset')
      event.currentTarget.closest('picture')?.querySelectorAll('source').forEach(source => source.remove())
      event.currentTarget.src = '/images/fleet-fallback.webp'
      if (props.alt) event.currentTarget.alt = 'Illustrative motorcycle image'
    }
  }} />
}

export function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return <dialog ref={ref} className={`dialog ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-content">
      <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </dialog>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <div className="empty-state"><Bike size={32} /><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function AsyncState({ error, onRetry, label = 'Loading…' }: { error?: string; onRetry: () => void; label?: string }) {
  if (error) return <div className="async-state"><p className="field-error" role="alert">{error}</p><button className="button button-outline" type="button" onClick={onRetry}>Try again</button></div>
  return <div className="async-state" role="status">{label}</div>
}
