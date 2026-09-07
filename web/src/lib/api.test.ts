import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  archiveNote,
  createAdminNote,
  deleteAdminNote,
  getAdminNote,
  getAdminNotes,
  getNotes,
  publishNote,
  updateAdminNote,
} from './api'
import type { NoteInput } from './types'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notes api', () => {
  it('requests published notes with tag and page', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 0 }),
        { status: 200 },
      ),
    )

    await getNotes({ tag: 'build ideas', page: 2 })

    expect(fetch).toHaveBeenCalledWith(
      '/api/notes?tag=build+ideas&page=2',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('turns the unified error envelope into ApiError', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'not_found', message: 'note not found' } }),
        { status: 404 },
      ),
    )

    await expect(getNotes()).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        status: 404,
        code: 'not_found',
        message: 'note not found',
      }),
    )
  })

  it('falls back when the error envelope is malformed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'unexpected failure' }), { status: 500 }),
    )

    await expect(getNotes()).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        status: 500,
        code: 'request_failed',
        message: 'Request failed',
      }),
    )
  })
})

describe('admin notes api', () => {
  const input: NoteInput = {
    title: 'Useful Systems',
    slug: 'useful-systems',
    excerpt: 'A short note.',
    contentMarkdown: '# Useful Systems',
    tags: ['Build'],
  }

  afterEach(() => {
    document.cookie = 'haystack_csrf=; Max-Age=0'
  })

  it('requests admin notes filtered by status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 }), {
        status: 200,
      }),
    )

    await getAdminNotes('draft')

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/notes?status=draft',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('requests one admin note by id', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await getAdminNote(7)

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/notes/7',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('creates a note with JSON and the CSRF token', async () => {
    document.cookie = 'haystack_csrf=csrf-token'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await createAdminNote(input)

    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/notes', expect.anything())
    expect(options?.method).toBe('POST')
    expect(options?.body).toBe(JSON.stringify(input))
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('updates a note with the expected path and method', async () => {
    document.cookie = 'haystack_csrf=csrf-token'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await updateAdminNote(7, input)

    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/notes/7', expect.anything())
    expect(options?.method).toBe('PUT')
    expect(options?.body).toBe(JSON.stringify(input))
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('publishes a note with the CSRF token', async () => {
    document.cookie = 'haystack_csrf=csrf-token'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await publishNote(7)

    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/notes/7/publish', expect.anything())
    expect(options?.method).toBe('POST')
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('archives a note with the CSRF token', async () => {
    document.cookie = 'haystack_csrf=csrf-token'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await archiveNote(7)

    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/notes/7/archive', expect.anything())
    expect(options?.method).toBe('POST')
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('deletes a note with the CSRF token', async () => {
    document.cookie = 'haystack_csrf=csrf-token'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteAdminNote(7)

    const [, options] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/notes/7', expect.anything())
    expect(options?.method).toBe('DELETE')
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token')
  })
})
