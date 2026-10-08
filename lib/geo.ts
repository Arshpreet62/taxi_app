import 'server-only'
import { SERVICE_BBOX, SYDNEY, type Place } from './places'

// Address search uses Photon (built for search-as-you-type; Nominatim's policy forbids autocomplete).
// Road routes come from OSRM. Both public servers are fine for a prototype; see README before launch.

const PHOTON = process.env.PHOTON_URL || 'https://photon.komoot.io'
const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org'
const UA = process.env.GEOCODER_USER_AGENT || 'HarbourRide/1.0 (github.com/Arshpreet62/taxi_app)'

// One retry on a network error: the public servers drop idle keep-alive sockets, and Node's fetch
// can pick a dead one on the first request after a quiet spell. Timeouts are not retried.
export const why = (e: unknown) => [(e as Error).message, ((e as Error).cause as Error)?.message].filter(Boolean).join(': ')

async function get(url: string, timeoutMs: number) {
  const go = () => fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })
  try {
    return await go()
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw e
    return go()
  }
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined> & { countrycode?: string }
}

// Search results lead with the name ("Bondi Icebergs"); a tapped or located spot leads with the
// street address, which is what the driver needs ("25 Martin Place", not the shop on the corner).
function toPlace(f: PhotonFeature, preferAddress = false): Place | null {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : ''
  const label = (preferAddress ? street || p.name : p.name || street) ?? ''
  if (!label) return null
  const other = (label === street ? p.name : street)?.split(',')[0]
  const area = [...new Set([other, p.district || p.locality || p.city, p.postcode])].filter((x) => x && x !== label).join(', ')
  return { label, area: area || undefined, lat, lng }
}

async function photon(path: string, params: Record<string, string>, preferAddress = false) {
  const url = `${PHOTON}${path}?${new URLSearchParams({ lang: 'en', ...params })}`
  const res = await get(url, 5000)
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const json = (await res.json()) as { features: PhotonFeature[] }
  const seen = new Set<string>()
  return json.features
    .filter((f) => !f.properties.countrycode || f.properties.countrycode === 'AU')
    .map((f) => toPlace(f, preferAddress))
    .filter((p): p is Place => {
      if (!p) return false
      const key = `${p.label}|${p.area}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const searchPlaces = (q: string) =>
  photon('/api/', { q, limit: '7', lat: String(SYDNEY.lat), lon: String(SYDNEY.lng), bbox: SERVICE_BBOX.join(',') })

export const reversePlace = async (lat: number, lng: number) =>
  (await photon('/reverse', { lat: String(lat), lon: String(lng), limit: '1' }, true))[0] ?? null

export type Route = { km: number; min: number; approx: boolean; geometry: [number, number][] }

function haversineKm(a: Place, b: Place) {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// When routing is down: straight line × 1.3 at 36 km/h, plus 6 minutes. Marked approximate.
function straightLine(a: Place, b: Place): Route {
  const km = Math.round(haversineKm(a, b) * 1.3 * 10) / 10
  return { km, min: Math.round(km * (60 / 36) + 6), approx: true, geometry: [[a.lng, a.lat], [b.lng, b.lat]] }
}

export async function route(a: Place, b: Place): Promise<Route> {
  try {
    const res = await get(`${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, 6000)
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const json = await res.json()
    const r = json.routes?.[0]
    if (!r) throw new Error('No route')
    return {
      km: Math.round(r.distance / 100) / 10,
      min: Math.max(1, Math.round(r.duration / 60)),
      approx: false,
      geometry: r.geometry.coordinates,
    }
  } catch (e) {
    console.warn(`Routing fell back to a straight line: ${why(e)}`)
    return straightLine(a, b)
  }
}
