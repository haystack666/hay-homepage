import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getNotes } from '../../lib/api'
import type { NoteListResponse, Tag } from '../../lib/types'
import { NoteCard } from './NoteCard'

export function NotesListPage() {
  const [searchParams] = useSearchParams()
  const tag = searchParams.get('tag') ?? ''
  const page = parsePage(searchParams.get('page'))
  const [result, setResult] = useState<NoteListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadNotes = useCallback(() => {
    setLoading(true)
    setError(false)
    getNotes({ tag: tag || undefined, page })
      .then(setResult)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [page, tag])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const tags = useMemo(() => collectTags(result?.items ?? []), [result?.items])

  return (
    <main className="notes-page notes-list-page">
      <header className="notes-page-header">
        <Link className="notes-brand" to="/" aria-label="Haystack home">
          <span className="notes-brand-dot" aria-hidden="true" />
          HAYSTACK
        </Link>
        <div>
          <p className="notes-kicker">Archive / 001</p>
          <h1>Notes</h1>
          <p className="notes-page-intro">Ideas worth keeping, written while building useful things.</p>
        </div>
        <Link className="notes-header-link" to="/">
          Back home <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="notes-list-shell">
        <nav className="notes-filters" aria-label="Note filters">
          <span className="notes-filter-label">Filter</span>
          <Link className={!tag ? 'is-active' : undefined} to={notesHref()}>
            All notes
          </Link>
          {tags.map((item) => (
            <Link
              className={item.slug === tag ? 'is-active' : undefined}
              key={item.slug}
              to={notesHref(item.slug)}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {loading && (
          <section className="notes-state" aria-busy="true">
            <p>Loading the archive…</p>
          </section>
        )}

        {!loading && error && (
          <section className="notes-state" aria-live="polite">
            <h2>The archive is offline right now.</h2>
            <p>Try again when the signal returns.</p>
            <button className="quiet-button" type="button" onClick={loadNotes}>
              Retry notes
            </button>
          </section>
        )}

        {!loading && !error && result?.items.length === 0 && (
          <section className="notes-state" aria-live="polite">
            <h2>Nothing is filed here yet.</h2>
            <p>There are no published notes matching this filter.</p>
            {tag && (
              <Link className="notes-state-link" to={notesHref()}>
                Clear filter <span aria-hidden="true">↗</span>
              </Link>
            )}
          </section>
        )}

        {!loading && !error && result && result.items.length > 0 && (
          <>
            <div className="note-card-list">
              {result.items.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} tag={tag} />
          </>
        )}
      </div>
    </main>
  )
}

type PaginationProps = {
  page: number
  totalPages: number
  tag: string
}

function Pagination({ page, totalPages, tag }: PaginationProps) {
  if (totalPages < 2) return null

  return (
    <nav className="notes-pagination" aria-label="Notes pagination">
      {page > 1 ? <Link to={notesHref(tag, page - 1)}>Previous page</Link> : <span />}
      <span>
        {page} / {totalPages}
      </span>
      {page < totalPages ? <Link to={notesHref(tag, page + 1)}>Next page</Link> : <span />}
    </nav>
  )
}

function collectTags(items: NoteListResponse['items']): Tag[] {
  const tags = new Map<string, Tag>()
  for (const note of items) {
    for (const item of note.tags) {
      tags.set(item.slug, item)
    }
  }
  return [...tags.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function notesHref(tag = '', page = 1) {
  const params = new URLSearchParams()
  if (tag) params.set('tag', tag)
  if (tag || page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/notes${query ? `?${query}` : ''}`
}
