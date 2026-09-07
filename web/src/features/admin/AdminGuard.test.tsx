import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { AdminGuard } from './AdminGuard'

vi.mock('../../lib/api', () => ({
  getSession: vi.fn(),
}))

const getSession = api.getSession

const renderPage = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/admin/notes']}
    >
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin/notes" element={<p>Protected notes</p>} />
        </Route>
        <Route path="/admin/login" element={<p>Admin login</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders protected content for an authenticated session', async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: true })

    renderPage()

    expect(await screen.findByText('Protected notes')).toBeVisible()
  })

  it('redirects to login when the session check is rejected', async () => {
    vi.mocked(getSession).mockRejectedValue(new Error('unauthenticated'))

    renderPage()

    expect(await screen.findByText('Admin login')).toBeVisible()
    expect(screen.queryByText('Protected notes')).not.toBeInTheDocument()
  })
})
