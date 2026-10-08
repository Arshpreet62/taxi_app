'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AddressCombobox } from './AddressCombobox'
import { CarArt } from './CarArt'
import { Meter } from './Meter'
import { BUSINESS } from '@/lib/business'
import { bookingIcs } from '@/lib/email/ics'
import { isAirport, placeText, POPULAR, samePlace, type Place } from '@/lib/places'
import { carById, carFor, CARS, fare, MAX_PASSENGERS, money, QUOTE_MINUTES, type CarId } from '@/lib/tariff'
import { deviceInSydney, formatWhen, sydneyNow, sydneyToDate, timeSlots } from '@/lib/time'
import { EMAIL_RE, normalisePhone } from '@/lib/validate'

const TripMap = dynamic(() => import('./TripMap'), { ssr: false, loading: () => <div className="map__canvas"><p className="map__loading">Loading map…</p></div> })

type Estimate = {
  token: string
  km: number
  min: number
  approx: boolean
  fares: Record<CarId, number>
  expiresAt: number
  geometry: [number, number][]
}
type Details = { name: string; phone: string; email: string; flight: string; notes: string }
type Errors = Partial<Record<keyof Details | 'time' | 'car', string>>
type Booked = { reference: string; confirmationSent: boolean; email: string; ics?: string }

const blankDetails: Details = { name: '', phone: '', email: '', flight: '', notes: '' }
const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches
const store = {
  get(kind: 'local' | 'session', key: string) {
    try { return JSON.parse((kind === 'local' ? localStorage : sessionStorage).getItem(key) || 'null') } catch { return null }
  },
  set(kind: 'local' | 'session', key: string, v: unknown) {
    try {
      const s = kind === 'local' ? localStorage : sessionStorage
      if (v == null) s.removeItem(key)
      else s.setItem(key, JSON.stringify(v))
    } catch { /* private mode: nothing to keep */ }
  },
}

// ?from=-33.9399,151.1753,Sydney Airport
const placeParam = (p: Place) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)},${p.label}`
function parsePlace(v: string | null): Place | null {
  const m = v && /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.+)$/.exec(v)
  return m ? { lat: +m[1], lng: +m[2], label: m[3].slice(0, 120) } : null
}

const CallLink = () => <a href={BUSINESS.tel}>Call {BUSINESS.phone}</a>

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

export function BookingConsole() {
  const [pickup, setPickup] = useState<Place | null>(POPULAR[0])
  const [drop, setDrop] = useState<Place | null>(POPULAR[13])
  const [car, setCar] = useState<CarId>('sedan')
  const [passengers, setPassengers] = useState(1)
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [tripError, setTripError] = useState<{ text: string; call?: boolean } | null>(null)
  const [countKey, setCountKey] = useState(0)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [details, setDetails] = useState<Details>(blankDetails)
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<{ text: string; call?: boolean } | null>(null)
  const [sending, setSending] = useState(false)
  const [locking, setLocking] = useState(false)
  const [booked, setBooked] = useState<Booked | null>(null)
  const [now, setNow] = useState(0)
  const [target, setTarget] = useState<'pickup' | 'drop'>('drop')
  const [locating, setLocating] = useState(false)
  const [live, setLive] = useState('')

  const legend2 = useRef<HTMLLegendElement>(null)
  const legend1 = useRef<HTMLLegendElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const honeypot = useRef<HTMLInputElement>(null)
  const estCtl = useRef<AbortController | null>(null)

  const say = (msg: string) => { setLive(''); setTimeout(() => setLive(msg), 30) }

  // ---- Restore: a shared link wins, then this tab's draft; saved passenger details if they opted in ----
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state once after hydration */
    const sp = new URLSearchParams(location.search)
    const draft = store.get('session', 'hr-trip')
    const from = parsePlace(sp.get('from')), to = parsePlace(sp.get('to'))
    if (from || to) {
      setPickup(from)
      setDrop(to)
      const c = sp.get('car')
      if (c && CARS.some((x) => x.id === c)) setCar(c as CarId)
    } else if (draft) {
      setPickup(draft.pickup ?? null)
      setDrop(draft.drop ?? null)
      if (CARS.some((x) => x.id === draft.car)) setCar(draft.car)
      if (draft.passengers) setPassengers(Math.min(MAX_PASSENGERS, Math.max(1, draft.passengers)))
    }
    const saved = store.get('local', 'hr-details')
    if (saved) { setDetails({ ...blankDetails, ...saved, flight: '', notes: '' }); setRemember(true) }
    setHydrated(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Keep the trip in the address bar (shareable) and in this tab (survives a reload).
  useEffect(() => {
    if (!hydrated) return
    store.set('session', 'hr-trip', { pickup, drop, car, passengers })
    const sp = new URLSearchParams()
    if (pickup) sp.set('from', placeParam(pickup))
    if (drop) sp.set('to', placeParam(drop))
    if (car !== 'sedan') sp.set('car', car)
    const qs = sp.toString()
    history.replaceState(null, '', qs ? `?${qs}${location.hash}` : location.pathname + location.hash)
  }, [hydrated, pickup, drop, car, passengers])

  // ---- Estimate: one route, every car's fare, a signed 15-minute quote ----
  const fetchEstimate = useCallback(async (from: Place, to: Place) => {
    estCtl.current?.abort()
    const c = (estCtl.current = new AbortController())
    setEstimating(true)
    setTripError(null)
    try {
      const res = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }), signal: c.signal })
      const json = await res.json()
      if (c.signal.aborted) return null
      if (!res.ok) {
        setEstimate(null)
        setTripError({ text: json.message || 'The fare could not be worked out.', call: json.code === 'outside' || json.code === 'far' })
        return null
      }
      const est: Estimate = { ...json, expiresAt: Date.now() + json.expiresIn }
      setEstimate(est)
      setCountKey((k) => k + 1)
      return est
    } catch {
      if (c.signal.aborted) return null
      setEstimate(null)
      setTripError({ text: `The fare service isn't answering. Try again in a moment, or call ${BUSINESS.phone}.`, call: true })
      return null
    } finally {
      if (!c.signal.aborted) setEstimating(false)
    }
  }, [])

  const tripKey = pickup && drop ? `${pickup.lat},${pickup.lng}|${drop.lat},${drop.lng}|${pickup.label}|${drop.label}` : ''
  useEffect(() => {
    if (!hydrated) return
    /* eslint-disable react-hooks/set-state-in-effect -- the trip changed: drop the old price, then fetch */
    setEstimate(null)
    if (!pickup || !drop) { estCtl.current?.abort(); setEstimating(false); return }
    if (samePlace(pickup, drop)) { setTripError({ text: 'The pickup and drop-off are the same place.' }); return }
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchEstimate(pickup, drop)
    // tripKey stands in for pickup and drop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tripKey, fetchEstimate])

  // ---- Price lock countdown (step 2) ----
  useEffect(() => {
    if (step !== 2) return
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [step])
  const lockLeft = estimate ? Math.max(0, estimate.expiresAt - now) : 0
  const lockExpired = step === 2 && lockLeft <= 0

  // ---- Scheduling (Sydney time) ----
  const today = hydrated ? sydneyNow().date : ''
  const slots = hydrated && when === 'later' && date ? timeSlots(date) : []
  useEffect(() => {
    if (when !== 'later' || date) return
    // Late at night there are no slots left today; start on tomorrow.
    const t = sydneyNow().date
    const next = timeSlots(t).length ? t : sydneyNow(new Date(Date.now() + 86400000)).date
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(next)
  }, [when, date])
  const pickupAt = when === 'later' && date && time ? sydneyToDate(date, time) : null

  // ---- Derived ----
  const chosen = carById(car)
  const total = estimate ? estimate.fares[car] : null
  const minimumApplies = estimate ? fare(car, estimate.km).minimumApplies : false
  const airport = isAirport(pickup)

  function changeCar(id: CarId) {
    setCar(id)
    setCountKey((k) => k + 1)
    setErrors((e) => ({ ...e, car: undefined }))
  }
  function changePassengers(n: number) {
    const v = Math.min(MAX_PASSENGERS, Math.max(1, n))
    setPassengers(v)
    if (carById(car).seats < v) {
      const next = carFor(v)
      changeCar(next.id)
      say(`${v} passengers: switched to the ${next.name.toLowerCase()}.`)
    }
  }

  function setEnd(end: 'pickup' | 'drop', place: Place) {
    if (booked) return
    if (step !== 1) setStep(1)
    if (end === 'pickup') setPickup(place)
    else setDrop(place)
    say(`${end === 'pickup' ? 'Pickup' : 'Drop-off'} set to ${place.label}.`)
  }

  async function placeAt(lat: number, lng: number): Promise<Place | null> {
    const res = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setTripError({ text: json.message || 'That spot could not be used.', call: json.code === 'outside' }); return null }
    return json.place
  }

  // Map taps set whichever end was used last, then the other.
  async function mapPoint(lat: number, lng: number) {
    const end = target
    const place = await placeAt(lat, lng)
    if (!place) return
    setEnd(end, place)
    setTarget(end === 'pickup' ? 'drop' : 'pickup')
  }
  function mapPlace(place: Place) {
    setEnd(target, place)
    setTarget(target === 'pickup' ? 'drop' : 'pickup')
  }
  async function pinMoved(end: 'pickup' | 'drop', lat: number, lng: number) {
    const place = await placeAt(lat, lng)
    if (place) setEnd(end, place)
    else if (end === 'pickup') setPickup((p) => (p ? { ...p } : p))
    else setDrop((p) => (p ? { ...p } : p))
  }

  function locate() {
    if (!navigator.geolocation) return setTripError({ text: 'This browser can’t share its location. Search for the address instead.' })
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await placeAt(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
        if (place) setEnd('pickup', place)
      },
      () => {
        setLocating(false)
        setTripError({ text: 'Couldn’t get your location. Search for the address instead.' })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function swap() {
    setPickup(drop)
    setDrop(pickup)
  }

  // ---- Step 1 -> 2: lock the price ----
  async function toDetails() {
    if (!pickup || !drop) return setTripError({ text: 'Choose a pickup and a drop-off from the list, or tap the map.' })
    if (samePlace(pickup, drop)) return setTripError({ text: 'The pickup and drop-off are the same place.' })
    if (when === 'later' && !pickupAt) return setErrors({ time: 'Choose a pickup time.' })
    let est = estimate
    // The lock runs from the moment of booking, so a price that has been sitting a while is quoted afresh.
    if (!est || est.expiresAt - Date.now() < (QUOTE_MINUTES - 1) * 60000) {
      setLocking(true)
      est = await fetchEstimate(pickup, drop)
      setLocking(false)
      if (!est) return
    }
    setErrors({})
    setFormError(null)
    // Start the countdown's clock now, or the first frame of step 2 counts down from 1970.
    setNow(Date.now())
    setStep(2)
    say(`Price of $${money(est.fares[car])} locked for ${QUOTE_MINUTES} minutes.`)
  }

  async function refreshPrice() {
    if (!pickup || !drop) return
    const before = total
    setLocking(true)
    const est = await fetchEstimate(pickup, drop)
    setLocking(false)
    if (!est) return
    setNow(Date.now())
    setFormError(null)
    const after = est.fares[car]
    say(before != null && after !== before ? `New price $${money(after)}, locked for ${QUOTE_MINUTES} minutes.` : `Price locked again for ${QUOTE_MINUTES} minutes.`)
  }

  useEffect(() => {
    if (step === 2) {
      legend2.current?.focus({ preventScroll: true })
      legend2.current?.closest('fieldset')?.scrollIntoView({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'auto' })
    }
    if (step === 3) doneRef.current?.focus()
  }, [step])

  // ---- Step 2: book ----
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (step !== 2 || sending || !estimate) return
    const errs: Errors = {}
    const phone = normalisePhone(details.phone)
    if (!details.name.trim()) errs.name = 'Add the passenger name.'
    if (!phone) errs.phone = 'Add an Australian number the driver can call, like 0412 345 678.'
    if (!EMAIL_RE.test(details.email.trim())) errs.email = 'Add an email address for the confirmation.'
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      document.getElementById(first)?.focus()
      return setFormError(null)
    }
    if (lockExpired) return setFormError({ text: 'The price lock ran out. Refresh the price to book.' })

    setSending(true)
    setFormError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: estimate.token, car, passengers, when, date: when === 'later' ? date : undefined, time: when === 'later' ? time : undefined,
          name: details.name, phone, email: details.email, flight: airport ? details.flight : undefined, notes: details.notes,
          website: honeypot.current?.value || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.code === 'expired') { setEstimate((x) => (x ? { ...x, expiresAt: 0 } : x)); return setFormError({ text: json.message }) }
        if (json.field && json.field in blankDetails) return setErrors({ [json.field]: json.message })
        if (json.field === 'time' || json.field === 'car') { setStep(1); return setErrors({ [json.field]: json.message }) }
        return setFormError({ text: json.message || `The booking didn’t go through. Call ${BUSINESS.phone}.`, call: true })
      }
      const at = pickupAt
      setBooked({
        reference: json.reference,
        confirmationSent: json.confirmationSent,
        email: details.email.trim(),
        ics: at && pickup && drop ? bookingIcs({ reference: json.reference, start: at, minutes: estimate.min, pickup: placeText(pickup), drop: placeText(drop), car: chosen.name, fare: money(estimate.fares[car]), phone: BUSINESS.phone }) : undefined,
      })
      store.set('local', 'hr-details', remember ? { name: details.name.trim(), phone, email: details.email.trim() } : null)
      store.set('session', 'hr-trip', null)
      setStep(3)
      say(`Booked. Your reference is ${json.reference}.`)
    } catch {
      setFormError({ text: `No connection. Your booking wasn’t sent. Try again, or call ${BUSINESS.phone}.`, call: true })
    } finally {
      setSending(false)
    }
  }

  function again() {
    setBooked(null)
    setStep(1)
    setDetails((d) => (remember ? { ...d, flight: '', notes: '' } : blankDetails))
    setWhen('now')
    setTime('')
    if (pickup && drop) fetchEstimate(pickup, drop)
    setTimeout(() => legend1.current?.focus({ preventScroll: true }))
  }

  function downloadIcs() {
    if (!booked?.ics) return
    const url = URL.createObjectURL(new Blob([booked.ics], { type: 'text/calendar' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `harbour-ride-${booked.reference}.ics` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const field = (k: keyof Details) => ({
    id: k,
    value: details[k],
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${k}-err` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value
      setDetails((d) => ({ ...d, [k]: v }))
      if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
    },
  })
  const fieldError = (k: keyof Errors) => (errors[k] ? <p className="field__err" id={`${k}-err`}>{errors[k]}</p> : null)

  const whenText = when === 'now' ? 'As soon as possible' : pickupAt ? formatWhen(pickupAt) : 'Later, time to choose'
  const busy = estimating || locking
  const lock = step === 2 && estimate ? { text: lockExpired ? 'ran out' : clock(lockLeft), warn: lockLeft < 120000 } : null

  return (
    <section className="console" id="book" aria-labelledby="title">
      <div className="console__head">
        <h1 id="title">See the fare before you&nbsp;ride.</h1>
      </div>

      <div className="sheet">
        <form className="book" onSubmit={submit} noValidate data-step={step}>
          <fieldset className="step" hidden={step !== 1} disabled={step !== 1}>
            <legend className="vh" tabIndex={-1} ref={legend1}>Your trip</legend>
            <div className="trip">
              <AddressCombobox id="pickup" label="From" pin="pickup" value={pickup} onChange={(p) => { setPickup(p); if (p) say(`Pickup set to ${p.label}.`) }}
                onFocus={() => setTarget('pickup')} onLocate={locate} locating={locating} invalid={Boolean(tripError) && !pickup} />
              <AddressCombobox id="drop" label="To" pin="drop" value={drop} onChange={(p) => { setDrop(p); if (p) say(`Drop-off set to ${p.label}.`) }}
                onFocus={() => setTarget('drop')} invalid={Boolean(tripError) && !drop} />
              <button className="swap" type="button" onClick={swap} aria-label="Swap pickup and drop-off">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 3v13M2.5 12.5 6 16l3.5-3.5M14 17V4M10.5 7.5 14 4l3.5 3.5" /></svg>
              </button>
            </div>
            {tripError && <p className="error" role="alert">{tripError.text} {tripError.call && <CallLink />}</p>}

            <div className="pax">
              <span className="pax__label" id="pax-label">Passengers</span>
              <div className="pax__step" role="group" aria-labelledby="pax-label">
                <button type="button" onClick={() => changePassengers(passengers - 1)} disabled={passengers <= 1} aria-label="One fewer passenger">−</button>
                <output aria-live="polite">{passengers}</output>
                <button type="button" onClick={() => changePassengers(passengers + 1)} disabled={passengers >= MAX_PASSENGERS} aria-label="One more passenger">+</button>
              </div>
            </div>

            <div className="cars" role="radiogroup" aria-label="Car">
              {CARS.map((c) => {
                const fits = c.seats >= passengers
                const f = estimate ? estimate.fares[c.id] : null
                return (
                  <label className={`car${fits ? '' : ' is-off'}`} key={c.id}>
                    <input type="radio" name="car" value={c.id} checked={car === c.id} disabled={!fits} onChange={() => changeCar(c.id)}
                      aria-describedby={fits ? undefined : `${c.id}-why`} />
                    <CarArt id={c.id} />
                    <span className="car__name">{c.short}</span>
                    <span className="car__seats" id={`${c.id}-why`}>{fits ? `1–${c.seats} seats` : `Seats ${c.seats}`}</span>
                    <span className="car__fare">{busy ? '…' : f != null ? `$${money(f)}` : '–'}</span>
                  </label>
                )
              })}
            </div>
            {fieldError('car')}

            <div className="when" role="radiogroup" aria-label="Pickup time">
              <label className="when__opt"><input type="radio" name="when" value="now" checked={when === 'now'} onChange={() => setWhen('now')} /><span>Now</span></label>
              <label className="when__opt"><input type="radio" name="when" value="later" checked={when === 'later'} onChange={() => setWhen('later')} /><span>Later</span></label>
            </div>
            {when === 'later' && (
              <div className="later">
                <div className="field">
                  <label htmlFor="date">Date</label>
                  <input id="date" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} />
                </div>
                <div className="field">
                  <label htmlFor="time">Time{!deviceInSydney() && <span className="opt">Sydney time</span>}</label>
                  <select id="time" value={time} onChange={(e) => { setTime(e.target.value); setErrors((x) => ({ ...x, time: undefined })) }}
                    aria-invalid={errors.time ? true : undefined} aria-describedby={errors.time ? 'time-err' : undefined}>
                    <option value="">{slots.length ? 'Choose a time' : 'No times left this day'}</option>
                    {slots.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {fieldError('time')}
                </div>
              </div>
            )}

            <div className="actions">
              <button className="btn btn--go" type="button" onClick={toDetails} disabled={busy || !pickup || !drop}>
                {locking ? 'Locking the price…' : estimating ? 'Working out the fare…' : total != null ? `Book for $${money(total)}` : 'Book this ride'}
              </button>
            </div>
            <p className="fine">Pay the driver at the end, cash or card. Nothing is charged online.</p>
          </fieldset>

          <fieldset className="step" hidden={step !== 2} disabled={step !== 2}>
            <legend tabIndex={-1} ref={legend2}>Who are we picking up?</legend>
            <p className={`locked${lock?.warn ? ' is-warn' : ''}`}>
              {lockExpired
                ? <>The price lock ran out. <button type="button" className="linkbtn" onClick={refreshPrice} disabled={locking}>{locking ? 'Refreshing…' : 'Refresh price'}</button></>
                : <>Price locked at <b>${total != null ? money(total) : ''}</b> for <b>{lock?.text}</b></>}
            </p>
            <p className="summary">{pickup?.label} → {drop?.label} · {chosen.name} · {whenText}</p>
            <div className="who">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input type="text" autoComplete="name" required {...field('name')} />
                {fieldError('name')}
              </div>
              <div className="field">
                <label htmlFor="phone">Mobile</label>
                <input type="tel" autoComplete="tel" inputMode="tel" placeholder="04xx xxx xxx" required {...field('phone')} />
                {fieldError('phone')}
              </div>
              <div className="field field--wide">
                <label htmlFor="email">Email <span className="opt">for your confirmation</span></label>
                <input type="email" autoComplete="email" required {...field('email')} />
                {fieldError('email')}
              </div>
              {airport && (
                <div className="field">
                  <label htmlFor="flight">Flight number <span className="opt">optional</span></label>
                  <input type="text" placeholder="QF 432" autoCapitalize="characters" maxLength={12} {...field('flight')} />
                </div>
              )}
              <div className={`field${airport ? '' : ' field--wide'}`}>
                <label htmlFor="notes">Note for the driver <span className="opt">optional</span></label>
                <textarea rows={2} maxLength={500} placeholder={airport ? 'Terminal, bags' : 'Gate code, child seat'} {...field('notes')} />
              </div>
            </div>
            <div className="hp" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" ref={honeypot} />
            </div>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember my name, number and email on this device</span>
            </label>
            {formError && (
              <p className="error" role="alert">
                {formError.text} {formError.call && <CallLink />}
                {lockExpired && <> <button type="button" className="linkbtn" onClick={refreshPrice} disabled={locking}>Refresh price</button></>}
              </p>
            )}
            <div className="actions">
              <button className="btn btn--back" type="button" onClick={() => { setStep(1); setFormError(null); setTimeout(() => legend1.current?.focus({ preventScroll: true })) }}>Back</button>
              <button className="btn btn--go" type="submit" disabled={sending || locking}>{sending ? 'Sending to dispatch…' : 'Confirm booking'}</button>
            </div>
            <p className="fine">We use these details only to run this ride. <a href="#privacy">Privacy</a></p>
          </fieldset>

          {step === 3 && booked && (
            <div className="done" ref={doneRef} tabIndex={-1}>
              <h2 className="done__title">Booked. Your reference is <span>{booked.reference}</span>.</h2>
              <p>
                {booked.confirmationSent
                  ? <>Confirmation sent to <b>{booked.email}</b>.</>
                  : <>We couldn&apos;t send the confirmation email, but dispatch has your booking. Keep this reference.</>}
                {' '}Pay the driver at the end, cash or card.
              </p>
              <p>To change or cancel, <CallLink />.</p>
              <div className="actions">
                {booked.ics && <button className="btn btn--back" type="button" onClick={downloadIcs}>Add to calendar</button>}
                <button className="btn btn--back" type="button" onClick={again}>Book another ride</button>
              </div>
            </div>
          )}
          <noscript><p className="error">Booking here needs JavaScript. Call {BUSINESS.phone} and we&apos;ll take it by phone.</p></noscript>
        </form>
      </div>

      <div className="stage">
        <div className="rig">
          <Meter total={busy ? null : total} km={busy ? null : estimate?.km ?? null} min={busy ? null : estimate?.min ?? null} approx={Boolean(estimate?.approx)}
            minimumApplies={minimumApplies} busy={busy} hired={step === 3} lock={lock} countKey={countKey} />
          {step === 3 && booked && estimate && (
            <aside className="docket" aria-label="Booking docket">
              <div className="docket__paper">
                <p className="docket__head">Harbour Ride<br />Booking docket</p>
                <dl>
                  <div><dt>Ref</dt><dd className="docket__ref">{booked.reference}</dd></div>
                  <div><dt>Pickup</dt><dd>{pickup && placeText(pickup)}</dd></div>
                  <div><dt>Drop-off</dt><dd>{drop && placeText(drop)}</dd></div>
                  <div><dt>When</dt><dd>{whenText}</dd></div>
                  <div><dt>Car</dt><dd>{chosen.name}, {passengers} pax</dd></div>
                  <div><dt>Estimate</dt><dd>${money(estimate.fares[car])} ({estimate.km} km, {estimate.min} min)</dd></div>
                  {airport && details.flight && <div><dt>Flight</dt><dd>{details.flight.toUpperCase()}</dd></div>}
                  <div><dt>Passenger</dt><dd>{details.name}</dd></div>
                  <div><dt>Phone</dt><dd>{normalisePhone(details.phone)}</dd></div>
                  <div><dt>Notes</dt><dd>{details.notes || 'None'}</dd></div>
                </dl>
                <p className="docket__foot">Pay the driver at the end, cash or card.</p>
                <svg className="docket__stamp" viewBox="0 0 200 80" aria-hidden="true" focusable="false"><rect x="4" y="4" width="192" height="72" rx="8" /><text x="100" y="54" textAnchor="middle">Booked</text></svg>
              </div>
            </aside>
          )}
        </div>
        <figure className="map">
          <TripMap pickup={pickup} drop={drop} geometry={estimate?.geometry ?? null} approx={Boolean(estimate?.approx)} drawKey={countKey}
            locked={step === 3} onPoint={mapPoint} onPlace={mapPlace} onMove={pinMoved} />
          <figcaption className="map__cap">
            <span>{estimate && pickup && drop ? `${pickup.label} to ${drop.label}, ${estimate.approx ? 'about ' : ''}${estimate.km} km by road.` : busy ? 'Finding the road route…' : 'Choose a pickup and a drop-off.'}</span>
            {step !== 3 && <span className="map__hint">Tap the map to set the {target === 'pickup' ? 'pickup' : 'drop-off'}.</span>}
          </figcaption>
        </figure>
      </div>
      <p className="vh" aria-live="polite">{live}</p>
    </section>
  )
}
