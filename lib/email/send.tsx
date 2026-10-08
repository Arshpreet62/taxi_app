import 'server-only'
import { render } from '@react-email/components'
import { Resend } from 'resend'
import { CustomerEmail, customerText, DispatchEmail, dispatchText, type Booking } from './templates'

// Sends the dispatch email and the passenger's confirmation.
// Without RESEND_API_KEY the emails are printed to the server log instead (local development).

const FROM = process.env.BOOKING_FROM || 'Harbour Ride <onboarding@resend.dev>'
const TO = process.env.BOOKING_TO || 'bookings@harbour-ride.test'

type Mail = { to: string; replyTo: string; subject: string; html: string; text: string; attachments?: { filename: string; content: string; contentType: string }[] }
type Sent = { ok: true } | { ok: false; error: string }

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function deliver(mail: Mail, idempotencyKey: string): Promise<Sent> {
  if (!resend) {
    console.log(`\n--- Email (dev, not sent) ---\nTo: ${mail.to}\nReply-To: ${mail.replyTo}\nSubject: ${mail.subject}\n${mail.attachments?.map((a) => `Attachment: ${a.filename}\n`).join('') ?? ''}\n${mail.text}\n---\n`)
    return { ok: true }
  }
  const { error } = await resend.emails.send(
    {
      from: FROM, to: mail.to, replyTo: mail.replyTo, subject: mail.subject, html: mail.html, text: mail.text,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64'), contentType: a.contentType })),
    },
    { idempotencyKey },
  )
  // The key is a hash of the whole booking, so Resend refusing it as already used (or still sending)
  // means this same booking went out already: a retry or a double tap. Each email carries the time
  // it was written, so the repeat isn't byte-identical and Resend reports it this way.
  if (error?.name === 'invalid_idempotent_request' || error?.name === 'concurrent_idempotent_requests') return { ok: true }
  return error ? { ok: false, error: `${error.name}: ${error.message}` } : { ok: true }
}

export async function sendBooking(b: Booking, idempotencyKey: string, ics?: string) {
  const dispatchHtml = await render(<DispatchEmail b={b} />)
  const dispatch = await deliver({
    to: TO,
    replyTo: b.email,
    subject: `New ride ${b.reference} · ${b.when} · ${b.car}`,
    html: dispatchHtml,
    text: dispatchText(b),
  }, `${idempotencyKey}-dispatch`)
  // Without dispatch there is no booking; don't confirm to the passenger.
  if (!dispatch.ok) return { dispatch, customer: { ok: false, error: 'skipped' } as Sent }

  const customerHtml = await render(<CustomerEmail b={b} />)
  const customer = await deliver({
    to: b.email,
    replyTo: TO,
    subject: `Booked: ${b.reference}, ${b.when}`,
    html: customerHtml,
    text: customerText(b),
    attachments: ics ? [{ filename: `harbour-ride-${b.reference}.ics`, content: ics, contentType: 'text/calendar' }] : undefined,
  }, `${idempotencyKey}-customer`)
  return { dispatch, customer }
}
