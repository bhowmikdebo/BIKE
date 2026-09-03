import type { Bike, Category } from './types.ts'

export const cities = ['Bengaluru', 'Goa', 'Mumbai', 'New Delhi', 'Pune', 'Jaipur']

export const categories: { name: Category; detail: string; image: string; tone: string }[] = [
  { name: 'Sports Bikes', detail: 'Sharp handling. Big energy.', image: 'duke-390', tone: 'sport' },
  { name: 'Cruisers', detail: 'Take the long way home.', image: 'classic-350', tone: 'cruise' },
  { name: 'Scooters', detail: 'The city, made easy.', image: 'activa-6g', tone: 'scooter' },
  { name: 'Adventure Bikes', detail: 'Go beyond the tarmac.', image: 'himalayan-450', tone: 'adventure' },
  { name: 'Commuter Bikes', detail: 'Make every day a ride.', image: 'mt-15', tone: 'commute' },
]

const fleet: Omit<Bike, 'fuel' | 'seats'>[] = [
  {
    id: 'classic-350', brand: 'Royal Enfield', model: 'Classic 350', category: 'Cruisers', engine: 349,
    transmission: 'Manual', mileage: 35, price: 899, cities: ['Bengaluru', 'Goa', 'New Delhi', 'Jaipur'],
    description: 'A relaxed riding position, a low-slung seat and that familiar single-cylinder beat. The Classic comes into its own on slow mornings and unhurried highway rides.',
    features: ['Upright riding position', 'Classic round headlight', 'Dual-channel ABS'],
  },
  {
    id: 'himalayan-450', brand: 'Royal Enfield', model: 'Himalayan 450', category: 'Adventure Bikes', engine: 452,
    transmission: 'Manual', mileage: 30, price: 1499, cities: ['Bengaluru', 'New Delhi', 'Pune', 'Jaipur'],
    description: 'Tall, composed and made for long days in the saddle. The Himalayan gives you a commanding view of the road when the route turns to gravel.',
    features: ['Upright adventure ergonomics', 'Long-travel suspension', 'Digital instrument cluster'],
  },
  {
    id: 'duke-390', brand: 'KTM', model: 'Duke 390', category: 'Sports Bikes', engine: 399,
    transmission: 'Manual', mileage: 27, price: 1399, cities: ['Bengaluru', 'Mumbai', 'Pune'],
    description: 'A compact street bike with quick steering and a responsive single-cylinder engine. Its light feel makes winding roads the place to spend an afternoon.',
    features: ['Lightweight street chassis', 'LED lighting', 'Digital instrument cluster'],
  },
  {
    id: 'activa-6g', brand: 'Honda', model: 'Activa 6G', category: 'Scooters', engine: 110,
    transmission: 'Automatic', mileage: 48, price: 399, cities: ['Bengaluru', 'Goa', 'Mumbai', 'New Delhi', 'Pune', 'Jaipur'],
    description: 'A compact step-through scooter for quick errands, beach roads and short city trips. The automatic transmission keeps crowded streets simple.',
    features: ['Step-through frame', 'Under-seat storage', 'Automatic transmission'],
  },
  {
    id: 'mt-15', brand: 'Yamaha', model: 'MT-15', category: 'Commuter Bikes', engine: 155,
    transmission: 'Manual', mileage: 45, price: 749, cities: ['Bengaluru', 'Mumbai', 'New Delhi', 'Pune'],
    description: 'An agile street bike with a compact footprint and a lively engine. Easy to place in traffic and comfortable for a quick detour out of town.',
    features: ['Compact street ergonomics', 'LED headlight', 'Digital instrument cluster'],
  },
  {
    id: 'apache-rtr-200', brand: 'TVS', model: 'Apache RTR 200', category: 'Sports Bikes', engine: 198,
    transmission: 'Manual', mileage: 38, price: 799, cities: ['Bengaluru', 'Mumbai', 'New Delhi', 'Pune'],
    description: 'A nimble roadster for everyday routes with enough character for the weekend. The Apache pairs an easy reach to the controls with a sporty riding position.',
    features: ['Sporty roadster ergonomics', 'LED headlight', 'Digital instrument cluster'],
  },
  {
    id: 'dominar-400', brand: 'Bajaj', model: 'Dominar 400', category: 'Cruisers', engine: 373,
    transmission: 'Manual', mileage: 29, price: 1099, cities: ['Bengaluru', 'Goa', 'Mumbai', 'Pune'],
    description: 'A substantial touring roadster with a planted feel on longer stretches. Choose it for a weekend with more open road than city traffic.',
    features: ['Touring riding position', 'LED headlight', 'Dual-channel ABS'],
  },
  {
    id: 'hunter-350', brand: 'Royal Enfield', model: 'Hunter 350', category: 'Commuter Bikes', engine: 349,
    transmission: 'Manual', mileage: 36, price: 849, cities: ['Bengaluru', 'Goa', 'New Delhi', 'Jaipur'],
    description: 'A compact retro roadster with a low seat and easygoing throttle. It fits weekday city trips and leisurely runs to the outskirts.',
    features: ['Low seat height', 'Compact roadster frame', 'Round headlight'],
  },
]

export const seedBikes: Bike[] = fleet.map(bike => ({
  ...bike, fuel: 'Petrol', seats: 2, imageUrl: `/images/${bike.id}.webp`,
}))
export const bikeImage = (bike: Bike) => bike.imageUrl || '/images/fleet-fallback.webp'
export const bikeName = (bike: Bike) => `${bike.brand} ${bike.model}`
