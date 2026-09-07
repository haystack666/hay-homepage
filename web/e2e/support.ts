import type { APIRequestContext } from '@playwright/test'

export const BASE_URL = 'http://127.0.0.1:18080'
export const ADMIN_PASSWORD = 'password'

export async function createPublishedNote(
  api: APIRequestContext,
  note: { slug: string; title: string; excerpt: string; contentMarkdown: string; tags: string[] },
) {
  const loginResponse = await api.post('/api/admin/session', {
    data: { password: ADMIN_PASSWORD },
    headers: { Origin: BASE_URL },
  })
  await requireSuccessful(loginResponse, 'login')

  const state = await api.storageState()
  const csrfToken = state.cookies.find((cookie) => cookie.name === 'haystack_csrf')?.value
  if (!csrfToken) {
    throw new Error('The test session did not include a CSRF token.')
  }

  const createResponse = await api.post('/api/admin/notes', {
    data: note,
    headers: { Origin: BASE_URL, 'X-CSRF-Token': csrfToken },
  })
  await requireSuccessful(createResponse, 'create note')
  const created = (await createResponse.json()) as { id: number }

  const publishResponse = await api.post(`/api/admin/notes/${created.id}/publish`, {
    headers: { Origin: BASE_URL, 'X-CSRF-Token': csrfToken },
  })
  await requireSuccessful(publishResponse, 'publish note')
}

async function requireSuccessful(response: { ok(): boolean; status(): number; text(): Promise<string> }, action: string) {
  if (!response.ok()) {
    throw new Error(`${action} failed with ${response.status()}: ${await response.text()}`)
  }
}
