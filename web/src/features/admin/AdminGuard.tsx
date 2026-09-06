import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getSession } from '../../lib/api'

export function AdminGuard() {
  const [state, setState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading')

  useEffect(() => {
    getSession()
      .then(() => setState('authenticated'))
      .catch(() => setState('anonymous'))
  }, [])

  if (state === 'loading') {
    return (
      <main className="admin-loading-page" aria-busy="true">
        <p>Checking session…</p>
      </main>
    )
  }

  if (state === 'anonymous') {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}
