import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { logout } from '../../lib/api'

export function AdminLayout() {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate('/admin/login', { replace: true })
      setLoggingOut(false)
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin/notes">
          <span className="admin-brand-dot" aria-hidden="true" />
          HAYSTACK / ADMIN
        </Link>
        <nav className="admin-nav" aria-label="Admin navigation">
          <Link to="/admin/notes">Notes</Link>
          <Link to="/admin/notes/new">New note</Link>
          <Button variant="unstyled" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
