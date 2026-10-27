import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/index.css'
import { Layout } from './components/Layout'
import { FavoritesProvider } from './hooks/favorites'
import { Explore } from './pages/Explore'
import { Details } from './pages/Details'
import { Booking } from './pages/Booking'
import { Home } from './pages/Home'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FavoritesProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="bikes" element={<Explore />} />
            <Route path="bikes/:id" element={<Details />} />
            <Route path="booking/:id" element={<Booking />} />
          </Route>
        </Routes>
      </FavoritesProvider>
    </BrowserRouter>
  </StrictMode>,
)
