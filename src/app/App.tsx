import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './router'
import { useAuth } from '@/features/auth/hooks/useAuth'

function AuthInitializer() {
  useAuth()
  return null
}

export function App() {
  return (
    <Providers>
      <AuthInitializer />
      <RouterProvider router={router} />
    </Providers>
  )
}
