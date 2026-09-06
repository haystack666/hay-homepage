import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { AdminLoginPage } from './AdminLoginPage'

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number
    code: string

    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  },
  login: vi.fn(),
}))

const login = api.login

const renderPage = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/admin/login']}
    >
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/notes" element={<p>Notes workspace</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a password before submitting', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter the admin password.')).toBeVisible()
    expect(login).not.toHaveBeenCalled()
  })

  it('signs in and redirects to the notes workspace', async () => {
    vi.mocked(login).mockResolvedValueOnce()
    renderPage()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('secret'))
    expect(await screen.findByText('Notes workspace')).toBeVisible()
  })

  it('shows a recoverable message for invalid credentials', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('invalid credentials'))
    renderPage()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('The password was not accepted.')).toBeVisible()
  })
})
