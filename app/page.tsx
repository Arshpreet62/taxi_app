import { BookingConsole } from '@/components/BookingConsole'
import { SectionTabs } from '@/components/SectionTabs'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { BUSINESS } from '@/lib/business'

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to booking</a>

      <header className="bar">
        <div className="bar__logo">
          <a className="brand" href="#book" aria-label="Harbour Ride, back to booking">
            <svg className="brand__mark" viewBox="0 0 40 32" aria-hidden="true" focusable="false"><rect className="brand__lamp" x="8" y="1" width="24" height="12" rx="3" /><path className="brand__roof" d="M3 31 8.5 16h23L37 31z" /><text x="20" y="10.5" textAnchor="middle">HR</text></svg>
            <span className="brand__name">Harbour<b>Ride</b></span>
          </a>
        </div>
        <div className="bar__nav"><SectionTabs /></div>
        <div className="bar__end">
          <ThemeSwitch />
          <a className="call" href={BUSINESS.tel}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.5 2.5h2.6l1.3 3.9-1.8 1.2a9.4 9.4 0 0 0 4.8 4.8l1.2-1.8 3.9 1.3v2.6a1.8 1.8 0 0 1-1.9 1.8A14.6 14.6 0 0 1 3.7 4.4a1.8 1.8 0 0 1 1.8-1.9z" /></svg>
            <span className="call__num">{BUSINESS.phone}</span><span className="vh">Call Harbour Ride</span>
          </a>
        </div>
      </header>

      <main id="main">
        <BookingConsole />

        <section className="after" id="after" aria-labelledby="after-title">
          <h2 id="after-title">How it works</h2>
          <ol className="leg">
            <li><h3>Pick a trip and a car</h3><p>Search any Sydney address or tap the map. The meter shows the full fare for every car straight away.</p></li>
            <li><h3>Book in one step</h3><p>Add your name and number. The price stays locked for 15&nbsp;minutes while you do, and you get a confirmation email.</p></li>
            <li><h3>Pay at the end</h3><p>Cash or card to the driver. Nothing is charged online.</p></li>
          </ol>
        </section>

        <section className="privacy" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Privacy</h2>
          <p className="privacy__draft">Draft for the owner to check before launch.</p>
          <dl className="privacy__list">
            <div><dt>What we collect</dt><dd>Your name, mobile, email, any note for the driver, and the trip: pickup, drop-off, time and car.</dd></div>
            <div><dt>Why</dt><dd>To send the booking to dispatch, so the driver can find you, and to email you a confirmation. Nothing else, and no marketing.</dd></div>
            <div><dt>Who sees it</dt><dd>The Harbour Ride dispatch team and your driver. Emails are delivered by our email provider. We don&apos;t sell or share it.</dd></div>
            <div><dt>On this device</dt><dd>If you tick &ldquo;Remember my details&rdquo;, your name, number and email are kept in this browser only. Address searches go through our server to OpenStreetMap-based services.</dd></div>
            <div><dt>How long we keep it</dt><dd>Only as long as we need it to run the trip and keep basic records.</dd></div>
            <div><dt>Your choice</dt><dd>Call {BUSINESS.phone} to see, correct or delete what we hold about you.</dd></div>
          </dl>
        </section>
      </main>

      <footer className="foot">
        <p>Harbour Ride is a booking prototype by Arshpreet Singh, built with Next.js, MapLibre and Resend. Maps &copy; OpenStreetMap contributors, routes by OSRM, search by Photon. <a href="https://github.com/Arshpreet62/taxi_app" target="_blank" rel="noopener">Read the code on GitHub<span className="vh"> (opens in a new tab)</span></a></p>
        <p>Bookings and questions: <a href={BUSINESS.tel}>{BUSINESS.phone}</a> · <a href="#privacy">Privacy</a></p>
      </footer>
    </>
  )
}
