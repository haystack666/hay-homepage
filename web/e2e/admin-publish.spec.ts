import { expect, test } from '@playwright/test'
import { ADMIN_PASSWORD, BASE_URL } from './support'

const note = {
  slug: 'browser-publish-note',
  title: 'Browser Publish Note',
  excerpt: 'A draft created through the browser workflow.',
  contentMarkdown: '# Browser Publish\n\nSaved, published, and archived in a browser test.',
  tags: ['Workflow'],
}

test('creates, publishes, exposes, and archives a note', async ({ page, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: BASE_URL })

  await page.goto('/admin/login')
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/notes$/)

  await page.getByRole('main').getByRole('link', { name: 'New note' }).click()
  await page.getByLabel('Title').fill(note.title)
  await page.getByLabel('Slug').fill(note.slug)
  await page.getByLabel('Excerpt').fill(note.excerpt)
  await page.getByLabel('Tags').fill(note.tags.join(', '))
  await page.getByLabel('Markdown').fill(note.contentMarkdown)
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('status')).toHaveText('Draft saved.')

  const draftResponse = await api.get(`/api/notes/${note.slug}`)
  expect(draftResponse.status()).toBe(404)

  await page.getByRole('button', { name: 'Publish note' }).click()
  const publishDialog = page.getByRole('dialog', { name: 'Publish note' })
  await expect(publishDialog).toBeVisible()
  await publishDialog.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status')).toHaveText('Note published.')

  const publishedResponse = await api.get(`/api/notes/${note.slug}`)
  expect(publishedResponse.status()).toBe(200)
  await expect(publishedResponse.json()).resolves.toMatchObject({
    slug: note.slug,
    title: note.title,
    status: 'published',
  })

  const htmlResponse = await api.get(`/notes/${note.slug}`)
  expect(htmlResponse.status()).toBe(200)
  const html = await htmlResponse.text()
  expect(html).toContain(`<meta property="og:title" content="${note.title}">`)
  expect(html).toContain(`<meta property="og:description" content="${note.excerpt}">`)

  await page.getByRole('link', { name: 'Back to notes' }).click()
  await expect(page.getByRole('heading', { name: 'Notes workspace' })).toBeVisible()
  await page.getByRole('button', { name: `Archive ${note.title}` }).click()
  const archiveDialog = page.getByRole('dialog', { name: 'Archive note' })
  await expect(archiveDialog).toBeVisible()
  await archiveDialog.getByRole('button', { name: 'Archive' }).click()
  await page.getByRole('button', { name: `Republish ${note.title}` }).click()
  const republishDialog = page.getByRole('dialog', { name: 'Republish note' })
  await expect(republishDialog).toBeVisible()
  await republishDialog.getByRole('button', { name: 'Republish' }).click()
  await expect(page.getByRole('cell', { name: 'Published' })).toBeVisible()
  expect((await api.get(`/api/notes/${note.slug}`)).status()).toBe(200)

  await page.getByRole('button', { name: `Archive ${note.title}` }).click()
  const archiveAgainDialog = page.getByRole('dialog', { name: 'Archive note' })
  await expect(archiveAgainDialog).toBeVisible()
  await archiveAgainDialog.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('cell', { name: 'Archived' })).toBeVisible()

  await page.getByRole('button', { name: `Delete ${note.title}` }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Delete note' })
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(note.title)).not.toBeVisible()

  expect((await api.get(`/api/notes/${note.slug}`)).status()).toBe(404)
  await api.dispose()
})
