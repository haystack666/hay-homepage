import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { NoteDetail, NoteListItem, PublicNoteDetail } from '../../lib/types'
import { NoteDetailPage } from './NoteDetailPage'

const noteBase: NoteDetail = {
  id: 2,
  slug: 'quiet-software',
  title: 'Quiet Software',
  excerpt: 'A small argument for tools that stay out of the way.',
  contentMarkdown: `## A useful shape

A [safe link](https://example.com) and a [bad link](javascript:alert(1)).

- [x] Keep the interface quiet
- [ ] Leave room for thought

<script>alert('not rendered')</script>

![unsafe image](javascript:alert(1))`,
  status: 'published',
  publishedAt: '2026-09-05T12:00:00Z',
  createdAt: '2026-09-05T12:00:00Z',
  updatedAt: '2026-09-05T12:00:00Z',
  tags: [{ name: 'Build', slug: 'build' }],
  readingMinutes: 3,
}

const newerNote: NoteListItem = {
  id: 1,
  slug: 'newest-note',
  title: 'Newest Note',
  excerpt: 'The newest note.',
  status: 'published',
  publishedAt: '2026-09-06T12:00:00Z',
  createdAt: '2026-09-06T12:00:00Z',
  updatedAt: '2026-09-06T12:00:00Z',
  tags: [],
  readingMinutes: 1,
}

const olderNote: NoteListItem = {
  id: 3,
  slug: 'oldest-note',
  title: 'Oldest Note',
  excerpt: 'The oldest note.',
  status: 'published',
  publishedAt: '2026-09-04T12:00:00Z',
  createdAt: '2026-09-04T12:00:00Z',
  updatedAt: '2026-09-04T12:00:00Z',
  tags: [],
  readingMinutes: 1,
}

const note: PublicNoteDetail = {
  ...noteBase,
  neighbors: {
    newer: newerNote,
    older: olderNote,
  },
}

const renderPage = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={['/notes/quiet-software']}
    >
      <Routes>
        <Route path="/notes/:slug" element={<NoteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('NoteDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getNote').mockResolvedValue(note)
    vi.spyOn(api, 'getNotes')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.title = ''
    document.head.querySelector('meta[name="description"]')?.remove()
    document.head.querySelector('link[rel="canonical"]')?.remove()
  })

  it('renders note content, metadata, safe markdown, and neighboring notes', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Quiet Software' })).toBeVisible()
    expect(api.getNotes).not.toHaveBeenCalled()
    expect(screen.getByText('A small argument for tools that stay out of the way.')).toBeVisible()
    expect(screen.getByText('Sep 05, 2026')).toBeVisible()
    expect(screen.getByText('3 min read')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'A useful shape' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
    expect(screen.queryByRole('link', { name: 'bad link' })).not.toBeInTheDocument()
    expect(screen.queryByText(/not rendered/)).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Completed task' })).toBeChecked()
    expect(screen.getByRole('link', { name: /newer note/i })).toHaveAttribute(
      'href',
      '/notes/newest-note',
    )
    expect(screen.getByRole('link', { name: /older note/i })).toHaveAttribute(
      'href',
      '/notes/oldest-note',
    )
    expect(screen.getByRole('link', { name: /back to notes/i })).toHaveAttribute(
      'href',
      '/notes',
    )
  })

  it('updates document metadata for sharing and search', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Quiet Software' })

    await waitFor(() => {
      expect(document.title).toBe('Quiet Software — Haystack')
      expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        note.excerpt,
      )
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        window.location.origin + '/notes/quiet-software',
      )
    })
  })

  it('shows a not found state when the note cannot be loaded', async () => {
    vi.mocked(api.getNote).mockRejectedValueOnce(new api.ApiError(404, 'not_found', 'note not found'))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Note not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: /back to notes/i })).toHaveAttribute(
      'href',
      '/notes',
    )
  })
})
