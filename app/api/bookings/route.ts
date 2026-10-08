import { createHash } from 'node:crypto'
import { BUSINESS } from '@/lib/business'
import { bookingIcs } from '@/lib/email/ics'
import { sendBooking } from '@/lib/email/send'
import type { Booking } from '@/lib/email/templates'
import { isAirport, placeText } from '@/lib/places'
import { verifyQuote } from '@/lib/quote'
import { clientIp, limited } from '@/lib/ratelimit'
import { carById, money } from '@/lib/tariff'
import { formatWhen, MIN_LEAD_MINUTES, sydneyToDate } from '@/lib/time'
import { BookingBody, normalisePhone } from '@/lib/validate'

const callUs = `Please call ${BUSINESS.phone} and we'll take it by phone.`

const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => Response.json({ message, ...extra }, { status })

// "HR-" and six characters with no 0/O or 1/I to misread over the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const referenceFrom = (hash: Buffer) => 'HR-' + [...hash.subarray(0, 6)].map((b) => ALPHABET[b % 32]).join('')

export async function POST(request: Request) {
  if (limited(clientIp(request), 5, 10 * 60_000)) return fail(429, `Too many bookings from this connection. ${callUs}`)

  const parsed = BookingBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return fail(400, issue?.message && !issue.message.startsWith('Invalid') ? issue.message : 'Check the booking details.', { field: issue?.path[0] })
  }
  const input = parsed.data

  // Bots fill every field. Pretend it worked and send nothing.
  if (input.website) return Response.json({ reference: 'HR-000000', confirmationSent: true }, { status: 201 })

  const phone = normalisePhone(input.phone)
  if (!phone) return fail(400, 'Add an Australian phone number the driver can call.', { field: 'phone' })

  const verified = verifyQuote(input.quote)
  if (!verified.ok) {
    return verified.reason === 'expired'
      ? fail(409, 'The price lock ran out. Refresh the price to book.', { code: 'expired' })
      : fail(400, 'That price could not be checked. Refresh the price to book.', { code: 'invalid' })
  }
  const q = verified.quote
  const car = carById(input.car)
  if (input.passengers > car.seats) return fail(400, `A ${car.name.toLowerCase()} seats ${car.seats}. Choose a bigger car.`, { field: 'car' })

  let pickupAt: Date | null = null
  if (input.when === 'later') {
    pickupAt = sydneyToDate(input.date ?? '', input.time ?? '')
    if (!pickupAt) return fail(400, 'Choose a pickup date and time.', { field: 'time' })
    if (pickupAt.getTime() < Date.now() + (MIN_LEAD_MINUTES - 5) * 60_000) {
      return fail(400, `Scheduled pickups need at least ${MIN_LEAD_MINUTES} minutes' notice. Choose a later time, or book for now.`, { field: 'time' })
    }
  }

  // Same booking twice (a double tap, a retry) gives the same reference and sends the emails once.
  const hash = createHash('sha256').update(JSON.stringify([input.quote, input.car, input.passengers, input.when, input.date, input.time, input.name, phone, input.email.toLowerCase(), input.flight, input.notes])).digest()
  const reference = referenceFrom(hash)
  const fare = money(q.fares[input.car])
  const pickup = placeText(q.from), drop = placeText(q.to)

  const booking: Booking = {
    reference,
    createdAt: new Date(),
    pickup,
    drop,
    pickupMaps: `https://www.google.com/maps/search/?api=1&query=${q.from.lat},${q.from.lng}`,
    routeMaps: `https://www.google.com/maps/dir/?api=1&origin=${q.from.lat},${q.from.lng}&destination=${q.to.lat},${q.to.lng}&travelmode=driving`,
    when: pickupAt ? `${formatWhen(pickupAt)} (Sydney time)` : 'As soon as possible',
    scheduled: Boolean(pickupAt),
    car: car.name,
    passengers: input.passengers,
    fare,
    km: q.km,
    min: q.min,
    approx: q.approx,
    name: input.name,
    phone,
    email: input.email,
    flight: isAirport(q.from) && input.flight ? input.flight.toUpperCase() : undefined,
    notes: input.notes || undefined,
  }
  const ics = pickupAt ? bookingIcs({ reference, start: pickupAt, minutes: q.min, pickup, drop, car: car.name, fare, phone: BUSINESS.phone }) : undefined

  try {
    const sent = await sendBooking(booking, hash.toString('hex').slice(0, 48), ics)
    if (!sent.dispatch.ok) {
      console.error(`Dispatch email failed for ${reference}: ${sent.dispatch.error}`)
      return fail(502, `The booking couldn't be sent to dispatch. ${callUs}`, { code: 'email' })
    }
    if (!sent.customer.ok) console.warn(`Confirmation email failed for ${reference}: ${sent.customer.error}`)
    console.log(`Booked ${reference}: ${pickup} -> ${drop}, ${booking.when}, ${car.name}, $${fare}`)
    return Response.json({ reference, confirmationSent: sent.customer.ok }, { status: 201 })
  } catch (e) {
    console.error(`Booking ${reference} failed`, e)
    return fail(502, `The booking couldn't be sent. ${callUs}`, { code: 'email' })
  }
}
