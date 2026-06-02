import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, UserRole } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: UserRole[] }) => {
  const { user, isAuthenticated, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full"></div>
          <div className="h-4 bg-emerald-100 rounded w-24"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 px-4">
        <h2 className="text-xl font-bold text-red-600 mb-2">Conta Desativada</h2>
        <p className="text-zinc-600 mb-6 text-center max-w-md">
          Sua conta foi desativada temporariamente. Entre em contato com o administrador do sistema
          para reativá-la.
        </p>
        <Button onClick={signOut} className="bg-emerald-800 text-white hover:bg-emerald-900">
          Voltar ao Login
        </Button>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
