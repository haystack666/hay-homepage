import type { NoteDetail } from '../../lib/types'

const siteName = 'Haystack'

export function formatNoteDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function updateNoteMetadata(note: Pick<NoteDetail, 'slug' | 'title' | 'excerpt'>) {
  document.title = `${note.title} — ${siteName}`
  setMetaDescription(note.excerpt)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = new URL(`/notes/${encodeURIComponent(note.slug)}`, window.location.origin).toString()
}

export function clearNoteMetadata() {
  document.title = siteName
  document.head.querySelector('meta[name="description"]')?.remove()
  document.head.querySelector('link[rel="canonical"]')?.remove()
}

function setMetaDescription(content: string) {
  let description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!description) {
    description = document.createElement('meta')
    description.name = 'description'
    document.head.append(description)
  }
  description.content = content
}
