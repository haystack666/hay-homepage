import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { NoteListResponse } from '../../lib/types'
import { AdminNotesPage } from './AdminNotesPage'

vi.mock('../../lib/api', () => ({
  archiveNote: vi.fn(),
  deleteAdminNote: vi.fn(),
  getAdminNotes: vi.fn(),
  logout: vi.fn(),
  publishNote: vi.fn(),
}))

const adminApi = api as unknown as {
  archiveNote: ReturnType<typeof vi.fn>
  deleteAdminNote: ReturnType<typeof vi.fn>
  getAdminNotes: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  publishNote: ReturnType<typeof vi.fn>
}

const response: NoteListResponse = {
  items: [
    {
      id: 1,
      slug: 'draft-note',
      title: 'Draft Note',
      excerpt: 'Draft excerpt',
      status: 'draft',
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
      tags: [],
      readingMinutes: 1,
    },
    {
      id: 2,
      slug: 'published-note',
      title: 'Published Note',
      excerpt: 'Published excerpt',
      status: 'published',
      publishedAt: '2026-09-04T12:00:00Z',
      createdAt: '2026-09-04T12:00:00Z',
      updatedAt: '2026-09-04T12:00:00Z',
      tags: [],
      readingMinutes: 2,
    },
    {
      id: 3,
      slug: 'archived-note',
      title: 'Archived Note',
      excerpt: 'Archived excerpt',
      status: 'archived',
      publishedAt: '2026-09-03T12:00:00Z',
      createdAt: '2026-09-03T12:00:00Z',
      updatedAt: '2026-09-03T12:00:00Z',
      tags: [],
      readingMinutes: 2,
    },
  ],
  page: 1,
  pageSize: 12,
  total: 3,
  totalPages: 1,
}

const renderPage = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/admin/notes']}
    >
      <Routes>
        <Route path="/admin/notes" element={<AdminNotesPage />} />
        <Route path="/admin/notes/new" element={<p>New note editor</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AdminNotesPage', () => {
  beforeEach(() => {
    adminApi.getAdminNotes.mockResolvedValue(response)
    adminApi.publishNote.mockResolvedValue(response.items[0])
    adminApi.archiveNote.mockResolvedValue(response.items[1])
    adminApi.deleteAdminNote.mockResolvedValue(undefined)
    adminApi.logout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists notes with status and links to the editor', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Notes workspace' })).toBeVisible()
    expect(screen.getByText('Draft Note')).toBeVisible()
    expect(screen.getByText('Published Note')).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Draft' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Published' })).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'New note' }))
    expect(await screen.findByText('New note editor')).toBeVisible()
  })

  it('publishes a draft after confirmation and refreshes the list', async () => {
    renderPage()
    await screen.findByText('Draft Note')

    fireEvent.click(screen.getByRole('button', { name: 'Publish Draft Note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Publish note' })
    expect(dialog).toHaveTextContent('Draft Note')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(adminApi.publishNote).toHaveBeenCalledWith(1))
    expect(adminApi.getAdminNotes).toHaveBeenCalledTimes(2)
  })

  it('archives a published note after confirmation', async () => {
    renderPage()
    await screen.findByText('Published Note')

    fireEvent.click(screen.getByRole('button', { name: 'Archive Published Note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Archive note' })
    expect(dialog).toHaveTextContent('Published Note')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(adminApi.archiveNote).toHaveBeenCalledWith(2))
  })

  it('republishes an archived note after confirmation', async () => {
    renderPage()
    await screen.findByText('Archived Note')

    fireEvent.click(screen.getByRole('button', { name: 'Republish Archived Note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Republish note' })
    expect(dialog).toHaveTextContent('Archived Note')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Republish' }))

    await waitFor(() => expect(adminApi.publishNote).toHaveBeenCalledWith(3))
  })

  it('deletes an archived note after confirmation', async () => {
    renderPage()
    await screen.findByText('Archived Note')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Archived Note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete note' })
    expect(dialog).toHaveTextContent('Archived Note')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(adminApi.deleteAdminNote).toHaveBeenCalledWith(3))
    expect(adminApi.getAdminNotes).toHaveBeenCalledTimes(2)
  })
})
