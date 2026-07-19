import { lazy } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { EmptyState } from '../components/ui'
import { AuthProvider } from '../features/account/auth'
import { PortalGuard } from '../features/account/PortalGuard'
import { FavoritesProvider } from '../hooks/favorites'
import { Home } from '../pages/Home'
import { Layout } from './layout/Layout'

const Explore = lazy(() => import('../features/catalog/Explore').then(module => ({ default: module.Explore })))
const Details = lazy(() => import('../features/catalog/Details').then(module => ({ default: module.Details })))
const Storefront = lazy(() => import('../features/catalog/Storefront').then(module => ({ default: module.Storefront })))
const Booking = lazy(() => import('../features/reservations/BookingPage').then(module => ({ default: module.Booking })))
const MyBookings = lazy(() => import('../features/reservations/MyBookings').then(module => ({ default: module.MyBookings })))
const AccountPage = lazy(() => import('../features/account/AccountPage').then(module => ({ default: module.AccountPage })))
const ForgotPassword = lazy(() => import('../features/account/PasswordRecovery').then(module => ({ default: module.ForgotPassword })))
const ResetPassword = lazy(() => import('../features/account/PasswordRecovery').then(module => ({ default: module.ResetPassword })))
const Host = lazy(() => import('../features/operations/Host').then(module => ({ default: module.Host })))
const Admin = lazy(() => import('../features/operations/Admin').then(module => ({ default: module.Admin })))
const About = lazy(() => import('../pages/Company').then(module => ({ default: module.About })))
const Contact = lazy(() => import('../pages/Company').then(module => ({ default: module.Contact })))

function NotFound() {
  return <div className="container route-empty">
    <h1>Page not found</h1>
    <EmptyState title="Find your way back" description="This route is unavailable."
      action={<Link to="/" className="button primary">Back to Home</Link>} />
  </div>
}

export function App() {
  return <BrowserRouter>
    <AuthProvider>
      <FavoritesProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="bikes" element={<Explore />} />
            <Route path="bikes/:id" element={<Details />} />
            <Route path="booking/:id" element={<Booking />} />
            <Route path="sign-in" element={<AccountPage key="sign-in" />} />
            <Route path="register" element={<AccountPage key="register" register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="my-bookings" element={<PortalGuard role="customer"><MyBookings /></PortalGuard>} />
            <Route path="host" element={<Host />} />
            <Route path="hosts/:slug" element={<Storefront />} />
            <Route path="admin" element={<PortalGuard role="admin"><Admin /></PortalGuard>} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </FavoritesProvider>
    </AuthProvider>
  </BrowserRouter>
}
