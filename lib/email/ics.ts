// A calendar entry for a scheduled pickup: attached to the confirmation email and offered on the done screen.

type IcsInput = { reference: string; start: Date; minutes: number; pickup: string; drop: string; car: string; fare: string; phone: string }

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

// Lines over 75 octets are folded, as RFC 5545 asks.
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ')

export function bookingIcs(b: IcsInput) {
  const end = new Date(b.start.getTime() + b.minutes * 60000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Harbour Ride//Booking//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.reference}@harbour-ride`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Taxi to ${b.drop} (${b.reference})`)}`,
    `LOCATION:${esc(b.pickup)}`,
    `DESCRIPTION:${esc(`Harbour Ride ${b.reference}\n${b.car}, estimate $${b.fare}\nPickup: ${b.pickup}\nDrop-off: ${b.drop}\nPay the driver at the end. To change or cancel call ${b.phone}.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Taxi pickup in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n'
}
