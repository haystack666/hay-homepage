import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { NoteDetail } from '../../lib/types'
import { AdminNoteEditorPage } from './AdminNoteEditorPage'

vi.mock('../../lib/api', () => ({
  createAdminNote: vi.fn(),
  getAdminNote: vi.fn(),
  publishNote: vi.fn(),
  updateAdminNote: vi.fn(),
}))

const adminApi = api as unknown as {
  createAdminNote: ReturnType<typeof vi.fn>
  getAdminNote: ReturnType<typeof vi.fn>
  publishNote: ReturnType<typeof vi.fn>
  updateAdminNote: ReturnType<typeof vi.fn>
}

const savedNote: NoteDetail = {
  id: 3,
  slug: 'a-new-note',
  title: 'A New Note',
  excerpt: 'A short excerpt.',
  contentMarkdown: '## A thought\n\nUseful details.',
  status: 'draft',
  createdAt: '2026-09-06T12:00:00Z',
  updatedAt: '2026-09-06T12:00:00Z',
  tags: [{ name: 'Build', slug: 'build' }],
  readingMinutes: 1,
}

const publishedNote: NoteDetail = {
  ...savedNote,
  status: 'published',
  publishedAt: '2026-09-06T12:00:00Z',
}

const archivedNote: NoteDetail = {
  ...savedNote,
  status: 'archived',
  publishedAt: '2026-09-06T12:00:00Z',
}

const renderPage = (initialEntry = '/admin/notes/new') =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route path="/admin/notes/new" element={<AdminNoteEditorPage />} />
        <Route path="/admin/notes/:id/edit" element={<AdminNoteEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('AdminNoteEditorPage', () => {
  beforeEach(() => {
    adminApi.createAdminNote.mockResolvedValue(savedNote)
    adminApi.updateAdminNote.mockResolvedValue(savedNote)
    adminApi.publishNote.mockResolvedValue({ ...savedNote, status: 'published' })
    adminApi.getAdminNote.mockResolvedValue(savedNote)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates required fields before saving', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Title is required.')).toBeVisible()
    expect(adminApi.createAdminNote).not.toHaveBeenCalled()
  })

  it('previews Markdown and saves a new draft', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A New Note' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'a-new-note' } })
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'A short excerpt.' } })
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Build' } })
    fireEvent.change(screen.getByLabelText('Markdown'), {
      target: { value: '## A thought\n\nUseful details.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('heading', { name: 'A thought' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Markdown' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(adminApi.createAdminNote).toHaveBeenCalledWith({
        title: 'A New Note',
        slug: 'a-new-note',
        excerpt: 'A short excerpt.',
        contentMarkdown: '## A thought\n\nUseful details.',
        tags: ['Build'],
      }),
    )
    expect(await screen.findByText('Draft saved.')).toBeVisible()
  })

  it('requires confirmation before publishing a saved draft', async () => {
    renderPage('/admin/notes/3/edit')
    await screen.findByDisplayValue('A New Note')

    fireEvent.click(screen.getByRole('button', { name: 'Publish note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Publish note' })
    expect(dialog).toHaveTextContent('A New Note')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(adminApi.publishNote).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Note published.')).toBeVisible()
  })

  it('shows a republish action and save button for a published note', async () => {
    adminApi.getAdminNote.mockResolvedValue(publishedNote)
    renderPage('/admin/notes/3/edit')
    await screen.findByDisplayValue('A New Note')

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Republish note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Republish note' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Republish' }))

    await waitFor(() => expect(adminApi.publishNote).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Note republished.')).toBeVisible()
  })

  it('shows a republish action for an archived note', async () => {
    adminApi.getAdminNote.mockResolvedValue(archivedNote)
    renderPage('/admin/notes/3/edit')
    await screen.findByDisplayValue('A New Note')

    fireEvent.click(screen.getByRole('button', { name: 'Republish note' }))

    const dialog = await screen.findByRole('dialog', { name: 'Republish note' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Republish' }))

    await waitFor(() => expect(adminApi.publishNote).toHaveBeenCalledWith(3))
  })
})
