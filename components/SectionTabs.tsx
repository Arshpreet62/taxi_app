'use client'
import { useEffect, useRef, useState } from 'react'

const TABS = [
  { id: 'book', label: <>Book<span className="t-long">&nbsp;a ride</span></> },
  { id: 'after', label: <>How it works</> },
]

// Section tabs with a sliding marker that follows the section on screen.
export function SectionTabs() {
  const [current, setCurrent] = useState('book')
  const nav = useRef<HTMLElement>(null)
  const ink = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const spy = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).pop()
      if (hit) setCurrent(hit.target.id)
    }, { rootMargin: '-45% 0px -50% 0px' })
    for (const t of TABS) { const el = document.getElementById(t.id); if (el) spy.observe(el) }
    return () => spy.disconnect()
  }, [])

  useEffect(() => {
    const move = () => {
      const a = nav.current?.querySelector<HTMLAnchorElement>(`a[href="#${current}"]`)
      if (!a || !ink.current) return
      ink.current.style.width = a.offsetWidth + 'px'
      ink.current.style.transform = `translateX(${a.offsetLeft}px)`
    }
    move()
    addEventListener('resize', move)
    document.fonts?.ready.then(move)
    return () => removeEventListener('resize', move)
  }, [current])

  return (
    <nav className="tabs" aria-label="Sections" ref={nav}>
      <span className="tabs__ink" aria-hidden="true" ref={ink} />
      {TABS.map((t) => <a key={t.id} href={`#${t.id}`} aria-current={current === t.id ? 'true' : undefined}>{t.label}</a>)}
    </nav>
  )
}
