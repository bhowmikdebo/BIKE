import type { Category } from '../types'

export const cities = ['Bengaluru', 'Goa', 'Mumbai', 'New Delhi', 'Pune', 'Jaipur']

export const categories: { name: Category; detail: string; image: string; tone: string }[] = [
  { name: 'Sports Bikes', detail: 'Sharp handling. Big energy.', image: 'duke-390', tone: 'sport' },
  { name: 'Cruisers', detail: 'Take the long way home.', image: 'classic-350', tone: 'cruise' },
  { name: 'Scooters', detail: 'The city, made easy.', image: 'activa-6g', tone: 'scooter' },
  { name: 'Adventure Bikes', detail: 'Go beyond the tarmac.', image: 'himalayan-450', tone: 'adventure' },
  { name: 'Commuter Bikes', detail: 'Make every day a ride.', image: 'mt-15', tone: 'commute' },
]
