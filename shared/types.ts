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
  imageUrl?: string
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

export interface ManagedBike extends Bike {
  active: boolean
  hasUploadedImage: boolean
}

export interface BikeInput extends Omit<Bike, 'id'> {
  active: boolean
  image?: string | null
}

export interface Account {
  id: string
  name: string
  email: string
  role: 'customer' | 'admin'
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface BookingRecord extends RentalSearch {
  id: string
  bikeId: string
  bikeName: string
  riderName: string
  riderEmail: string
  phone: string
  days: number
  dailyRate: number
  total: number
  status: BookingStatus
  createdAt: string
}

export interface BookingQuote {
  days: number
  dailyRate: number
  total: number
}

export interface BookingInput extends RentalSearch {
  bikeId: string
  riderName: string
  phone: string
  dailyRate: number
  requestKey: string
  agreement: boolean
}
