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
import { Booking } from './pages/Booking'
import { About, Contact } from './pages/Company'
import { Details } from './pages/Details'
import { Explore } from './pages/Explore'
import { Home } from './pages/Home'

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
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<div className="container route-empty"><h1>Page not found</h1><EmptyState title="Find your way back" description="This route is unavailable." action={<Link to="/" className="button primary">Back to Home</Link>} /></div>} />
          </Route>
        </Routes>
      </FavoritesProvider></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
