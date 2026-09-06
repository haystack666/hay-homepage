import { expect, test } from '@playwright/test'
import { BASE_URL, createPublishedNote } from './support'

const publicNote = {
  slug: `browser-systems-note-${Date.now()}`,
  title: 'Browser Systems Note',
  excerpt: 'A note seeded for browser acceptance.',
  contentMarkdown: '# Browser Systems\n\nA useful public note.',
  tags: ['Browser'],
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: BASE_URL })
  await createPublishedNote(api, publicNote)
  await api.dispose()
})

test('shows the Signal poster, current section, and latest note on desktop', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MAKE USEFUL THINGS.' })).toBeVisible()
  await expect(page.locator('.signal-node-notes')).toBeVisible()
  await expect(page.getByText('Building small software with a long half-life.')).toBeVisible()
  await expect(page.getByRole('link', { name: publicNote.title, exact: true })).toBeVisible()

  const field = page.getByTestId('signal-field')
  await expect(field).toBeVisible()
  const canvas = field.locator('canvas')
  await expect(canvas).toBeVisible()
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox?.width).toBeGreaterThan(0)
  expect(canvasBox?.height).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('responds to poster pointer movement without blocking Signal links', async ({ page }) => {
  await page.goto('/')

  const poster = page.getByTestId('signal-poster')
  const posterBox = await poster.boundingBox()
  expect(posterBox).not.toBeNull()

  await page.mouse.move(
    posterBox!.x + posterBox!.width * 0.75,
    posterBox!.y + posterBox!.height * 0.25,
  )

  await expect.poll(() =>
    poster.evaluate((element) => ({
      x: element.style.getPropertyValue('--signal-pointer-x'),
      y: element.style.getPropertyValue('--signal-pointer-y'),
    })),
  ).toEqual({ x: '0.5', y: '-0.5' })

  await page.locator('.signal-node-links').click()
  await expect(page.locator('#links')).toBeInViewport()
})

test('keeps Signal nodes keyboard-focusable with visible focus styling', async ({ page }) => {
  await page.goto('/')

  for (const selector of ['.signal-node-now', '.signal-node-notes', '.signal-node-links']) {
    const node = page.locator(selector)
    await node.focus()
    await expect(node).toBeFocused()
    await expect(node).toHaveCSS('border-color', 'rgb(184, 255, 61)')
  }
})

test('fits the poster without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.locator('.signal-node-notes')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('keeps content static when reduced motion is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const poster = page.getByTestId('signal-poster')
  const field = page.getByTestId('signal-field')
  await expect(poster).toBeVisible()
  await expect(field).toHaveAttribute('data-signal-field-mode', 'static')
  await page.mouse.move(20, 20)
  await page.mouse.move(700, 500)

  await expect(poster).toHaveCSS('--orbit-x', '0px')
  await expect(poster).toHaveCSS('--orbit-y', '0px')
  await expect(poster).toHaveCSS('--signal-pointer-x', '0')
  await expect(poster).toHaveCSS('--signal-pointer-y', '0')
  await expect(page.locator('.signal-node-notes')).toBeVisible()

  const notesNode = page.locator('.signal-node-notes')
  await notesNode.focus()
  await expect(notesNode).toBeFocused()
  await expect(notesNode).toHaveCSS('border-color', 'rgb(184, 255, 61)')
})

test('does not request the admin chunk on a public page', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  await page.goto('/')

  expect(requests.some((url) => /AdminRoutes-[^/]+\.js$/.test(url))).toBe(false)
})
