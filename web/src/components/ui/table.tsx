import type { HTMLAttributes } from 'react'

type TableProps = HTMLAttributes<HTMLDivElement>

export function Table({ className = '', ...props }: TableProps) {
  return <div role="table" className={className || undefined} {...props} />
}

export function TableHeader({ className = '', ...props }: TableProps) {
  return <div role="row" className={className || undefined} {...props} />
}

export function TableRow({ className = '', ...props }: TableProps) {
  return <div role="row" className={className || undefined} {...props} />
}

export function TableHead({ className = '', ...props }: TableProps) {
  return <span role="columnheader" className={className || undefined} {...props} />
}

export function TableCell({ className = '', ...props }: TableProps) {
  return <div role="cell" className={className || undefined} {...props} />
}
