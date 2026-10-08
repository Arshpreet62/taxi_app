'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { POPULAR, type Place } from '@/lib/places'

type Option = { key: string; place?: Place; locate?: true; label: string; area?: string }

type Props = {
  id: string
  label: string
  pin: 'pickup' | 'drop'
  value: Place | null
  onChange: (place: Place | null) => void
  onFocus?: () => void
  onLocate?: () => void
  locating?: boolean
  disabled?: boolean
  invalid?: boolean
}

const popularMatches = (q: string) => {
  const s = q.trim().toLowerCase()
  return POPULAR.filter((p) => !s || `${p.label} ${p.area}`.toLowerCase().includes(s))
}

// An ARIA combobox: popular stops when empty, live address search as you type.
export function AddressCombobox({ id, label, pin, value, onChange, onFocus, onLocate, locating, disabled, invalid }: Props) {
  const [text, setText] = useState(value?.label ?? '')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Option[]>([])
  const [active, setActive] = useState(-1)
  const [searching, setSearching] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const ctl = useRef<AbortController | null>(null)
  const listId = useId()

  // A place chosen elsewhere (map tap, swap, a shared link) shows up in the box.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    if (value) setText(value.label)
  }

  const base = (q: string): Option[] => [
    ...(onLocate && !q.trim() ? [{ key: 'locate', locate: true as const, label: locating ? 'Finding you…' : 'Use my current location' }] : []),
    ...popularMatches(q).map((p) => ({ key: `pop-${p.label}`, place: p, label: p.label, area: p.area })),
  ]

  function search(q: string) {
    ctl.current?.abort()
    const local = base(q)
    setOptions(local)
    setActive(-1)
    if (q.trim().length < 3) return setSearching(false)
    const c = (ctl.current = new AbortController())
    setSearching(true)
    setTimeout(async () => {
      if (c.signal.aborted) return
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q.trim())}`, { signal: c.signal })
        const { places } = (await res.json()) as { places: Place[] }
        const seen = new Set(local.map((o) => o.label))
        setOptions([...local, ...places.filter((p) => !seen.has(p.label)).map((p, i) => ({ key: `s-${i}-${p.lat}`, place: p, label: p.label, area: p.area }))])
      } catch { /* aborted or offline: the popular stops still work */ }
      if (!c.signal.aborted) setSearching(false)
    }, 280)
  }

  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(o: Option) {
    setOpen(false)
    if (o.locate) return onLocate?.()
    if (o.place) {
      setText(o.place.label)
      onChange(o.place)
    }
  }

  const showFull = () => {
    // Focusing a filled box shows every popular stop, not just the one that matches its text.
    search(value && text === value.label ? '' : text)
    setOpen(true)
  }

  return (
    <div className="combo" data-for={pin}>
      <label htmlFor={id}><span className={`pin pin--${pin}`} aria-hidden="true" />{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-busy={searching || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search an address or place"
        disabled={disabled}
        value={text}
        onFocus={() => { onFocus?.(); showFull() }}
        onChange={(e) => {
          setText(e.target.value)
          if (value) onChange(null)
          search(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) showFull()
            const n = options.length
            if (n) setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n))
          } else if (e.key === 'Enter') {
            if (open && options.length) {
              e.preventDefault()
              choose(options[active >= 0 ? active : 0])
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={() => setTimeout(() => {
          setOpen(false)
          // Leaving with a typed address that wasn't picked: put the chosen place back, if there was one.
          if (value && text !== value.label) setText(value.label)
        }, 150)}
      />
      <ul className="combo__list" id={listId} ref={listRef} role="listbox" aria-label={`${label} suggestions`} hidden={!open || options.length === 0}
        onMouseDown={(e) => e.preventDefault()}>
        {options.map((o, i) => (
          <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={o.locate ? 'is-locate' : undefined} onClick={() => choose(o)}>
            <span>{o.locate && <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="5" /><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" /></svg>}{o.label}</span>
            {o.area && <small>{o.area}</small>}
          </li>
        ))}
        {searching && <li className="combo__note" aria-hidden="true">Searching…</li>}
      </ul>
    </div>
  )
}
