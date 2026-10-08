// Popular stops, offered as quick picks before the passenger types anything.

export type Place = { label: string; area?: string; lat: number; lng: number }

export const POPULAR: Place[] = [
  { label: 'Sydney Airport', area: 'Mascot', lat: -33.9399, lng: 151.1753 },
  { label: 'Circular Quay', area: 'Sydney CBD', lat: -33.8611, lng: 151.2111 },
  { label: 'Central Station', area: 'Haymarket', lat: -33.8832, lng: 151.2065 },
  { label: 'Barangaroo', area: 'Sydney CBD', lat: -33.8615, lng: 151.2015 },
  { label: 'Bondi Beach', area: 'Bondi', lat: -33.8915, lng: 151.2767 },
  { label: 'Coogee Beach', area: 'Coogee', lat: -33.9205, lng: 151.2577 },
  { label: 'UNSW Kensington', area: 'Kensington', lat: -33.9173, lng: 151.2313 },
  { label: 'RPA Hospital', area: 'Camperdown', lat: -33.8893, lng: 151.183 },
  { label: 'Sydney Olympic Park', area: 'Homebush Bay', lat: -33.847, lng: 151.069 },
  { label: 'Parramatta Station', area: 'Parramatta', lat: -33.817, lng: 151.0035 },
  { label: 'North Sydney', area: 'North Sydney', lat: -33.8393, lng: 151.2073 },
  { label: 'Chatswood', area: 'Chatswood', lat: -33.7969, lng: 151.1803 },
  { label: 'Taronga Zoo', area: 'Mosman', lat: -33.843, lng: 151.2411 },
  { label: 'Manly Wharf', area: 'Manly', lat: -33.8003, lng: 151.2843 },
]

export const SYDNEY = { lat: -33.8688, lng: 151.2093 }
// Greater Sydney with the Blue Mountains, Central Coast and Illawarra: [west, south, east, north]
export const SERVICE_BBOX = [149.9, -34.8, 151.8, -32.9] as const

export const inServiceArea = ({ lat, lng }: { lat: number; lng: number }) =>
  lng >= SERVICE_BBOX[0] && lng <= SERVICE_BBOX[2] && lat >= SERVICE_BBOX[1] && lat <= SERVICE_BBOX[3]

export const placeText = (p: Place) => (p.area ? `${p.label}, ${p.area}` : p.label)

export const samePlace = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lng - b.lng) < 0.0005

// Airports get a flight-number field.
export const isAirport = (p: Place | null) => Boolean(p && /airport|terminal/i.test(`${p.label} ${p.area ?? ''}`))
