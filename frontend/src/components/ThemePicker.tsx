import { useState } from 'react'
import { Check, Moon } from 'lucide-react'
import { saveTheme, themes } from '../utils/theme'
import { Dialog } from './ui'

export function ThemePicker() {
  const [open, setOpen] = useState(false)
  const current = document.documentElement.dataset.theme

  return <>
    <button className="icon-button theme-toggle" type="button" aria-label="Choose theme" title="Choose theme"
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Moon size={19} aria-hidden="true" />
    </button>
    {open && <Dialog title="Choose a theme" className="theme-dialog" onClose={() => setOpen(false)}>
      <div className="theme-options" role="group" aria-label="Site themes">
        {themes.map(theme => <button key={theme.id} className="theme-option" type="button" aria-pressed={current === theme.id}
          onClick={() => { saveTheme(theme.id); setOpen(false) }}>
          <span className="theme-swatch" data-theme={theme.id} aria-hidden="true"><span /><span /></span>
          <span className="theme-option-label"><strong>{theme.name}</strong><small>{theme.colors}</small></span>
          {current === theme.id && <Check className="theme-option-check" size={17} aria-hidden="true" />}
        </button>)}
      </div>
    </Dialog>}
  </>
}
