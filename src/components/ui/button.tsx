'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'gradient'
    | 'glass'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-button text-sm font-medium transition-all duration-200 focus-brand disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-elevation-1 hover:shadow-elevation-2':
              variant === 'default',
            'bg-red-500 text-white hover:bg-red-600 shadow-elevation-1 hover:shadow-elevation-2':
              variant === 'destructive',
            'border border-gray-300 dark:border-gray-600 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800':
              variant === 'outline',
            'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700':
              variant === 'secondary',
            'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300':
              variant === 'ghost',
            'text-brand-primary underline-offset-4 hover:underline bg-transparent':
              variant === 'link',
            'gradient-bg text-white shadow-brand-glow hover:shadow-brand-glow-lg':
              variant === 'gradient',
            'glass text-white border border-glass-border hover:bg-white/20':
              variant === 'glass',
          },
          {
            'h-8 px-3 text-xs': size === 'xs',
            'h-9 px-3': size === 'sm',
            'h-10 px-4 py-2': size === 'default',
            'h-11 px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        disabled={isDisabled}
        ref={ref}
        {...(props as any)}
      >
        {loading && (
          <motion.div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
