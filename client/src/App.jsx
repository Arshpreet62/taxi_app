import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-day-picker/style.css'

const DayPicker = lazy(() => import('react-day-picker').then((module) => ({ default: module.DayPicker })))

const vehicleOptions = [
  { id: 'sedan', name: 'Sedan', detail: '1-4 passengers', image: '/vehicles/sedan.jpg' },
  { id: 'maxi', name: 'Maxi cab', detail: '1-11 passengers', image: '/vehicles/maxi.jpg' },
  { id: 'station-wagon', name: 'Station wagon', detail: '1-5 passengers', image: '/vehicles/station-wagon.jpg' },
]

const initialForm = {
  pickup: '', destination: '', tripType: 'now', pickupTime: '', pickupDate: '', pickupDateDisplay: '', pickupHour: '', pickupMinute: '', passengerName: '', phone: '', email: '', notes: '',
}

function getLocalDateMinimum() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function getLocalTimeMinimum() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function getScheduleDateTime(form) {
  if (!form.pickupDate || form.pickupHour === '' || !form.pickupMinute) return ''
  return `${form.pickupDate}T${form.pickupHour}:${form.pickupMinute}`
}

function isoToDate(value) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatAustralianDate(date) {
  if (!date) return ''
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function getTimeOptions() {
  return Array.from({ length: 96 }, (_, index) => {
    const totalMinutes = index * 15
    const hour = Math.floor(totalMinutes / 60)
    const minute = totalMinutes % 60
    const displayHour = String(hour).padStart(2, '0')
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    return { value, hour: displayHour, minute: String(minute).padStart(2, '0'), label: value }
  })
}

function MapViewport({ locations }) {
  const map = useMap()

  useEffect(() => {
    const points = Object.values(locations).filter(Boolean).map((location) => [location.lat, location.lng])
    if (points.length === 1) map.setView(points[0], 13)
    if (points.length > 1) map.fitBounds(points, { padding: [45, 45] })
  }, [locations, map])

  return null
}

function AddressField({ name, value, placeholder, suggestions, onChange, onSelect, accent }) {
  return (
    <div className="address-field">
      <label>
        <span className={`field-icon ${accent}-icon`} />
        <span className="sr-only">{placeholder}</span>
        <input name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete="off" />
      </label>
      {suggestions.length > 0 && (
        <div className="suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button type="button" key={`${suggestion.lat}-${suggestion.lon}`} onClick={() => onSelect(name, suggestion)}>
              <strong>{suggestion.name || suggestion.display_name.split(',')[0]}</strong>
              <span>{suggestion.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PickerSelect({ label, value, placeholder, options, onChange, disabled = false }) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger className="picker-trigger" aria-label={label}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown size={15} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="picker-content" position="popper" sideOffset={5}>
          <Select.Viewport className="picker-viewport">
            {options.map((option) => <Select.Item className="picker-item" key={option.value} value={option.value}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className="picker-indicator"><Check size={14} /></Select.ItemIndicator></Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const selectedDate = isoToDate(value)
  const today = isoToDate(getLocalDateMinimum())

  function selectDate(date) {
    if (!date) return
    const isoValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onChange(isoValue, formatAustralianDate(date))
    setOpen(false)
  }

  return (
    <div className="date-picker">
      <button className="date-picker-trigger" type="button" aria-label="Choose pickup date" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={17} aria-hidden="true" />
        <span>{selectedDate ? formatAustralianDate(selectedDate) : 'Choose date'}</span>
      </button>
      {open && <div className="date-picker-popover"><Suspense fallback={<div className="calendar-loading">Loading calendar...</div>}><DayPicker mode="single" selected={selectedDate} defaultMonth={selectedDate || today} disabled={{ before: today }} onSelect={selectDate} /></Suspense></div>}
    </div>
  )
}

function Home({ onBook }) {
  return (
    <main className="home-page">
      <header className="topbar home-topbar">
        <a className="brand" href="/" aria-label="Harbour Ride home"><span className="brand-mark">HR</span><span>Harbour Ride</span></a>
        <nav className="home-nav" aria-label="Main navigation">
          <button type="button" onClick={onBook}>Enter trip details <ArrowRight size={15} aria-hidden="true" /></button>
        </nav>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">Sydney and surrounds</p>
          <h1>Getting there<br /><em>made simple.</em></h1>
          <p className="hero-lead">Friendly, reliable rides for airport transfers, appointments, city days and everything in between.</p>
          <div className="hero-actions"><button className="hero-button" type="button" onClick={onBook}>Enter pickup and destination <ArrowRight size={18} aria-hidden="true" /></button><a className="phone-link" href="tel:+61200000000">Prefer to call? 02 0000 0000</a></div>
          <p className="hero-note"><span className="status-dot" /> Clear estimate first. Pay your driver at the end.</p>
        </div>
        <div className="hero-scene" aria-label="Sydney ride service preview"><div className="scene-sun" /><div className="scene-water" /><div className="scene-bridge" /><div className="scene-road" /><div className="scene-car"><span>HR</span></div><span className="scene-label">Sydney / NSW</span></div>
      </section>

      <section className="home-proof">
        <div><strong>Clear estimates</strong><span>Know your fare before you book.</span></div>
        <div><strong>Easy payment</strong><span>Pay your driver at the end of the ride.</span></div>
        <div><strong>Local service</strong><span>Built for Sydney and nearby trips.</span></div>
      </section>

      <footer className="footer"><span>Harbour Ride / Sydney</span><span>Simple journeys. Thoughtfully handled.</span></footer>
    </main>
  )
}

function ScheduleFields({ form, setForm }) {
  const timeOptions = getTimeOptions()
  const availableTimeOptions = form.pickupDate === getLocalDateMinimum()
    ? timeOptions.filter((time) => time.value > getLocalTimeMinimum())
    : timeOptions
  const updateDate = (isoValue, displayValue) => {
    setForm((current) => ({ ...current, pickupDateDisplay: displayValue, pickupDate: isoValue, pickupHour: '', pickupMinute: '' }))
  }
  const hours = [...new Set(availableTimeOptions.map((time) => String(time.hour)))]
  const selectedHourOptions = availableTimeOptions.filter((time) => time.hour === form.pickupHour)
  const minutes = [...new Set(selectedHourOptions.map((time) => time.minute))]
  const updateTime = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === 'pickupHour' ? { pickupMinute: '' } : {}) }))
  return (
    <div className="schedule-field">
      <span className="schedule-label">Pickup date and time</span>
      <div className="schedule-grid">
        <DatePicker value={form.pickupDate} onChange={updateDate} />
        <PickerSelect label="Pickup hour" value={form.pickupHour} placeholder="Hour" options={hours.map((hour) => ({ value: hour, label: hour }))} onChange={(value) => updateTime('pickupHour')({ target: { value } })} />
        <PickerSelect label="Pickup minute" value={form.pickupMinute} placeholder="Minute" options={minutes.map((minute) => ({ value: minute, label: minute }))} onChange={(value) => updateTime('pickupMinute')({ target: { value } })} disabled={form.pickupHour === ''} />
      </div>
      <span className="schedule-hint">Choose a date and time. Dates appear as day / month / year.</span>
    </div>
  )
}

function StepActions({ onBack, onNext, nextLabel, submit = false }) {
  return (
    <div className="step-actions">
      {onBack && <button className="back-button" type="button" onClick={onBack}>Back</button>}
      <button className="next-button" type={submit ? 'submit' : 'button'} onClick={submit ? undefined : onNext}>{nextLabel}<ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" /></button>
    </div>
  )
}

function App() {
  const [showBooking, setShowBooking] = useState(() => window.location.pathname === '/booking')
  const [form, setForm] = useState(initialForm)
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleOptions[0].id)
  const [estimate, setEstimate] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [suggestions, setSuggestions] = useState({ pickup: [], destination: [] })
  const [locations, setLocations] = useState({ pickup: null, destination: null })
  const pickupQuery = form.pickup
  const destinationQuery = form.destination

  useEffect(() => {
    const handleHistoryChange = () => setShowBooking(window.location.pathname === '/booking')
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (!estimate?.expiresAt) return undefined
    const remainingMs = new Date(estimate.expiresAt).getTime() - Date.now()
    const expiryTimer = setTimeout(() => setEstimate(null), Math.max(0, remainingMs))
    return () => clearTimeout(expiryTimer)
  }, [estimate])

  useEffect(() => {
    const fields = ['pickup', 'destination']
    const timers = fields.map((field) => {
      const query = field === 'pickup' ? pickupQuery : destinationQuery
      if (query.trim().length < 3 || locations[field]?.label === query) return null
      return setTimeout(async () => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=au&viewbox=150.5,-33.4,151.6,-34.2&bounded=0&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } })
          if (!response.ok) return
          const results = await response.json()
          setSuggestions((current) => ({ ...current, [field]: results }))
        } catch {
          setSuggestions((current) => ({ ...current, [field]: [] }))
        }
      }, 650)
    })
    return () => timers.forEach((timer) => timer && clearTimeout(timer))
  }, [pickupQuery, destinationQuery, locations])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === 'pickup' || name === 'destination') {
      setEstimate(null)
      setLocations((current) => ({ ...current, [name]: null }))
    }
    setError('')
    setSubmitted(false)
  }

  function selectAddress(name, suggestion) {
    const location = { label: suggestion.display_name, lat: Number(suggestion.lat), lng: Number(suggestion.lon) }
    setForm((current) => ({ ...current, [name]: suggestion.display_name }))
    setLocations((current) => ({ ...current, [name]: location }))
    setSuggestions((current) => ({ ...current, [name]: [] }))
    setEstimate(null)
  }

  async function calculateEstimate(event) {
    event.preventDefault()
    if (estimate) return
    if (!locations.pickup || !locations.destination) {
      setError('Choose a pickup and destination from the address suggestions first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: form.pickup, destination: form.destination, pickupLocation: locations.pickup, destinationLocation: locations.destination, vehicleId: selectedVehicle }),
      })
      if (!response.ok) throw new Error('The route could not be estimated.')
      setEstimate(await response.json())
    } catch {
      setError('The estimate service is unavailable. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  async function submitBooking(event) {
    event.preventDefault()
    if (!estimate) {
      setError('Calculate your fare before booking.')
      return
    }
    const pickupTime = form.tripType === 'later' ? getScheduleDateTime(form) : ''
    if (form.tripType === 'later' && !pickupTime) {
      setError('Choose a pickup date and time before booking.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pickupTime, vehicleId: selectedVehicle, quoteId: estimate.quoteId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Booking could not be created.')
      setSubmitted(result)
    } catch (bookingError) {
      setError(bookingError.message)
    } finally {
      setLoading(false)
    }
  }

  function changeVehicle(vehicleId) {
    setSelectedVehicle(vehicleId)
    setEstimate(null)
    setSubmitted(false)
  }

  function goToStep(step) {
    if (step < currentStep) {
      setError('')
      setCurrentStep(step)
    }
  }

  function continueToRideType() {
    if (!locations.pickup || !locations.destination) {
      setError('Choose a pickup and destination from the address suggestions first.')
      return
    }
    if (form.tripType === 'later' && !getScheduleDateTime(form)) {
      setError('Choose a pickup date and time before continuing.')
      return
    }
    setError('')
    setCurrentStep(2)
  }

  function continueToDetails() {
    if (!estimate) {
      setError('Calculate your fare before continuing.')
      return
    }
    setError('')
    setCurrentStep(3)
  }

  if (!showBooking) return <Home onBook={() => { window.history.pushState({}, '', '/booking'); setShowBooking(true) }} />

  if (submitted) {
    return (
      <main className="success-shell">
        <div className="success-mark">OK</div>
        <p className="eyebrow">Booking request received</p>
        <h1>Your ride is on its way.</h1>
        <p className="success-copy">We have sent the trip details to the booking team. You can pay your driver by cash or card at the end of the ride. Keep this reference for your records.</p>
        <div className="reference-box"><span>Booking reference</span><strong>{submitted.reference}</strong></div>
        <button className="text-button" type="button" onClick={() => setSubmitted(false)}>Make another booking</button>
      </main>
    )
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Harbour Ride home"><span className="brand-mark">HR</span><span>Harbour Ride</span></a>
        <div className="topbar-contact"><span>Need a hand?</span><a href="tel:+61200000000">02 0000 0000</a></div>
      </header>

      <section className="intro">
        <div><p className="eyebrow">Sydney and surrounds</p><h1>Make your next trip feel easy.</h1><p className="intro-copy">Reliable rides for airport runs, city days, and everything in between. Get a clear estimate before you book.</p></div>
        <div className="intro-note"><span className="status-dot" /><span>Booking service open<br /><b>Available around the clock</b></span></div>
      </section>

      <section className="booking-layout">
        <aside className="progress-rail" aria-label="Booking progress">
          <p className="rail-kicker">Your booking</p>
          <div className="progress-steps">
            {[['Trip details', 'Pickup and timing'], ['Ride type', 'Choose your vehicle'], ['Your details', 'Passenger information']].map(([title, detail], index) => {
              const step = index + 1
              const state = step < currentStep ? 'complete' : step === currentStep ? 'active' : ''
              return (
                <button className={`progress-step ${state}`} type="button" key={title} onClick={() => goToStep(step)} aria-current={step === currentStep ? 'step' : undefined}>
                  <span className="progress-number">{step < currentStep ? <Check size={14} strokeWidth={3} /> : step}</span>
                  <span><strong>{title}</strong><small>{detail}</small></span>
                </button>
              )
            })}
          </div>
          <p className="rail-note">You can go back and update your trip at any time.</p>
        </aside>
        <form className="booking-panel" onSubmit={submitBooking}>
          {currentStep === 1 && <>
            <div className="panel-heading"><div><p className="step-label">01 / Trip details</p><h2>Where are you going?</h2></div></div>
            <div className="location-fields">
              <AddressField name="pickup" value={form.pickup} placeholder="Pickup location" suggestions={suggestions.pickup} onChange={updateField} onSelect={selectAddress} accent="pickup" />
              <div className="route-line" />
              <AddressField name="destination" value={form.destination} placeholder="Where to?" suggestions={suggestions.destination} onChange={updateField} onSelect={selectAddress} accent="destination" />
            </div>
            <div className="trip-toggle" role="group" aria-label="Trip timing">
              <button className={form.tripType === 'now' ? 'active' : ''} type="button" onClick={() => setForm({ ...form, tripType: 'now' })}>Ride now</button>
              <button className={form.tripType === 'later' ? 'active' : ''} type="button" onClick={() => setForm({ ...form, tripType: 'later' })}>Schedule for later</button>
            </div>
            {form.tripType === 'later' && <ScheduleFields form={form} setForm={setForm} />}
            <StepActions onNext={continueToRideType} nextLabel="Choose ride type" />
          </>}

          {currentStep === 2 && <>
            <div className="panel-heading"><div><p className="step-label">02 / Choose your ride</p><h2>Travel your way</h2></div><span className="muted-text">Estimated fare</span></div>
            <div className="vehicle-grid">
              {vehicleOptions.map((vehicle) => <button className={`vehicle-card ${selectedVehicle === vehicle.id ? 'selected' : ''}`} type="button" key={vehicle.id} onClick={() => changeVehicle(vehicle.id)}><img className="vehicle-art" src={vehicle.image} alt={`${vehicle.name} taxi`} /><span className="vehicle-name">{vehicle.name}</span><span className="vehicle-detail">{vehicle.detail}</span><span className="vehicle-check">{selectedVehicle === vehicle.id ? 'Selected' : 'Choose'}</span></button>)}
            </div>
            <button className="estimate-button" type="button" onClick={calculateEstimate} disabled={loading || Boolean(estimate)}>{loading ? 'Calculating...' : estimate ? 'Estimate ready' : 'Calculate my estimate'}<span className="button-icon" aria-hidden="true">{estimate ? <Check size={17} strokeWidth={2.5} /> : <ArrowRight size={17} strokeWidth={2.5} />}</span></button>
            {estimate && <div className="estimate-strip"><div><span>Trip distance</span><strong>{estimate.distanceKm} km</strong></div><div><span>Approx. time</span><strong>{estimate.durationMinutes} min</strong></div><div className="estimate-total"><span>Estimated total</span><strong>${estimate.fare}</strong></div></div>}
            <StepActions onBack={() => goToStep(1)} onNext={continueToDetails} nextLabel="Continue to your details" />
          </>}

          {currentStep === 3 && <>
            <div className="panel-heading"><div><p className="step-label">03 / Your details</p><h2>Who are we picking up?</h2></div></div>
            <div className="contact-grid">
              <label className="field-label">Passenger name<input name="passengerName" value={form.passengerName} onChange={updateField} placeholder="Your full name" required /></label>
              <label className="field-label">Phone number<input name="phone" type="tel" value={form.phone} onChange={updateField} placeholder="04xx xxx xxx" required /></label>
              <label className="field-label full-width">Email address<input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" required /></label>
              <label className="field-label full-width">Extra notes <span className="optional">Optional</span><textarea name="notes" value={form.notes} onChange={updateField} placeholder="Flight number, accessibility needs, or anything else..." rows="3" /></label>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <StepActions onBack={() => goToStep(2)} nextLabel={loading ? 'Sending request...' : 'Book my ride'} submit />
            <p className="fine-print">By booking, you agree to our service terms and privacy policy.</p>
          </>}
          {error && currentStep !== 3 && <p className="error-message" role="alert">{error}</p>}
        </form>

        <aside className="map-panel" aria-label="Trip preview map">
          <MapContainer center={[-33.8688, 151.2093]} zoom={11} className="map-canvas" zoomControl>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapViewport locations={locations} />
            {locations.pickup && <CircleMarker center={[locations.pickup.lat, locations.pickup.lng]} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#135f5a', fillOpacity: 1 }} radius={10}><Popup><strong>Pickup</strong><br />{locations.pickup.label}</Popup></CircleMarker>}
            {locations.destination && <CircleMarker center={[locations.destination.lat, locations.destination.lng]} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#ed745e', fillOpacity: 1 }} radius={10}><Popup><strong>Destination</strong><br />{locations.destination.label}</Popup></CircleMarker>}
            {estimate?.geometry?.coordinates && <Polyline positions={estimate.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#135f5a', weight: 4, dashArray: '8 8' }} />}
          </MapContainer>
          <div className="map-caption"><span className="mini-compass">N</span><span>{locations.pickup || locations.destination ? 'Route locations selected' : 'Search Sydney addresses to preview your route'}</span></div>
        </aside>
      </section>
      <footer className="footer"><span>Harbour Ride / Sydney</span><span>Simple journeys. Thoughtfully handled.</span></footer>
    </main>
  )
}

export default App
