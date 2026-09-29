import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import './styles/tokens.css'
import './styles/app.css'
import Admin from './routes/admin/Admin'
import Host from './routes/host/Host'
import Play from './routes/play/Play'

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/play', element: <Play /> },
  { path: '/admin/*', element: <Admin /> },
  { path: '/host/:gameId', element: <Host /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
