'use client'
import { useEffect, useRef } from 'react'
import { FLAG_FALL, money } from '@/lib/tariff'

// Seven-segment cells a–g on a 60 × 100 grid; which segments light per digit lives in CSS ([data-d]).
const SEG: Record<string, string> = {
  a: '10,8 15,3 45,3 50,8 45,13 15,13', g: '10,50 15,45 45,45 50,50 45,55 15,55', d: '10,92 15,87 45,87 50,92 45,97 15,97',
  f: '8,10 13,15 13,43 8,48 3,43 3,15', b: '52,10 57,15 57,43 52,48 47,43 47,15',
  e: '8,52 13,57 13,85 8,90 3,85 3,57', c: '52,52 57,57 57,85 52,90 47,85 47,57',
}

// 62.56 -> [' ', '6', '2', '5', '6']; no fare -> dashes
export function fareCells(total: number | null) {
  if (total == null) return [' ', '-', '-', '-', '-']
  const [int, dec] = money(total).split('.')
  const i = int.padStart(3, ' ').slice(-3)
  return [i[0], i[1], i[2], dec[0], dec[1]]
}

function Digit({ d }: { d: string }) {
  return (
    <svg className="dg" data-d={d} viewBox="0 0 60 100" aria-hidden="true" focusable="false">
      <g transform="skewX(-7) translate(10 0)">
        {Object.entries(SEG).map(([k, p]) => <polygon key={k} className={k} points={p} />)}
      </g>
    </svg>
  )
}

const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches

type Props = {
  total: number | null
  km: number | null
  min: number | null
  approx: boolean
  minimumApplies: boolean
  busy: boolean
  hired: boolean
  lock: { text: string; warn: boolean } | null
  // Changes whenever the fare should count up again (new route, new car).
  countKey: number
}

export function Meter({ total, km, min, approx, minimumApplies, busy, hired, lock, countKey }: Props) {
  const readRef = useRef<HTMLDivElement>(null)

  // A taximeter starts at the flag fall and counts up. Digits are written straight to the DOM, not re-rendered per frame.
  useEffect(() => {
    const cells = readRef.current ? [...readRef.current.querySelectorAll<SVGElement>('.dg')] : []
    const paint = (v: number | null) => fareCells(v).forEach((c, i) => cells[i]?.setAttribute('data-d', c))
    if (total == null || !motionOK()) return paint(total)
    let frame = 0
    const from = Math.min(FLAG_FALL, total), t0 = performance.now(), dur = 900
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      paint(k < 1 ? Math.floor((from + (total - from) * eased) * 5) / 5 : total)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [total, countKey])

  const cells = fareCells(total)
  return (
    <div className={`meter${busy ? ' is-busy' : ''}`} data-state={hired ? 'hired' : 'hire'}>
      <div className="roof" aria-hidden="true"><span className="roof__for">For hire</span><span className="roof__hired">Hired</span></div>
      <div className="meter__face">
        <p className="meter__label">{approx ? 'Fare, approx.' : 'Fare'}</p>
        <div className="meter__read" ref={readRef} role="img" aria-label={busy ? 'Working out the fare' : total != null ? `Fare $${money(total)}` : 'Fare not set'}>
          <span className="meter__cur" aria-hidden="true">$</span>
          <Digit d={cells[0]} /><Digit d={cells[1]} /><Digit d={cells[2]} />
          <span className="dp" aria-hidden="true" />
          <Digit d={cells[3]} /><Digit d={cells[4]} />
        </div>
        {minimumApplies && !busy && <p className="meter__flag">Minimum fare</p>}
        <dl className={`meter__grid${lock ? ' meter__grid--3' : ''}`}>
          <div><dt>Distance</dt><dd>{km ?? '–'} km</dd></div>
          <div><dt>Time</dt><dd>{min ?? '–'} min</dd></div>
          {lock && <div className={lock.warn ? 'is-warn' : undefined}><dt>Price lock</dt><dd>{lock.text}</dd></div>}
        </dl>
      </div>
    </div>
  )
}
