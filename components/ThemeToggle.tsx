'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function current(): Theme {
  const set = document.documentElement.dataset.theme
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => setTheme(current()), [])

  const flip = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('hcw.theme', next)
    } catch {}
    setTheme(next)
  }

  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label="Switch light or dark theme">
      {theme === 'dark' ? 'LIGHT' : theme === 'light' ? 'DARK' : ''}
    </button>
  )
}
