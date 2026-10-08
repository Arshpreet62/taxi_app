import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { BUSINESS } from '../business'

// Both emails are styled as the booking docket the page prints. Email clients don't know oklch, so hex here.
const c = { paper: '#fdfcf8', ink: '#2b2f36', muted: '#5d6670', amber: '#f2b01e', onAmber: '#3a2a07', teal: '#123a45', ground: '#eef3f3', rule: '#c9d2d4' }
const mono = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace"
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export type Booking = {
  reference: string
  createdAt: Date
  pickup: string
  drop: string
  pickupMaps: string
  routeMaps: string
  when: string
  scheduled: boolean
  car: string
  passengers: number
  fare: string
  km: number
  min: number
  approx: boolean
  name: string
  phone: string
  email: string
  flight?: string
  notes?: string
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <tr>
      <td style={{ width: 120, padding: '3px 12px 3px 0', verticalAlign: 'top', textTransform: 'uppercase', color: c.muted, fontSize: 12 }}>{k}</td>
      <td style={{ padding: '3px 0', verticalAlign: 'top', color: c.ink, fontSize: 14, wordBreak: 'break-word' }}>{children}</td>
    </tr>
  )
}

function Docket({ b, forDispatch }: { b: Booking; forDispatch: boolean }) {
  return (
    <Section style={{ background: c.paper, border: `1px solid ${c.rule}`, borderRadius: 6, padding: '18px 20px', fontFamily: mono }}>
      <Text style={{ margin: '0 0 10px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.ink, fontSize: 13 }}>
        Harbour Ride · Booking docket
      </Text>
      <Hr style={{ borderTop: `1px dashed ${c.ink}`, margin: '0 0 10px' }} />
      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono }}>
        <tbody>
          <Row k="Ref"><b>{b.reference}</b></Row>
          <Row k="When"><b>{b.when}</b></Row>
          <Row k="Pickup"><Link href={b.pickupMaps} style={{ color: c.ink }}>{b.pickup}</Link></Row>
          <Row k="Drop-off">{b.drop}</Row>
          <Row k="Car">{b.car}, {b.passengers} {b.passengers === 1 ? 'passenger' : 'passengers'}</Row>
          <Row k="Estimate">${b.fare} ({b.approx ? 'about ' : ''}{b.km} km, {b.min} min)</Row>
          {b.flight && <Row k="Flight">{b.flight}</Row>}
          {forDispatch && <Row k="Passenger">{b.name}</Row>}
          {forDispatch && <Row k="Phone"><Link href={`tel:${b.phone.replace(/\s/g, '')}`} style={{ color: c.ink }}>{b.phone}</Link></Row>}
          {forDispatch && <Row k="Email"><Link href={`mailto:${b.email}`} style={{ color: c.ink }}>{b.email}</Link></Row>}
          <Row k="Notes">{b.notes || 'None'}</Row>
        </tbody>
      </table>
      <Hr style={{ borderTop: `1px dashed ${c.ink}`, margin: '12px 0 8px' }} />
      <Text style={{ margin: 0, textAlign: 'center', color: c.ink, fontSize: 13 }}>Pay the driver at the end, cash or card.</Text>
    </Section>
  )
}

function Shell({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en-AU">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: c.ground, margin: 0, padding: '24px 12px', fontFamily: sans, color: c.ink }}>
        <Container style={{ maxWidth: 560, margin: '0 auto' }}>
          <Text style={{ margin: '0 0 16px', fontSize: 18, color: c.teal }}>
            <span style={{ background: c.amber, color: c.onAmber, fontWeight: 900, padding: '2px 6px', borderRadius: 3, fontSize: 13, marginRight: 8 }}>HR</span>
            Harbour<b>Ride</b>
          </Text>
          {children}
        </Container>
      </Body>
    </Html>
  )
}

export function DispatchEmail({ b }: { b: Booking }) {
  return (
    <Shell preview={`${b.when}: ${b.pickup} to ${b.drop}, ${b.car}`}>
      <Heading as="h1" style={{ fontSize: 22, margin: '0 0 6px' }}>New ride {b.reference}</Heading>
      <Text style={{ margin: '0 0 16px', color: c.muted }}>
        {b.scheduled ? 'Scheduled pickup.' : 'Pickup as soon as possible.'} Reply to this email to reach {b.name}.
      </Text>
      <Docket b={b} forDispatch />
      <Text style={{ margin: '16px 0 0', fontSize: 14 }}>
        <Link href={b.routeMaps} style={{ color: c.teal, fontWeight: 700 }}>Open the route in Google Maps</Link>
      </Text>
      {b.approx && <Text style={{ fontSize: 13, color: c.muted }}>Routing was down when this was quoted, so the distance is a straight-line estimate. Check the fare with the passenger.</Text>}
      <Text style={{ fontSize: 12, color: c.muted }}>Booked online {b.createdAt.toISOString()}</Text>
    </Shell>
  )
}

export function CustomerEmail({ b }: { b: Booking }) {
  return (
    <Shell preview={`Booked: ${b.reference}, ${b.when}. Pay the driver at the end.`}>
      <Heading as="h1" style={{ fontSize: 22, margin: '0 0 6px' }}>You&apos;re booked, {b.name.split(' ')[0]}.</Heading>
      <Text style={{ margin: '0 0 16px', color: c.muted }}>
        Your reference is <b style={{ fontFamily: mono, background: c.amber, color: c.onAmber, padding: '0 4px' }}>{b.reference}</b>.
        {b.scheduled ? ' A calendar entry is attached.' : ' A driver is on the way soon; they will call you if they can’t find you.'}
      </Text>
      <Docket b={b} forDispatch={false} />
      <Text style={{ margin: '16px 0 0', fontSize: 14 }}>
        To change or cancel, call <Link href={BUSINESS.tel} style={{ color: c.teal, fontWeight: 700 }}>{BUSINESS.phone}</Link> or reply to this email.
      </Text>
      <Text style={{ fontSize: 12, color: c.muted }}>
        The fare is an estimate for the route shown; the driver&apos;s meter is final. We use your details only to run this ride.
      </Text>
    </Shell>
  )
}
