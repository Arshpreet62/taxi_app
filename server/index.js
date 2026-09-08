require('dotenv').config()

const express = require('express')
const cors = require('cors')
const nodemailer = require('nodemailer')
const { randomUUID } = require('crypto')

const app = express()
const port = process.env.PORT || 3001

const vehicleOptions = {
  sedan: { name: 'Sedan', ratePerKm: 2.2, minimumFare: 42 },
  suv: { name: 'SUV', ratePerKm: 2.7, minimumFare: 52 },
  maxi: { name: 'Maxi cab', ratePerKm: 3.4, minimumFare: 68 },
}

const quotes = new Map()
const quoteLifetimeMs = 15 * 60 * 1000

app.use(cors())
app.use(express.json({ limit: '32kb' }))

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidCoordinatePair(location) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return false
  return Number(location.lat) >= -90 && Number(location.lat) <= 90 && Number(location.lng) >= -180 && Number(location.lng) <= 180
}

setInterval(() => {
  const now = Date.now()
  for (const [quoteId, quote] of quotes) {
    if (quote.expiresAt < now && quote.status !== 'processing') quotes.delete(quoteId)
  }
}, 60 * 1000).unref()

function calculateFare(vehicleId, distanceKm) {
  const vehicle = vehicleOptions[vehicleId]
  if (!vehicle) return null
  return Math.max(vehicle.minimumFare, vehicle.minimumFare + distanceKm * vehicle.ratePerKm).toFixed(2)
}

function createDemoRoute(pickup, destination) {
  const characters = `${pickup}${destination}`.replace(/\s/g, '').length
  const distanceKm = Math.max(8, Math.min(48, 8 + (characters % 25)))
  const durationMinutes = Math.round(distanceKm * 2.15 + 8)
  return { distanceKm, durationMinutes }
}

async function createRoute(pickup, destination, pickupLocation, destinationLocation) {
  if (!pickupLocation || !destinationLocation) return createDemoRoute(pickup, destination)
  if (!isValidCoordinatePair(pickupLocation) || !isValidCoordinatePair(destinationLocation)) return createDemoRoute(pickup, destination)

  const coordinates = `${Number(pickupLocation.lng)},${Number(pickupLocation.lat)};${Number(destinationLocation.lng)},${Number(destinationLocation.lat)}`
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`)
    if (!response.ok) throw new Error('Routing service unavailable')
    const result = await response.json()
    const route = result.routes?.[0]
    if (!route) throw new Error('No route found')
    return {
      distanceKm: Number((route.distance / 1000).toFixed(1)),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry,
    }
  } catch (error) {
    console.warn(`Using demo route because live routing failed: ${error.message}`)
    return createDemoRoute(pickup, destination)
  }
}

function createMailTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  }
  return nodemailer.createTransport({ jsonTransport: true })
}

const mailTransport = createMailTransport()

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok', service: 'harbour-ride-api' })
})

app.post('/api/estimate', async (request, response) => {
  const { pickup, destination, pickupLocation, destinationLocation, vehicleId } = request.body
  if (!isNonEmptyString(pickup) || !isNonEmptyString(destination)) {
    return response.status(400).json({ message: 'Pickup and destination are required.' })
  }
  if (!vehicleOptions[vehicleId]) {
    return response.status(400).json({ message: 'Choose a valid vehicle.' })
  }

  const route = await createRoute(pickup, destination, pickupLocation, destinationLocation)
  const quote = {
    id: randomUUID(),
    pickup: pickup.trim(),
    destination: destination.trim(),
    vehicleId,
    ...route,
    fare: calculateFare(vehicleId, route.distanceKm),
    status: 'available',
    expiresAt: Date.now() + quoteLifetimeMs,
  }
  quotes.set(quote.id, quote)
  return response.json({
    quoteId: quote.id,
    distanceKm: quote.distanceKm,
    durationMinutes: quote.durationMinutes,
    geometry: quote.geometry,
    fare: quote.fare,
    expiresAt: new Date(quote.expiresAt).toISOString(),
  })
})

app.post('/api/bookings', async (request, response) => {
  const { quoteId, pickup, destination, tripType, pickupTime, passengerName, phone, email, vehicleId } = request.body
  const requiredFields = { pickup, destination, passengerName, phone, email }
  const missingField = Object.entries(requiredFields).find(([, value]) => !isNonEmptyString(value))

  if (missingField) return response.status(400).json({ message: `${missingField[0]} is required.` })
  if (!['now', 'later'].includes(tripType)) return response.status(400).json({ message: 'Choose whether the ride is now or later.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ message: 'Enter a valid email address.' })
  if (tripType === 'later' && !pickupTime) return response.status(400).json({ message: 'Choose a pickup time.' })
  if (tripType === 'later' && Number.isNaN(Date.parse(pickupTime))) return response.status(400).json({ message: 'Enter a valid pickup time.' })
  if (tripType === 'later' && Date.parse(pickupTime) <= Date.now()) return response.status(400).json({ message: 'Scheduled pickup must be in the future.' })

  const quote = quotes.get(quoteId)
  if (!quote) return response.status(409).json({ message: 'Your estimate is no longer available. Please calculate it again.' })
  if (quote.expiresAt < Date.now()) {
    quotes.delete(quoteId)
    return response.status(409).json({ message: 'Your estimate has expired. Please calculate it again.' })
  }
  if (quote.status === 'processing') return response.status(409).json({ message: 'This booking is already being processed.' })
  if (quote.pickup !== pickup.trim() || quote.destination !== destination.trim() || quote.vehicleId !== vehicleId) {
    return response.status(409).json({ message: 'Your trip details changed. Please calculate a new estimate.' })
  }

  quote.status = 'processing'
  const booking = {
    reference: `HR-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    pickup,
    destination,
    tripType,
    pickupTime: pickupTime || 'As soon as possible',
    passengerName,
    phone,
    email,
    notes: request.body.notes || '',
    vehicle: vehicleOptions[vehicleId].name,
    distanceKm: quote.distanceKm,
    durationMinutes: quote.durationMinutes,
    fare: quote.fare,
  }

  const mail = {
    from: process.env.BOOKING_FROM || 'bookings@harbour-ride.test',
    to: process.env.BOOKING_TO || 'bookings@harbour-ride.test',
    subject: `New ride request ${booking.reference}`,
    text: [
      `Booking reference: ${booking.reference}`,
      `Passenger: ${booking.passengerName}`,
      `Phone: ${booking.phone}`,
      `Email: ${booking.email}`,
      `Pickup: ${booking.pickup}`,
      `Destination: ${booking.destination}`,
      `When: ${booking.pickupTime}`,
      `Vehicle: ${booking.vehicle}`,
      `Estimate: $${booking.fare} (${booking.distanceKm} km, ${booking.durationMinutes} min)`,
      `Notes: ${booking.notes || 'None'}`,
    ].join('\n'),
  }

  try {
    const info = await mailTransport.sendMail(mail)
    quotes.delete(quoteId)
    if (process.env.SMTP_HOST) console.log(`Booking email sent for ${booking.reference}: ${info.messageId}`)
    else console.log(`Development booking email for ${booking.reference}:\n${info.message}`)
    return response.status(201).json({ reference: booking.reference })
  } catch (error) {
    quote.status = 'available'
    console.error('Booking email failed', error)
    return response.status(500).json({ message: 'The booking could not be sent. Please call us instead.' })
  }
})

app.listen(port, () => {
  console.log(`Harbour Ride API listening on http://localhost:${port}`)
})
