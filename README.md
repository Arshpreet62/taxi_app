# Harbour Ride

Sydney taxi bookings where the fare is the product: the page is a taximeter. Pick a trip and a car, the seven-segment meter counts up to the fare, the price is locked for 15 minutes while you add your details, and booking prints a docket and emails dispatch and the passenger.

One Next.js app (App Router, TypeScript) that deploys to Vercel as is. It replaces the earlier Vite client and Express server.

## Run it

```bash
npm install
cp .env.example .env.local   # optional for local use
npm run dev                  # http://localhost:3000
```

With no `RESEND_API_KEY`, booking emails are printed to the terminal instead of being sent, so the whole flow works locally with no accounts.

`npm run build`, `npm run lint` and `npm run typecheck` should all pass before a deploy.

## Deploy to Vercel

1. Import the repo in Vercel (framework preset: Next.js, no build settings to change).
2. Add the environment variables from `.env.example`. The ones that matter:
   - `QUOTE_SECRET`: required in production. Bookings fail without it.
   - `RESEND_API_KEY`, `BOOKING_FROM`, `BOOKING_TO`: verify your sending domain in Resend first. Until then, `onboarding@resend.dev` works but only delivers to your own Resend login address.
   - `NEXT_PUBLIC_BUSINESS_PHONE` and `NEXT_PUBLIC_SITE_URL`.
3. Deploy, then open `/api/health`: it should say `"email":"resend"`.

## How it works

| Part | Where |
| --- | --- |
| Page shell, How it works, Privacy | `app/page.tsx`, `app/layout.tsx`, `app/globals.css` |
| Booking console (state, steps, price lock) | `components/BookingConsole.tsx` |
| Meter, car art, address search, map | `components/Meter.tsx`, `CarArt.tsx`, `AddressCombobox.tsx`, `TripMap.tsx` |
| Tariff and fares (shared by page and API) | `lib/tariff.ts` |
| Address search, reverse lookup, routing | `lib/geo.ts` → `/api/places`, `/api/reverse`, `/api/estimate` |
| Signed quotes | `lib/quote.ts` |
| Booking, emails, calendar file | `/api/bookings`, `lib/email/*` |
| Sydney time handling | `lib/time.ts` |

- **Estimate.** `/api/estimate` routes the trip with OSRM and returns every car's fare plus a quote token: the trip and fares, HMAC-signed with `QUOTE_SECRET`, valid for 15 minutes. Nothing is kept in server memory, which matters on serverless, where each request can hit a different instance. If routing is down, the estimate falls back to a straight line × 1.3 and is marked "approx." on the meter, on the map (dashed route) and in the dispatch email.
- **Booking.** `/api/bookings` checks the token's signature and expiry, so pickup, drop-off and price come from the token, not the browser. It validates the passenger details (Australian phone numbers are normalised), then sends two emails through Resend: one to dispatch (reply goes to the passenger, with a Google Maps link) and a confirmation to the passenger (with an `.ics` file for scheduled rides). The reference and Resend's idempotency key both come from a hash of the booking, so a double tap sends once and shows the same reference. A hidden honeypot field and a per-connection limit (5 bookings per 10 minutes) keep casual spam out.
- **Scheduling.** Pickup times are Sydney time, whatever the time zone of the device or the server. Vercel runs in UTC. The page says "Sydney time" when the device is elsewhere.
- **Map.** MapLibre GL with OpenFreeMap's vector tiles, recoloured at runtime from the page's own colour tokens, so it follows day and night shift. Tap the map or a popular stop to set the pickup or drop-off, drag a pin to move it, and the taxi drives the road route. MapLibre's worker is copied to `public/` by `scripts/copy-map-worker.mjs` before `dev` and `build`.

## Changes from the first version

- Fare formula fixed. The old server charged `max(min, min + km × rate)`, which adds the minimum on top of every trip: a 10 km sedan came to $64 instead of $42. It is now `max(minimum, flag fall + km × rate)`.
- Booking works on serverless (signed quotes instead of an in-memory map), and passengers now get a confirmation email.
- Address search moved to Photon behind our own API, cached at the CDN. Nominatim's usage policy doesn't allow search-as-you-type, and the old client called it straight from the browser.
- The server now uses the coordinates the passenger picked; it used to geocode the text again.
- One screen instead of a home page plus a three-step wizard. All three cars are priced at once. The price lock is visible, warns under 2 minutes and can be refreshed in place without losing what you typed.
- Passenger count (cars that are too small are switched off), "Use my current location", map taps and draggable pins, a flight number field for airport pickups, "Remember my details" (opt-in, this browser only), shareable trip links (`?from=…&to=…`), and Add to calendar after booking.
- Booking references can no longer collide (`HR-` + 6 random-looking characters, no 0/O or 1/I).

## Check before launch

- **Flag fall.** `$3.60` is a placeholder. Set `NEXT_PUBLIC_FLAG_FALL` to the real figure. The per-km rates and minimums in `lib/tariff.ts` come from the original server.
- **Phone number.** `02 0000 0000` is a placeholder (`NEXT_PUBLIC_BUSINESS_PHONE`).
- **Privacy text** on the page is a draft.
- **Public map services.** Photon, OSRM's demo server and OpenFreeMap are free and fine for a prototype, but they have no uptime promise and fair-use limits, and the OSRM demo has no live traffic. Before real traffic, point `PHOTON_URL`, `OSRM_URL` and `NEXT_PUBLIC_MAP_STYLE` at a paid or self-hosted provider.
- **Rate limit** is per serverless instance. For stronger protection add a Vercel Firewall rule on `/api/bookings`.
- There is no database. Bookings live in the dispatch inbox. A booking list, or lookup and cancel by reference, would need one (for example Vercel Postgres).
