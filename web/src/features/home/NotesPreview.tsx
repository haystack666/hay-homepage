import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNotes } from '../../lib/api'
import type { NoteListItem } from '../../lib/types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(
    new Date(value),
  )
}

type NotesPreviewProps = {
  notes: NoteListItem[]
}

const revealProps = {
  initial: { y: 28 },
  whileInView: { y: 0 },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.72, ease: 'easeOut' as const },
}

export function NotesPreview({ notes }: NotesPreviewProps) {
  return (
    <motion.section {...revealProps} className="home-section notes-preview" id="notes-preview" data-signal-reveal>
      <div className="section-heading-row">
        <div>
          <p className="section-label">Ideas worth keeping</p>
          <h2>Notes</h2>
        </div>
        <Link className="text-link" to="/notes">
          View all notes <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="note-preview-list">
        {notes.map((note) => (
          <article className="note-preview-item" key={note.id}>
            <div className="note-preview-date">
              <span>{formatDate(note.publishedAt ?? note.createdAt)}</span>
              <span>{note.readingMinutes} min read</span>
            </div>
            <div className="note-preview-content">
              <h3>
                <Link to={`/notes/${encodeURIComponent(note.slug)}`}>{note.title}</Link>
              </h3>
              <p>{note.excerpt}</p>
            </div>
            <span className="note-preview-arrow" aria-hidden="true">
              ↗
            </span>
          </article>
        ))}
      </div>
    </motion.section>
  )
}

export function NotesPreviewLoader() {
  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadNotes = () => {
    setLoading(true)
    setError(false)
    getNotes({ page: 1 })
      .then((result) => setNotes(result.items.slice(0, 3)))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNotes()
  }, [])

  if (loading) {
    return (
      <motion.section {...revealProps} className="home-section notes-preview" id="notes-preview" data-signal-reveal aria-busy="true">
        <div className="section-heading-row">
          <div>
            <p className="section-label">Ideas worth keeping</p>
            <h2>Notes</h2>
          </div>
        </div>
        <p className="notes-status">Loading the latest notes…</p>
      </motion.section>
    )
  }

  if (error) {
    return (
      <motion.section {...revealProps} className="home-section notes-preview" id="notes-preview" data-signal-reveal aria-live="polite">
        <div className="section-heading-row">
          <div>
            <p className="section-label">Ideas worth keeping</p>
            <h2>Notes</h2>
          </div>
        </div>
        <p className="notes-status">Notes are offline right now.</p>
        <button className="quiet-button" type="button" onClick={loadNotes}>
          Retry notes
        </button>
      </motion.section>
    )
  }

  if (notes.length === 0) {
    return (
      <motion.section {...revealProps} className="home-section notes-preview" id="notes-preview" data-signal-reveal>
        <div className="section-heading-row">
          <div>
            <p className="section-label">Ideas worth keeping</p>
            <h2>Notes</h2>
          </div>
          <Link className="text-link" to="/notes">
            Open the archive <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <p className="notes-status">The archive is quiet for now. That will change.</p>
      </motion.section>
    )
  }

  return <NotesPreview notes={notes} />
}
