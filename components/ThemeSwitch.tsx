'use client'
import { useEffect, useState } from 'react'

// Day / night shift. The choice is kept per browser; until then the system setting decides.
const isDark = () => {
  const t = document.documentElement.dataset.theme
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeSwitch() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const sync = () => {
      setDark(isDark())
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#10202a' : '#f3f6f6')
    }
    sync()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  function toggle() {
    const next = isDark() ? 'light' : 'dark'
    const apply = () => {
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('hr-theme', next) } catch { /* private mode */ }
      setDark(next === 'dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#10202a' : '#f3f6f6')
    }
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply)
    else apply()
  }

  return (
    <button className="daynight" type="button" role="switch" aria-checked={dark} aria-label="Night shift" onClick={toggle}>
      <span className="daynight__opt daynight__opt--day" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false"><circle cx="10" cy="10" r="3.6" /><path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M4.3 15.7l1.6-1.6M14.1 5.9l1.6-1.6" /></svg><span>Day</span>
      </span>
      <span className="daynight__opt daynight__opt--night" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" /></svg><span>Night</span>
      </span>
    </button>
  )
}
