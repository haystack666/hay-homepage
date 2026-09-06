import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Sonner } from '../../components/ui/sonner'
import { Textarea } from '../../components/ui/textarea'
import { createAdminNote, getAdminNote, publishNote, updateAdminNote } from '../../lib/api'
import type { NoteDetail, NoteInput } from '../../lib/types'
import { MarkdownArticle } from '../notes/MarkdownArticle'

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z.string().trim().min(1, 'Slug is required.'),
  excerpt: z.string().trim().min(1, 'Excerpt is required.'),
  tags: z.string(),
  contentMarkdown: z.string().trim().min(1, 'Markdown is required.'),
})

type NoteFormValues = z.infer<typeof noteSchema>

const emptyValues: NoteFormValues = {
  title: '',
  slug: '',
  excerpt: '',
  tags: '',
  contentMarkdown: '',
}

export function AdminNoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [preview, setPreview] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [savedNote, setSavedNote] = useState<NoteDetail | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (isNew) {
      reset(emptyValues)
      setLoading(false)
      return
    }

    setLoading(true)
    getAdminNote(Number(id))
      .then((note) => {
        setSavedNote(note)
        reset(toFormValues(note))
      })
      .catch(() => setErrorMessage('This note could not be loaded.'))
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  const onSubmit = async (values: NoteFormValues) => {
    setErrorMessage('')
    setStatusMessage('')
    const input = toNoteInput(values)
    try {
      const note = isNew ? await createAdminNote(input) : await updateAdminNote(Number(id), input)
      setSavedNote(note)
      setStatusMessage(note.status === 'draft' ? 'Draft saved.' : 'Changes saved.')
      if (isNew) {
        navigate(`/admin/notes/${note.id}/edit`, { replace: true })
      }
    } catch {
      setErrorMessage('The draft could not be saved.')
    }
  }

  const requestPublish = () => {
    if (!savedNote) return
    setPublishDialogOpen(true)
  }

  const handlePublish = async () => {
    if (!savedNote) return
    const wasDraft = savedNote.status === 'draft'
    setPublishDialogOpen(false)
    setErrorMessage('')
    try {
      const published = await publishNote(savedNote.id)
      setSavedNote(published)
      setStatusMessage(wasDraft ? 'Note published.' : 'Note republished.')
    } catch {
      setErrorMessage('The note could not be published.')
    }
  }

  if (loading) {
    return <main className="admin-page"><p className="admin-state" aria-busy="true">Loading note…</p></main>
  }

  if (errorMessage && !isNew && !savedNote) {
    return (
      <main className="admin-page">
        <p className="admin-form-error" role="alert">{errorMessage}</p>
        <Link className="admin-inline-link" to="/admin/notes">Back to notes</Link>
      </main>
    )
  }

  const content = watch('contentMarkdown')
  const publishAction = savedNote?.status === 'draft' ? 'Publish' : 'Republish'

  return (
    <main className="admin-page admin-editor-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Control room / Editor</p>
          <h1>{isNew ? 'New note' : 'Edit note'}</h1>
          <p className="admin-muted">Save your draft before making it public.</p>
        </div>
        <Link className="admin-inline-link" to="/admin/notes">Back to notes</Link>
      </div>

      <div className="admin-editor-toolbar">
        <span className="admin-editor-status">
          {savedNote ? capitalize(savedNote.status) : 'Draft'}
        </span>
        <div>
          <Button type="button" onClick={() => setPreview((value) => !value)}>
            {preview ? 'Edit Markdown' : 'Preview'}
          </Button>
          <Button variant="primary" type="submit" form="note-editor-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : savedNote && savedNote.status !== 'draft' ? 'Save changes' : 'Save draft'}
          </Button>
          {savedNote && (
            <Button variant="accent" type="button" onClick={requestPublish}>
              {savedNote.status === 'draft' ? 'Publish note' : 'Republish note'}
            </Button>
          )}
        </div>
      </div>

      <Sonner message={statusMessage} />
      <Sonner message={errorMessage} tone="error" />
      <Dialog
        open={publishDialogOpen}
        title={`${publishAction} note`}
        description={savedNote ? `${publishAction} ${savedNote.title}?` : undefined}
        onClose={() => setPublishDialogOpen(false)}
      >
        <div className="admin-dialog-actions">
          <Button type="button" onClick={() => setPublishDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={handlePublish}>
            {publishAction}
          </Button>
        </div>
      </Dialog>

      {preview ? (
        <MarkdownArticle content={content} />
      ) : (
        <form id="note-editor-form" className="admin-editor-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="admin-editor-grid">
            <div className="admin-field admin-field-wide">
              <label htmlFor="note-title">Title</label>
              <Input id="note-title" {...register('title')} aria-invalid={errors.title ? 'true' : 'false'} />
              {errors.title && <p className="admin-field-error">{errors.title.message}</p>}
            </div>
            <div className="admin-field">
              <label htmlFor="note-slug">Slug</label>
              <Input id="note-slug" {...register('slug')} aria-invalid={errors.slug ? 'true' : 'false'} />
              {errors.slug && <p className="admin-field-error">{errors.slug.message}</p>}
            </div>
            <div className="admin-field">
              <label htmlFor="note-tags">Tags</label>
              <Input id="note-tags" placeholder="Build, Systems" {...register('tags')} />
              <p className="admin-field-hint">Separate tags with commas.</p>
            </div>
            <div className="admin-field admin-field-wide">
              <label htmlFor="note-excerpt">Excerpt</label>
              <Textarea id="note-excerpt" rows={3} {...register('excerpt')} aria-invalid={errors.excerpt ? 'true' : 'false'} />
              {errors.excerpt && <p className="admin-field-error">{errors.excerpt.message}</p>}
            </div>
            <div className="admin-field admin-field-wide">
              <label htmlFor="note-content">Markdown</label>
              <Textarea id="note-content" className="admin-markdown-input" rows={22} {...register('contentMarkdown')} aria-invalid={errors.contentMarkdown ? 'true' : 'false'} />
              {errors.contentMarkdown && <p className="admin-field-error">{errors.contentMarkdown.message}</p>}
            </div>
          </div>
        </form>
      )}
    </main>
  )
}

function toNoteInput(values: NoteFormValues): NoteInput {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    excerpt: values.excerpt.trim(),
    contentMarkdown: values.contentMarkdown.trim(),
    tags: values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

function toFormValues(note: NoteDetail): NoteFormValues {
  return {
    title: note.title,
    slug: note.slug,
    excerpt: note.excerpt,
    tags: note.tags.map((tag) => tag.name).join(', '),
    contentMarkdown: note.contentMarkdown,
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
