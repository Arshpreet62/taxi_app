import 'server-only'

// Best effort: each serverless instance keeps its own window. Enough to stop a form being hammered
// from one browser; put Vercel's firewall rules or a shared store in front for anything serious.
const hits = new Map<string, number[]>()

export function limited(key: string, max: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
  return false
}

export const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
