import { searchPlaces } from '@/lib/geo'

// Address suggestions. The same query from anyone gets the CDN's copy for a day.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 3 || q.length > 120) return Response.json({ places: [] })
  try {
    const places = await searchPlaces(q)
    return Response.json({ places }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch (e) {
    console.warn(`Place search failed: ${(e as Error).message}`)
    return Response.json({ places: [], unavailable: true }, { status: 502 })
  }
}
