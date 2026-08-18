import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/index.css'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import { AuthProvider } from './hooks/auth'
import { FavoritesProvider } from './hooks/favorites'
import './styles/portal.css'
import './styles/marketplace.css'
import { AccountPage, PortalGuard } from './pages/Account'
import { Admin } from './pages/admin/Admin'
import { MyBookings } from './pages/MyBookings'
import { Booking } from './pages/Booking'
import { About, Contact } from './pages/Company'
import { Details } from './pages/Details'
import { Explore } from './pages/Explore'
import { Home } from './pages/Home'
import { Host } from './pages/Host'
import { ForgotPassword, ResetPassword } from './pages/PasswordRecovery'
import { Storefront } from './pages/Storefront'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><FavoritesProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="bikes" element={<Explore />} />
            <Route path="bikes/:id" element={<Details />} />
            <Route path="booking/:id" element={<Booking />} />
            <Route path="sign-in" element={<AccountPage />} />
            <Route path="register" element={<AccountPage register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="my-bookings" element={<PortalGuard role="customer"><MyBookings /></PortalGuard>} />
            <Route path="host" element={<Host />} />
            <Route path="hosts/:slug" element={<Storefront />} />
            <Route path="admin" element={<PortalGuard role="admin"><Admin /></PortalGuard>} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<div className="container route-empty"><h1>Page not found</h1><EmptyState title="Find your way back" description="This route is unavailable." action={<Link to="/" className="button primary">Back to Home</Link>} /></div>} />
          </Route>
        </Routes>
      </FavoritesProvider></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
