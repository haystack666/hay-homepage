import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { archiveNote, deleteAdminNote, getAdminNotes, publishNote } from '../../lib/api'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import type { NoteStatus } from '../../lib/types'
import { formatNoteDate } from '../notes/noteMeta'

type AdminStatus = NoteStatus | ''
type PendingAction = {
  id: number
  title: string
  kind: 'publish' | 'republish' | 'archive' | 'delete'
}

export function AdminNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get('status'))
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminNotes>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const loadNotes = useCallback(() => {
    setLoading(true)
    setError('')
    getAdminNotes(status || undefined)
      .then(setResult)
      .catch(() => setError('The notes could not be loaded.'))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const requestAction = (id: number, title: string, kind: PendingAction['kind']) => {
    setActionError('')
    setPendingAction({ id, title, kind })
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    const { id, kind } = pendingAction
    setPendingAction(null)
    try {
      if (kind === 'publish' || kind === 'republish') {
        await publishNote(id)
      } else if (kind === 'archive') {
        await archiveNote(id)
      } else {
        await deleteAdminNote(id)
      }
      loadNotes()
    } catch {
      setActionError('That action could not be completed.')
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Control room / Notes</p>
          <h1>Notes workspace</h1>
          <p className="admin-muted">Draft, review, publish, and archive the public record.</p>
        </div>
        <Link className="admin-button admin-button-primary" to="/admin/notes/new">
          New note
        </Link>
      </div>

      <Tabs
        value={status || 'all'}
        onValueChange={(value) => setStatus(setSearchParams, value === 'all' ? '' : parseStatus(value))}
      >
        <TabsList className="admin-tabs" aria-label="Note status filters">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {actionError && <p className="admin-form-error" role="alert">{actionError}</p>}
      {loading && <p className="admin-state" aria-busy="true">Loading notes…</p>}
      {!loading && error && <p className="admin-state admin-form-error">{error}</p>}
      {!loading && !error && result?.items.length === 0 && (
        <p className="admin-state">No notes in this view.</p>
      )}
      {!loading && !error && result && result.items.length > 0 && (
        <Table className="admin-note-table" aria-label="Managed notes">
          <TableHeader className="admin-note-table-head">
            <TableHead>Note</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableHeader>
          {result.items.map((note) => (
            <TableRow className="admin-note-row" key={note.id}>
              <TableCell>
                <Link className="admin-note-title" to={`/admin/notes/${note.id}/edit`}>
                  {note.title}
                </Link>
                <span className="admin-note-slug">/{note.slug}</span>
              </TableCell>
              <Badge variant={note.status} role="cell">
                {capitalize(note.status)}
              </Badge>
              <time role="cell" dateTime={note.updatedAt}>
                {formatNoteDate(note.updatedAt)}
              </time>
              <TableCell className="admin-note-actions">
                <Link to={`/admin/notes/${note.id}/edit`}>Edit</Link>
                {note.status === 'draft' && (
                  <Button
                    variant="unstyled"
                    aria-label={`Publish ${note.title}`}
                    type="button"
                    onClick={() => requestAction(note.id, note.title, 'publish')}
                  >
                    Publish
                  </Button>
                )}
                {note.status === 'published' && (
                  <Button
                    variant="unstyled"
                    aria-label={`Archive ${note.title}`}
                    type="button"
                    onClick={() => requestAction(note.id, note.title, 'archive')}
                  >
                    Archive
                  </Button>
                )}
                {note.status === 'archived' && (
                  <>
                    <Button
                      variant="unstyled"
                      aria-label={`Republish ${note.title}`}
                      type="button"
                      onClick={() => requestAction(note.id, note.title, 'republish')}
                    >
                      Republish
                    </Button>
                    <Button
                      variant="unstyled"
                      aria-label={`Delete ${note.title}`}
                      type="button"
                      onClick={() => requestAction(note.id, note.title, 'delete')}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}

      <Dialog
        open={pendingAction !== null}
        title={pendingAction ? `${capitalize(pendingAction.kind)} note` : ''}
        description={pendingAction ? `${capitalize(pendingAction.kind)} ${pendingAction.title}?` : undefined}
        onClose={() => setPendingAction(null)}
      >
        <div className="admin-dialog-actions">
          <Button type="button" onClick={() => setPendingAction(null)}>
            Cancel
          </Button>
          <Button
            variant={pendingAction?.kind === 'archive' || pendingAction?.kind === 'delete' ? 'accent' : 'primary'}
            type="button"
            onClick={confirmAction}
          >
            {pendingAction ? capitalize(pendingAction.kind) : 'Confirm'}
          </Button>
        </div>
      </Dialog>
    </main>
  )
}

function parseStatus(value: string | null): AdminStatus {
  return value === 'draft' || value === 'published' || value === 'archived' ? value : ''
}

function setStatus(setSearchParams: ReturnType<typeof useSearchParams>[1], status: AdminStatus) {
  setSearchParams(status ? { status } : {})
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
