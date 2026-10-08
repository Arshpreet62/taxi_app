import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CarId } from './tariff'
import type { Place } from './places'

// A quote is a signed token instead of a row in memory, so any serverless instance can check it.

export type Quote = {
  v: 1
  from: Place
  to: Place
  km: number
  min: number
  approx: boolean
  fares: Record<CarId, number>
  exp: number
}

function secret() {
  const s = process.env.QUOTE_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('QUOTE_SECRET is not set')
  return 'harbour-ride-dev-secret'
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const mac = (body: string) => createHmac('sha256', secret()).update(body).digest()

export function signQuote(q: Quote) {
  const body = b64(JSON.stringify(q))
  return `${body}.${b64(mac(body))}`
}

export type Verified = { ok: true; quote: Quote } | { ok: false; reason: 'invalid' | 'expired' }

// A minute's grace for a slow network on the last tap.
const GRACE_MS = 60_000

export function verifyQuote(token: string, now = Date.now()): Verified {
  const [body, sig] = token.split('.')
  if (!body || !sig) return { ok: false, reason: 'invalid' }
  const want = mac(body), got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: 'invalid' }
  let quote: Quote
  try { quote = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return { ok: false, reason: 'invalid' } }
  if (quote.v !== 1) return { ok: false, reason: 'invalid' }
  if (quote.exp + GRACE_MS < now) return { ok: false, reason: 'expired' }
  return { ok: true, quote }
}
