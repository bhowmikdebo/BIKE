export type Category = 'Sports Bikes' | 'Cruisers' | 'Scooters' | 'Adventure Bikes' | 'Commuter Bikes'
export type Transmission = 'Manual' | 'Automatic'

export interface Bike {
  id: string
  brand: string
  model: string
  category: Category
  engine: number
  transmission: Transmission
  mileage: number
  fuel: 'Petrol'
  seats: number
  price: number
  cities: string[]
  description: string
  features: string[]
}

export interface RentalSearch {
  city: string
  pickup: string
  returnDate: string
}

export interface Filters extends RentalSearch {
  query: string
  category: string
  brand: string
  maxPrice: string
  engine: string
  transmission: string
}
