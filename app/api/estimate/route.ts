import { route } from '@/lib/geo'
import { inServiceArea, samePlace } from '@/lib/places'
import { signQuote, type Quote } from '@/lib/quote'
import { allFares, QUOTE_MINUTES } from '@/lib/tariff'
import { EstimateBody } from '@/lib/validate'

const MAX_KM = 250

// One road route and every car's fare for it, with a signed quote that holds the price for 15 minutes.
export async function POST(request: Request) {
  const parsed = EstimateBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Choose a pickup and a drop-off.' }, { status: 400 })
  const { from, to } = parsed.data
  if (!inServiceArea(from) || !inServiceArea(to)) {
    return Response.json({ message: 'That trip is outside the area we cover. Call us and we can usually still help.', code: 'outside' }, { status: 422 })
  }
  if (samePlace(from, to)) return Response.json({ message: 'The pickup and drop-off are the same place.', code: 'same' }, { status: 422 })

  const r = await route(from, to)
  if (r.km > MAX_KM) return Response.json({ message: 'That trip is too long to book online. Call us for a price.', code: 'far' }, { status: 422 })

  const quote: Quote = { v: 1, from, to, km: r.km, min: r.min, approx: r.approx, fares: allFares(r.km), exp: Date.now() + QUOTE_MINUTES * 60_000 }
  return Response.json({
    token: signQuote(quote),
    km: quote.km,
    min: quote.min,
    approx: quote.approx,
    fares: quote.fares,
    expiresAt: quote.exp,
    geometry: r.geometry,
  })
}
