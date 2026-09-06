import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type SignalNodeProps = {
  label: 'NOW' | 'NOTES' | 'LINKS'
  href: string
  detail: string
  children?: ReactNode
}

export function SignalNode({ label, href, detail, children }: SignalNodeProps) {
  const content = (
    <>
      <span className="signal-node-trace" aria-hidden="true" />
      <span className="signal-node-mark" aria-hidden="true" />
      <span className="signal-node-copy">
        <span className="signal-node-label">{label}</span>
        <span className="signal-node-detail">{children ?? detail}</span>
      </span>
      <span className="signal-node-arrow" aria-hidden="true">
        ↗
      </span>
    </>
  )

  const className = `signal-node signal-node-${label.toLowerCase()}`
  const dataSignalNode = label.toLowerCase()

  if (href.startsWith('#')) {
    return (
      <a className={className} data-signal-node={dataSignalNode} href={href}>
        {content}
      </a>
    )
  }

  return (
    <Link className={className} data-signal-node={dataSignalNode} to={href}>
      {content}
    </Link>
  )
}
