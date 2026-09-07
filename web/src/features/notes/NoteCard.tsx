import { Link } from 'react-router-dom'
import type { NoteListItem } from '../../lib/types'
import { formatNoteDate } from './noteMeta'

type NoteCardProps = {
  note: NoteListItem
}

export function NoteCard({ note }: NoteCardProps) {
  return (
    <article className="note-card">
      <div className="note-card-meta">
        <time dateTime={note.publishedAt ?? note.createdAt}>
          {formatNoteDate(note.publishedAt ?? note.createdAt)}
        </time>
        <span>{note.readingMinutes} min read</span>
      </div>
      <div className="note-card-body">
        <h2 className="note-card-title">
          <Link to={`/notes/${encodeURIComponent(note.slug)}`}>{note.title}</Link>
        </h2>
        <p>{note.excerpt}</p>
        <div className="note-card-tags" aria-label={`${note.title} tags`}>
          {note.tags.map((tag) => (
            <Link
              aria-label={`Filter by ${tag.name}`}
              key={tag.slug}
              to={`/notes?tag=${encodeURIComponent(tag.slug)}&page=1`}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>
      <Link
        className="note-card-arrow"
        to={`/notes/${encodeURIComponent(note.slug)}`}
        aria-label={`Read ${note.title}`}
      >
        ↗
      </Link>
    </article>
  )
}
