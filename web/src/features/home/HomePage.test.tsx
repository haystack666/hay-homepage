import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { HomePage } from './HomePage'

vi.mock('./SignalField', () => ({
  SignalField: ({ reducedMotion }: { reducedMotion: boolean }) => (
    <div
      data-testid="signal-field"
      data-signal-field-mode={reducedMotion ? 'static' : 'interactive'}
      aria-hidden="true"
    />
  ),
}))

const notesResponse = {
  items: [
    {
      id: 1,
      slug: 'first-note',
      title: 'First Note',
      excerpt: 'A useful note.',
      status: 'published' as const,
      publishedAt: '2026-09-05T12:00:00Z',
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
      tags: [{ name: 'Build', slug: 'build' }],
      readingMinutes: 2,
    },
    {
      id: 2,
      slug: 'second-note',
      title: 'Second Note',
      excerpt: 'Another useful note.',
      status: 'published' as const,
      publishedAt: '2026-09-04T12:00:00Z',
      createdAt: '2026-09-04T12:00:00Z',
      updatedAt: '2026-09-04T12:00:00Z',
      tags: [],
      readingMinutes: 1,
    },
    {
      id: 3,
      slug: 'third-note',
      title: 'Third Note',
      excerpt: 'A third useful note.',
      status: 'published' as const,
      publishedAt: '2026-09-03T12:00:00Z',
      createdAt: '2026-09-03T12:00:00Z',
      updatedAt: '2026-09-03T12:00:00Z',
      tags: [],
      readingMinutes: 3,
    },
  ],
  page: 1,
  pageSize: 12,
  total: 3,
  totalPages: 1,
}

const renderHomePage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <HomePage />
    </MemoryRouter>,
  )

function dispatchPointerMove(element: HTMLElement, clientX: number, clientY: number) {
  const event = new Event('pointermove', { bubbles: true })
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerType: { value: 'mouse' },
  })
  element.dispatchEvent(event)
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getNotes').mockResolvedValue(notesResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes signal links without relying on hover', async () => {
    renderHomePage()

    expect(await screen.findByRole('heading', { name: 'First Note' })).toBeVisible()
    expect(screen.getByText('MAKE USEFUL THINGS.')).toBeVisible()
    expect(screen.getByRole('link', { name: /^NOTES\b/i })).toHaveAttribute('href', '/notes')
    expect(screen.getByRole('link', { name: /now/i })).toHaveAttribute('href', '#now')
    expect(screen.getByRole('link', { name: /links/i })).toHaveAttribute('href', '#links')
  })

  it('renders the three latest notes after loading', async () => {
    renderHomePage()

    expect(await screen.findByRole('heading', { name: 'First Note' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Second Note' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Third Note' })).toBeVisible()
  })

  it('exposes the signal field and interactive poster state', async () => {
    renderHomePage()

    expect(await screen.findByRole('heading', { name: 'First Note' })).toBeVisible()
    expect(screen.getByTestId('signal-field')).toHaveAttribute('aria-hidden', 'true')
    const poster = screen.getByTestId('signal-poster')
    expect(poster).toHaveAttribute('data-signal-motion', 'interactive')

    vi.spyOn(poster, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    })
    dispatchPointerMove(poster, 600, 150)

    await waitFor(() => {
      expect(poster).toHaveStyle('--signal-pointer-x: 0.5')
      expect(poster).toHaveStyle('--signal-pointer-y: -0.5')
    })

    fireEvent.pointerLeave(poster)
    await waitFor(() => {
      expect(poster).toHaveStyle('--signal-pointer-x: 0')
      expect(poster).toHaveStyle('--signal-pointer-y: 0')
    })
  })

  it('shows a retry action when notes cannot load', async () => {
    const request = vi.mocked(api.getNotes)
    request.mockRejectedValueOnce(new Error('network unavailable'))
    renderHomePage()

    expect(await screen.findByText('Notes are offline right now.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry notes' })).toBeVisible()
  })

  it('keeps the orbit static when reduced motion is enabled', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    renderHomePage()
    await screen.findByRole('heading', { name: 'First Note' })
    const poster = screen.getByTestId('signal-poster')
    expect(poster).toHaveAttribute('data-signal-motion', 'static')
    expect(screen.getByTestId('signal-field')).toHaveAttribute('data-signal-field-mode', 'static')
    dispatchPointerMove(poster, 200, 200)
    await waitFor(() => {
      expect(poster).toHaveStyle('--orbit-x: 0px')
      expect(poster).toHaveStyle('--orbit-y: 0px')
      expect(poster).toHaveStyle('--signal-pointer-x: 0')
      expect(poster).toHaveStyle('--signal-pointer-y: 0')
    })
  })
})
