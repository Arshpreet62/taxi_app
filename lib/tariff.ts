// The tariff, shared by the page and the API so the meter and the email always agree.

export type CarId = 'sedan' | 'wagon' | 'maxi'

export type Car = {
  id: CarId
  name: string
  short: string
  seats: number
  ratePerKm: number
  minimumFare: number
}

export const CARS: Car[] = [
  { id: 'sedan', name: 'Sedan', short: 'Sedan', seats: 4, ratePerKm: 2.2, minimumFare: 42 },
  { id: 'wagon', name: 'Station wagon', short: 'Wagon', seats: 5, ratePerKm: 2.6, minimumFare: 50 },
  { id: 'maxi', name: 'Maxi cab', short: 'Maxi', seats: 11, ratePerKm: 3.4, minimumFare: 68 },
]

export const CAR_IDS = CARS.map((c) => c.id) as [CarId, ...CarId[]]

// Placeholder flag fall: the owner should confirm it (see README).
export const FLAG_FALL = Number(process.env.NEXT_PUBLIC_FLAG_FALL ?? 3.6)
export const QUOTE_MINUTES = 15
export const MAX_PASSENGERS = Math.max(...CARS.map((c) => c.seats))

export const carById = (id: CarId) => CARS.find((c) => c.id === id) as Car

export type Fare = { total: number; minimumApplies: boolean }

// The old server added the minimum on top of every trip: max(min, min + km × rate).
// A taximeter starts at the flag fall and the minimum is a floor.
export function fare(carId: CarId, distanceKm: number): Fare {
  const car = carById(carId)
  const metered = FLAG_FALL + distanceKm * car.ratePerKm
  return { total: Math.round(Math.max(car.minimumFare, metered) * 100) / 100, minimumApplies: metered < car.minimumFare }
}

export const allFares = (distanceKm: number) =>
  Object.fromEntries(CARS.map((c) => [c.id, fare(c.id, distanceKm).total])) as Record<CarId, number>

export const money = (n: number) => n.toFixed(2)

// The cheapest car with enough seats.
export const carFor = (passengers: number) => CARS.find((c) => c.seats >= passengers) ?? CARS[CARS.length - 1]
