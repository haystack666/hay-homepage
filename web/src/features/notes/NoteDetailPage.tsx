import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, getNote } from '../../lib/api'
import type { NoteNeighbors, PublicNoteDetail } from '../../lib/types'
import { MarkdownArticle } from './MarkdownArticle'
import { clearNoteMetadata, formatNoteDate, updateNoteMetadata } from './noteMeta'

export function NoteDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [note, setNote] = useState<PublicNoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadNote = useCallback(async () => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)
    setNote(null)

    try {
      const loadedNote = await getNote(slug)
      setNote(loadedNote)
    } catch (error) {
      setNotFound(error instanceof ApiError && error.status === 404)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadNote()
  }, [loadNote])

  useEffect(() => {
    if (!note) return
    updateNoteMetadata(note)
    return clearNoteMetadata
  }, [note])

  if (loading) {
    return (
      <main className="notes-page note-detail-page">
        <section className="notes-state" aria-busy="true">
          <p>Loading note…</p>
        </section>
      </main>
    )
  }

  if (notFound || !note) {
    return (
      <main className="notes-page note-detail-page">
        <section className="notes-state" aria-live="polite">
          <h1>Note not found</h1>
          <p>This note is not part of the public archive.</p>
          <Link className="notes-state-link" to="/notes">
            Back to notes <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="notes-page note-detail-page">
      <div className="note-detail-shell">
        <Link className="note-back-link" to="/notes">
          ← Back to notes
        </Link>
        <article>
          <header className="note-detail-header">
            <p className="notes-kicker">Notes / Published</p>
            <h1>{note.title}</h1>
            <p className="note-detail-excerpt">{note.excerpt}</p>
            <div className="note-detail-meta">
              <time dateTime={note.publishedAt ?? note.createdAt}>
                {formatNoteDate(note.publishedAt ?? note.createdAt)}
              </time>
              <span>{note.readingMinutes} min read</span>
              {note.tags.length > 0 && (
                <div className="note-detail-tags" aria-label="Note tags">
                  {note.tags.map((tag) => (
                    <Link key={tag.slug} to={`/notes?tag=${encodeURIComponent(tag.slug)}&page=1`}>
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </header>

          <MarkdownArticle content={note.contentMarkdown} />
        </article>
        <NoteNavigation neighbors={note.neighbors} />
      </div>
    </main>
  )
}

function NoteNavigation({ neighbors }: { neighbors: NoteNeighbors }) {
  if (!neighbors.newer && !neighbors.older) return null

  return (
    <nav className="note-navigation" aria-label="Note navigation">
      {neighbors.newer ? (
        <Link to={`/notes/${encodeURIComponent(neighbors.newer.slug)}`}>
          <span>Newer note</span>
          <strong>{neighbors.newer.title}</strong>
        </Link>
      ) : (
        <span />
      )}
      {neighbors.older ? (
        <Link to={`/notes/${encodeURIComponent(neighbors.older.slug)}`}>
          <span>Older note</span>
          <strong>{neighbors.older.title}</strong>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
