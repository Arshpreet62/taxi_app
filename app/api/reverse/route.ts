import { reversePlace } from '@/lib/geo'
import { inServiceArea } from '@/lib/places'

// The address under a map tap, a dragged pin or "Use my location".
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  // Four decimals is about 10 m, plenty for a pickup and better for caching.
  const lat = Math.round(Number(sp.get('lat')) * 1e4) / 1e4, lng = Math.round(Number(sp.get('lng')) * 1e4) / 1e4
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ message: 'Bad coordinates.' }, { status: 400 })
  if (!inServiceArea({ lat, lng })) return Response.json({ message: 'That spot is outside the area we cover.', code: 'outside' }, { status: 422 })
  try {
    const found = await reversePlace(lat, lng)
    // Keep the exact spot the passenger chose; the name is only a label.
    const place = { label: found?.label ?? `${lat}, ${lng}`, area: found?.area, lat, lng }
    return Response.json({ place }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } })
  } catch (e) {
    console.warn(`Reverse lookup failed: ${(e as Error).message}`)
    return Response.json({ place: { label: 'Dropped pin', area: `${lat}, ${lng}`, lat, lng } })
  }
}
