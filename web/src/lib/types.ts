export type NoteStatus = 'draft' | 'published' | 'archived'

export interface Tag {
  name: string
  slug: string
}

export interface NoteListItem {
  id: number
  slug: string
  title: string
  excerpt: string
  status: NoteStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
  tags: Tag[]
  readingMinutes: number
}

export interface NoteDetail extends NoteListItem {
  contentMarkdown: string
}

export interface NoteNeighbors {
  newer: NoteListItem | null
  older: NoteListItem | null
}

export interface PublicNoteDetail extends NoteDetail {
  neighbors: NoteNeighbors
}

export interface NoteListResponse {
  items: NoteListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AdminNoteListResponse {
  items: NoteDetail[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface NoteInput {
  slug: string
  title: string
  excerpt: string
  contentMarkdown: string
  tags: string[]
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
  }
}
