import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={clsx(
        'bg-white rounded-3xl shadow-sm border border-gray-100',
        {
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-6': padding === 'lg',
        },
        className
      )}
    >
      {children}
    </div>
  )
}
