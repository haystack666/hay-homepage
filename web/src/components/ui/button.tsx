import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'accent' | 'unstyled'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variantClass = variant === 'primary'
      ? 'admin-button-primary'
      : variant === 'accent'
        ? 'admin-button-accent'
        : ''
    const classes = variant === 'unstyled'
      ? className
      : ['admin-button', variantClass, className].filter(Boolean).join(' ')

    return <button ref={ref} className={classes || undefined} {...props} />
  },
)

Button.displayName = 'Button'
