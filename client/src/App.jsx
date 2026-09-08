import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const vehicleOptions = [
  { id: 'sedan', name: 'Sedan', detail: '1-4 passengers' },
  { id: 'suv', name: 'SUV', detail: '1-5 passengers' },
  { id: 'maxi', name: 'Maxi cab', detail: '1-11 passengers' },
]

const initialForm = {
  pickup: '', destination: '', tripType: 'now', pickupTime: '', passengerName: '', phone: '', email: '', notes: '',
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

function App() {
  const [form, setForm] = useState(initialForm)
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleOptions[0].id)
  const [estimate, setEstimate] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState({ pickup: [], destination: [] })
  const [locations, setLocations] = useState({ pickup: null, destination: null })
  const pickupQuery = form.pickup
  const destinationQuery = form.destination

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
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, vehicleId: selectedVehicle, quoteId: estimate.quoteId }),
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

  if (submitted) {
    return (
      <main className="success-shell">
        <div className="success-mark">OK</div>
        <p className="eyebrow">Booking request received</p>
        <h1>Your ride is on its way.</h1>
        <p className="success-copy">We have sent the trip details to the booking team. Keep this reference for your records.</p>
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
        <form className="booking-panel" onSubmit={submitBooking}>
          <div className="panel-heading"><div><p className="step-label">01 / Trip details</p><h2>Where are you going?</h2></div><span className="cash-note">Cash payment</span></div>
          <div className="location-fields">
            <AddressField name="pickup" value={form.pickup} placeholder="Pickup location" suggestions={suggestions.pickup} onChange={updateField} onSelect={selectAddress} accent="pickup" />
            <div className="route-line" />
            <AddressField name="destination" value={form.destination} placeholder="Where to?" suggestions={suggestions.destination} onChange={updateField} onSelect={selectAddress} accent="destination" />
          </div>
          <div className="trip-toggle" role="group" aria-label="Trip timing">
            <button className={form.tripType === 'now' ? 'active' : ''} type="button" onClick={() => setForm({ ...form, tripType: 'now' })}>Ride now</button>
            <button className={form.tripType === 'later' ? 'active' : ''} type="button" onClick={() => setForm({ ...form, tripType: 'later' })}>Schedule for later</button>
          </div>
          {form.tripType === 'later' && <label className="field-label schedule-field">Pickup date and time<input type="datetime-local" name="pickupTime" value={form.pickupTime} onChange={updateField} required /></label>}

          <div className="section-divider" />
          <div className="panel-heading compact-heading"><div><p className="step-label">02 / Choose your ride</p><h2>Travel your way</h2></div><span className="muted-text">Estimated fare</span></div>
          <div className="vehicle-grid">
            {vehicleOptions.map((vehicle) => <button className={`vehicle-card ${selectedVehicle === vehicle.id ? 'selected' : ''}`} type="button" key={vehicle.id} onClick={() => changeVehicle(vehicle.id)}><span className={`vehicle-art ${vehicle.id}`}>{vehicle.id === 'maxi' ? 'MAXI' : vehicle.id.toUpperCase()}</span><span className="vehicle-name">{vehicle.name}</span><span className="vehicle-detail">{vehicle.detail}</span><span className="vehicle-check">{selectedVehicle === vehicle.id ? 'Selected' : 'Choose'}</span></button>)}
          </div>
          <button className="estimate-button" type="button" onClick={calculateEstimate} disabled={loading}>{loading && !estimate ? 'Calculating...' : 'Calculate my estimate'}<span>-&gt;</span></button>
          {estimate && <div className="estimate-strip"><div><span>Trip distance</span><strong>{estimate.distanceKm} km</strong></div><div><span>Approx. time</span><strong>{estimate.durationMinutes} min</strong></div><div className="estimate-total"><span>Estimated total</span><strong>${estimate.fare}</strong></div></div>}

          <div className="section-divider" />
          <div className="panel-heading compact-heading"><div><p className="step-label">03 / Your details</p><h2>Who are we picking up?</h2></div></div>
          <div className="contact-grid">
            <label className="field-label">Passenger name<input name="passengerName" value={form.passengerName} onChange={updateField} placeholder="Your full name" required /></label>
            <label className="field-label">Phone number<input name="phone" type="tel" value={form.phone} onChange={updateField} placeholder="04xx xxx xxx" required /></label>
            <label className="field-label full-width">Email address<input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" required /></label>
            <label className="field-label full-width">Extra notes <span className="optional">Optional</span><textarea name="notes" value={form.notes} onChange={updateField} placeholder="Flight number, accessibility needs, or anything else..." rows="3" /></label>
          </div>
          <p className="payment-line"><span className="payment-icon">$</span> Payment is collected by cash at the end of your trip.</p>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="book-button" type="submit" disabled={loading}>{loading ? 'Sending request...' : 'Book my ride'}<span>-&gt;</span></button>
          <p className="fine-print">By booking, you agree to our service terms and privacy policy.</p>
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
