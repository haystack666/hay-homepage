import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import * as api from './lib/api'
import type { NoteListResponse } from './lib/types'
import { App } from './app/App'

const emptyNotesResponse: NoteListResponse = {
  items: [],
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 0,
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('renders the application root', async () => {
  vi.spyOn(api, 'getNotes').mockResolvedValue(emptyNotesResponse)
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
  expect(await screen.findByText('The archive is quiet for now. That will change.')).toBeVisible()
})
