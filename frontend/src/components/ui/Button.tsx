import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
        {
          'w-full': fullWidth,
          'px-4 py-2 text-sm': size === 'sm',
          'px-5 py-3 text-base': size === 'md',
          'px-6 py-4 text-lg': size === 'lg',
          'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400 active:scale-95': variant === 'primary',
          'bg-primary-100 text-primary-700 hover:bg-primary-200 focus:ring-primary-300 active:scale-95': variant === 'secondary',
          'text-primary-600 hover:bg-primary-50 focus:ring-primary-300': variant === 'ghost',
          'border border-primary-300 text-primary-700 bg-white hover:bg-primary-50 focus:ring-primary-300 active:scale-95': variant === 'outline',
          'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400 active:scale-95': variant === 'danger',
          'opacity-50 cursor-not-allowed active:scale-100': disabled || loading,
        },
        className
      )}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
