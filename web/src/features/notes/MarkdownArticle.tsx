import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownArticleProps = {
  content: string
}

export function MarkdownArticle({ content }: MarkdownArticleProps) {
  return (
    <div className="markdown-article">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (isSafeUrl(url) ? url : '')}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

const components: Components = {
  a: ({ children, href, title }: ComponentPropsWithoutRef<'a'>) => {
    if (!isSafeUrl(href)) {
      return <span>{children}</span>
    }

    const external = href?.startsWith('http://') || href?.startsWith('https://')
    return (
      <a
        href={href}
        rel={external ? 'noopener noreferrer' : undefined}
        target={external ? '_blank' : undefined}
        title={title}
      >
        {children}
      </a>
    )
  },
  img: ({ alt, src, title }: ComponentPropsWithoutRef<'img'>) => {
    if (!isSafeImageUrl(src)) {
      return null
    }

    return <img src={src} alt={alt ?? ''} loading="lazy" title={title} />
  },
  input: ({ checked, disabled, type }: ComponentPropsWithoutRef<'input'>) => (
    <input
      aria-label={checked ? 'Completed task' : 'Incomplete task'}
      checked={checked}
      disabled={disabled}
      type={type}
      readOnly
    />
  ),
}

function isSafeUrl(value?: string) {
  if (!value) return false
  const url = value.trim()
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true
  }

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isSafeImageUrl(value?: string) {
  if (!value) return false
  const url = value.trim()
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true
  }

  try {
    return new URL(url, window.location.origin).protocol === 'https:'
  } catch {
    return false
  }
}
