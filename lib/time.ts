// Pickup times are Sydney wall-clock times, wherever the browser or the server is.
// (Vercel functions run in UTC.)

export const TZ = 'Australia/Sydney'
export const MIN_LEAD_MINUTES = Number(process.env.NEXT_PUBLIC_MIN_LEAD_MINUTES ?? 30)

const parts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  )
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second }
}

// Minutes Sydney is ahead of UTC at a given instant.
function offsetMinutes(at: Date) {
  const p = parts(at)
  return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - at.getTime()) / 60000)
}

// "2026-10-09", "07:30" in Sydney -> the instant.
export function sydneyToDate(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m || !t) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2])
  let at = new Date(guess - offsetMinutes(new Date(guess)) * 60000)
  // Once more in case the guess straddled a daylight-saving change.
  at = new Date(guess - offsetMinutes(at) * 60000)
  return Number.isNaN(at.getTime()) ? null : at
}

const pad = (n: number) => String(n).padStart(2, '0')

// The date and time it is now in Sydney.
export function sydneyNow(at = new Date()) {
  const p = parts(at)
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` }
}

export const deviceInSydney = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone === TZ } catch { return true }
}

// Quarter-hour slots for a Sydney date, starting no earlier than now + lead time.
export function timeSlots(date: string, now = new Date()) {
  const earliest = new Date(now.getTime() + MIN_LEAD_MINUTES * 60000)
  const slots: string[] = []
  for (let m = 0; m < 24 * 60; m += 15) {
    const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
    const at = sydneyToDate(date, time)
    if (at && at >= earliest) slots.push(time)
  }
  return slots
}

export const formatWhen = (at: Date) =>
  at.toLocaleString('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
