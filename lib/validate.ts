import { z } from 'zod'
import { CAR_IDS, MAX_PASSENGERS } from './tariff'

// Australian numbers: mobiles 04xx xxx xxx, landlines 0[2378] xxxx xxxx, or +61 forms.
export function normalisePhone(raw: string) {
  const digits = raw.replace(/[\s()-]/g, '')
  const local = digits.startsWith('+61') ? '0' + digits.slice(3) : digits.startsWith('61') && digits.length === 11 ? '0' + digits.slice(2) : digits
  if (!/^0[23478]\d{8}$/.test(local)) return null
  return local.startsWith('04')
    ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
    : `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const coord = z.object({
  label: z.string().trim().min(1).max(200),
  area: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const EstimateBody = z.object({ from: coord, to: coord })

export const BookingBody = z.object({
  quote: z.string().min(10).max(4000),
  car: z.enum(CAR_IDS),
  passengers: z.number().int().min(1).max(MAX_PASSENGERS),
  when: z.enum(['now', 'later']),
  date: z.string().optional(),
  time: z.string().optional(),
  name: z.string().trim().min(1, 'Add the passenger name.').max(100),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(200).regex(EMAIL_RE, 'Add an email address for the confirmation.'),
  flight: z.string().trim().max(12).optional(),
  notes: z.string().trim().max(500).optional(),
  // Honeypot: a hidden field people never fill in.
  website: z.string().optional(),
})

export type BookingInput = z.infer<typeof BookingBody>
