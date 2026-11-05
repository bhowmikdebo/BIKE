const storageKey = 'rideon-theme'

export const themes = [
  { id: 'light', name: 'Daylight', colors: 'Warm white · Orange' },
  { id: 'asphalt', name: 'Midnight Asphalt', colors: 'Charcoal · Ember' },
  { id: 'coast', name: 'Coastal Night', colors: 'Navy · Sky blue' },
  { id: 'forest', name: 'Forest Run', colors: 'Pine · Sage' },
  { id: 'desert', name: 'Desert Dusk', colors: 'Umber · Amber' },
  { id: 'circuit', name: 'Neon Circuit', colors: 'Aubergine · Lavender' },
] as const

type Theme = (typeof themes)[number]['id']

export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey)
    return themes.find(theme => theme.id === value)?.id ?? 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  const color = getComputedStyle(root).getPropertyValue('--paper').trim()
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  try { localStorage.setItem(storageKey, theme) } catch { /* The theme still applies for this visit. */ }
}
