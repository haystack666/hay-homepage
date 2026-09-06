type SonnerProps = {
  message: string
  tone?: 'success' | 'error'
}

export function Sonner({ message, tone = 'success' }: SonnerProps) {
  if (!message) return null

  return (
    <p className={tone === 'error' ? 'admin-form-error' : 'admin-form-success'} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  )
}
