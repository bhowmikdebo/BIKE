export type Category = 'Sports Bikes' | 'Cruisers' | 'Scooters' | 'Adventure Bikes' | 'Commuter Bikes'
export type Transmission = 'Manual' | 'Automatic'
export type OperatorScope = 'admin' | 'host'

export interface HostIdentity {
  name: string
  slug: string
}

export interface HostProfile extends HostIdentity {
  bio: string
}

export interface HostStorefront {
  host: HostProfile
  bikes: Bike[]
}

export interface BikeRating {
  average: number | null
  count: number
}

export interface BikeReview {
  id: string
  bikeId: string
  bikeName: string
  author: string
  rating: number
  body: string
  createdAt: string
}

export interface BikeReviewPage {
  items: BikeReview[]
  hasMore: boolean
}

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
  host?: HostIdentity | null
  rating?: BikeRating
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
  pickupInstructions?: string
}

export interface BikeInput extends Omit<Bike, 'id' | 'host' | 'rating'> {
  active: boolean
  image?: string | null
  pickupInstructions?: string
}

export interface Account {
  id: string
  name: string
  email: string
  role: 'customer' | 'admin'
  host?: HostProfile | null
}

export interface BikeBlock {
  id: string
  pickup: string
  returnDate: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface BookingRecord extends RentalSearch {
  id: string
  bikeId: string
  bikeName: string
  riderName: string
  riderEmail?: string
  phone?: string
  host?: HostIdentity | null
  pickupInstructions?: string
  days: number
  dailyRate: number
  total: number
  status: BookingStatus
  createdAt: string
  reviewed?: boolean
}

export type BookingNotificationKind = 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'pickup_reminder' | 'return_reminder'

export interface BookingNotification {
  id: string
  bookingId: string
  bikeName: string
  scope: 'rider' | 'host' | 'admin'
  kind: BookingNotificationKind
  createdAt: string
  read: boolean
}

export interface NotificationInbox {
  items: BookingNotification[]
  unread: number
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
