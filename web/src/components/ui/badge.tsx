import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'draft' | 'published' | 'archived'
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={['admin-status', `admin-status-${variant}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
