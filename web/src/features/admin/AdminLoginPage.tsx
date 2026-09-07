import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { login } from '../../lib/api'

const loginSchema = z.object({
  password: z.string().min(1, 'Enter the admin password.'),
})

type LoginValues = z.infer<typeof loginSchema>

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  })

  const onSubmit = async ({ password }: LoginValues) => {
    setError('')
    try {
      await login(password)
      navigate('/admin/notes', { replace: true })
    } catch {
      setError('The password was not accepted.')
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <p className="admin-kicker">Haystack / Private</p>
        <h1>Admin workspace</h1>
        <p className="admin-muted">A quiet place to shape the public archive.</p>
        <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label htmlFor="admin-password">Password</label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            {...register('password')}
          />
          {errors.password && <p className="admin-field-error">{errors.password.message}</p>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  )
}
