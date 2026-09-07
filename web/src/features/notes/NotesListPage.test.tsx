import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { NoteListResponse } from '../../lib/types'
import { NotesListPage } from './NotesListPage'

const notesResponse: NoteListResponse = {
  items: [
    {
      id: 1,
      slug: 'useful-systems',
      title: 'Useful Systems',
      excerpt: 'A note about small systems that last.',
      status: 'published',
      publishedAt: '2026-09-05T12:00:00Z',
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
      tags: [
        { name: 'Build', slug: 'build' },
        { name: 'Notes', slug: 'notes' },
      ],
      readingMinutes: 4,
    },
    {
      id: 2,
      slug: 'quiet-tools',
      title: 'Quiet Tools',
      excerpt: 'Why useful tools should disappear into the day.',
      status: 'published',
      publishedAt: '2026-09-04T12:00:00Z',
      createdAt: '2026-09-04T12:00:00Z',
      updatedAt: '2026-09-04T12:00:00Z',
      tags: [{ name: 'Build', slug: 'build' }],
      readingMinutes: 2,
    },
  ],
  page: 1,
  pageSize: 12,
  total: 14,
  totalPages: 2,
}

const renderPage = (entry = '/notes') =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[entry]}
    >
      <NotesListPage />
    </MemoryRouter>,
  )

describe('NotesListPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getNotes').mockResolvedValue(notesResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders published notes with metadata and archive navigation', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Useful Systems' })).toBeVisible()
    expect(screen.getByText('A note about small systems that last.')).toBeVisible()
    expect(screen.getByText('Sep 05, 2026')).toBeVisible()
    expect(screen.getByText('4 min read')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Useful Systems' })).toHaveAttribute(
      'href',
      '/notes/useful-systems',
    )
    expect(screen.getByRole('link', { name: /^build$/i })).toHaveAttribute(
      'href',
      '/notes?tag=build&page=1',
    )
    expect(screen.getByRole('link', { name: /next page/i })).toHaveAttribute(
      'href',
      '/notes?page=2',
    )
  })

  it('requests the tag and page encoded in the URL', async () => {
    renderPage('/notes?tag=build&page=2')

    await screen.findByRole('heading', { name: 'Useful Systems' })
    expect(api.getNotes).toHaveBeenCalledWith({ tag: 'build', page: 2 })
  })

  it('shows a retry action when the archive is unavailable', async () => {
    const request = vi.mocked(api.getNotes)
    request.mockRejectedValueOnce(new Error('network unavailable'))
    renderPage()

    expect(await screen.findByText('The archive is offline right now.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry notes' })).toBeVisible()

    request.mockResolvedValueOnce(notesResponse)
    fireEvent.click(screen.getByRole('button', { name: 'Retry notes' }))

    expect(await screen.findByRole('heading', { name: 'Useful Systems' })).toBeVisible()
  })

  it('shows a clear empty state when a filter has no notes', async () => {
    vi.mocked(api.getNotes).mockResolvedValue({
      ...notesResponse,
      items: [],
      total: 0,
      totalPages: 0,
    })
    renderPage('/notes?tag=unknown')

    expect(await screen.findByText('Nothing is filed here yet.')).toBeVisible()
    expect(screen.getByRole('link', { name: /clear filter/i })).toHaveAttribute(
      'href',
      '/notes',
    )
  })
})
