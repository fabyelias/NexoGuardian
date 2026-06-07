import { lazy, Suspense, type ReactNode } from 'react'
import React from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { useAuthStore } from '@/shared/stores/authStore'
import { Loader2 } from 'lucide-react'
import type { UserRole } from '@/shared/types/enums'

const DashboardAdmin = lazy(() =>
  import('@/features/dashboard/admin/DashboardAdmin').then(m => ({ default: m.DashboardAdmin }))
)
const DashboardGuard = lazy(() =>
  import('@/features/dashboard/guard/DashboardGuard').then(m => ({ default: m.DashboardGuard }))
)
const MonitoringCenter = lazy(() =>
  import('@/features/monitoring/pages/MonitoringCenter').then(m => ({ default: m.MonitoringCenter }))
)
const IncidentForm = lazy(() =>
  import('@/features/incidents/components/IncidentForm').then(m => ({ default: m.IncidentForm }))
)
const SitesPage = lazy(() =>
  import('@/features/sites/pages/SitesPage').then(m => ({ default: m.SitesPage }))
)
const PersonnelPage = lazy(() =>
  import('@/features/personnel/pages/PersonnelPage').then(m => ({ default: m.PersonnelPage }))
)
const IncidentsPage = lazy(() =>
  import('@/features/incidents/pages/IncidentsPage').then(m => ({ default: m.IncidentsPage }))
)
const IncidentDetailPage = lazy(() =>
  import('@/features/incidents/pages/IncidentDetailPage').then(m => ({ default: m.IncidentDetailPage }))
)
const PatrolsPage = lazy(() =>
  import('@/features/patrols/pages/PatrolsPage').then(m => ({ default: m.PatrolsPage }))
)
const PatrolDetailPage = lazy(() =>
  import('@/features/patrols/pages/PatrolDetailPage').then(m => ({ default: m.PatrolDetailPage }))
)
const GuardLogPage = lazy(() =>
  import('@/features/guard-log/pages/GuardLogPage').then(m => ({ default: m.GuardLogPage }))
)
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then(m => ({ default: m.ReportsPage }))
)
const SchedulingPage = lazy(() =>
  import('@/features/scheduling/pages/SchedulingPage').then(m => ({ default: m.SchedulingPage }))
)
const GuardProfilePage = lazy(() =>
  import('@/features/personnel/pages/GuardProfilePage').then(m => ({ default: m.GuardProfilePage }))
)

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500">Cargando NexoGuard...</p>
      </div>
    </div>
  )
}

function AuthGuard({ allowedRoles, children }: { allowedRoles?: UserRole[]; children?: React.ReactNode }) {
  const { user, profile, isLoading } = useAuthStore()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

function SmartDashboard() {
  const { profile } = useAuthStore()

  if (!profile) return <LoadingScreen />

  switch (profile.role) {
    case 'guard':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <DashboardGuard />
        </Suspense>
      )
    default:
      return (
        <Suspense fallback={<LoadingScreen />}>
          <DashboardAdmin />
        </Suspense>
      )
  }
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: <SmartDashboard />,
            handle: { title: 'Dashboard' },
          },
          {
            path: '/monitoring',
            element: (
              <AuthGuard allowedRoles={['super_admin', 'admin', 'supervisor']}>
                <Suspense fallback={<LoadingScreen />}>
                  <MonitoringCenter />
                </Suspense>
              </AuthGuard>
            ),
            handle: { title: 'Centro de Monitoreo' },
          },
          {
            path: '/incidents',
            element: <Suspense fallback={<LoadingScreen />}><IncidentsPage /></Suspense>,
            handle: { title: 'Incidentes' },
          },
          {
            path: '/incidents/new',
            element: <Suspense fallback={<LoadingScreen />}><IncidentForm /></Suspense>,
            handle: { title: 'Nuevo Incidente' },
          },
          {
            path: '/incidents/:id',
            element: <Suspense fallback={<LoadingScreen />}><IncidentDetailPage /></Suspense>,
            handle: { title: 'Detalle de Incidente' },
          },
          {
            path: '/patrols',
            element: <Suspense fallback={<LoadingScreen />}><PatrolsPage /></Suspense>,
            handle: { title: 'Rondines' },
          },
          {
            path: '/patrols/:id',
            element: <Suspense fallback={<LoadingScreen />}><PatrolDetailPage /></Suspense>,
            handle: { title: 'Detalle de Rondín' },
          },
          {
            path: '/guard-log',
            element: <Suspense fallback={<LoadingScreen />}><GuardLogPage /></Suspense>,
            handle: { title: 'Libro de Guardia' },
          },
          {
            path: '/sites',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <SitesPage />
              </Suspense>
            ),
            handle: { title: 'Objetivos Protegidos' },
          },
          {
            path: '/personnel',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <PersonnelPage />
              </Suspense>
            ),
            handle: { title: 'Personal' },
          },
          {
            path: '/personnel/:id',
            element: (
              <AuthGuard allowedRoles={['super_admin', 'admin', 'supervisor']}>
                <Suspense fallback={<LoadingScreen />}>
                  <GuardProfilePage />
                </Suspense>
              </AuthGuard>
            ),
            handle: { title: 'Perfil del Vigilador' },
          },
          {
            path: '/scheduling',
            element: (
              <AuthGuard allowedRoles={['super_admin', 'admin', 'supervisor']}>
                <Suspense fallback={<LoadingScreen />}>
                  <SchedulingPage />
                </Suspense>
              </AuthGuard>
            ),
            handle: { title: 'Planificación' },
          },
          {
            path: '/reports',
            element: <Suspense fallback={<LoadingScreen />}><ReportsPage /></Suspense>,
            handle: { title: 'Informes' },
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
