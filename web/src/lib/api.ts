import type {
  AdminNoteListResponse,
  ApiErrorPayload,
  NoteDetail,
  NoteInput,
  NoteListResponse,
  NoteStatus,
  PublicNoteDetail,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? 'request_failed',
      errorPayload?.error?.message ?? 'Request failed',
    )
  }
  return payload as T
}

export function getCsrfToken(): string {
  const token = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('haystack_csrf='))
    ?.split('=')[1]
  return token ? decodeURIComponent(token) : ''
}

export async function getNotes(params: { tag?: string; page?: number } = {}): Promise<NoteListResponse> {
  const query = new URLSearchParams()
  if (params.tag) query.set('tag', params.tag)
  if (params.page) query.set('page', String(params.page))
  const queryString = query.toString()
  return requestJson<NoteListResponse>(`/api/notes${queryString ? `?${queryString}` : ''}`)
}

export function getNote(slug: string): Promise<PublicNoteDetail> {
  return requestJson<PublicNoteDetail>(`/api/notes/${encodeURIComponent(slug)}`)
}

export function getAdminNotes(status?: NoteStatus): Promise<AdminNoteListResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return requestJson<AdminNoteListResponse>(`/api/admin/notes${query}`)
}

export function getAdminNote(id: number): Promise<NoteDetail> {
  return requestJson<NoteDetail>(`/api/admin/notes/${id}`)
}

export function createAdminNote(input: NoteInput): Promise<NoteDetail> {
  return requestJson<NoteDetail>('/api/admin/notes', {
    method: 'POST',
    headers: { 'X-CSRF-Token': getCsrfToken() },
    body: input,
  })
}

export function updateAdminNote(id: number, input: NoteInput): Promise<NoteDetail> {
  return requestJson<NoteDetail>(`/api/admin/notes/${id}`, {
    method: 'PUT',
    headers: { 'X-CSRF-Token': getCsrfToken() },
    body: input,
  })
}

export function publishNote(id: number): Promise<NoteDetail> {
  return requestJson<NoteDetail>(`/api/admin/notes/${id}/publish`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': getCsrfToken() },
  })
}

export function archiveNote(id: number): Promise<NoteDetail> {
  return requestJson<NoteDetail>(`/api/admin/notes/${id}/archive`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': getCsrfToken() },
  })
}

export function deleteAdminNote(id: number): Promise<void> {
  return requestJson<void>(`/api/admin/notes/${id}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': getCsrfToken() },
  })
}

export function login(password: string): Promise<void> {
  return requestJson<void>('/api/admin/session', {
    method: 'POST',
    body: { password },
  })
}

export function logout(): Promise<void> {
  return requestJson<void>('/api/admin/session', {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': getCsrfToken() },
  })
}

export function getSession(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/admin/session')
}
