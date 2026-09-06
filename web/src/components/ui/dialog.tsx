import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { Button } from './button'

type DialogProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, title, description, onClose, children }: DialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="admin-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <Button variant="unstyled" className="admin-dialog-close" type="button" aria-label="Close" onClick={onClose}>
            ×
          </Button>
        </div>
        {description && <p className="admin-muted">{description}</p>}
        {children}
      </section>
    </div>
  )
}
