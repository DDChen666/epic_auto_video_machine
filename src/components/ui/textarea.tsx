'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  variant?: 'default' | 'glass' | 'outline'
  resize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      variant = 'default',
      resize = true,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false)

    const variantClasses = {
      default: 'bg-white/5 border-white/20 focus:border-brand-primary',
      glass: 'glass border-glass-border focus:border-brand-primary',
      outline:
        'bg-transparent border-gray-300 dark:border-gray-600 focus:border-brand-primary',
    }

    return (
      <div className="w-full">
        {label && (
          <motion.label
            className={cn(
              'block text-sm font-medium mb-2 transition-colors',
              error ? 'text-red-500' : 'text-gray-700 dark:text-gray-300',
              isFocused && !error && 'gradient-text'
            )}
            animate={{ scale: isFocused ? 1.02 : 1 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.label>
        )}

        <motion.textarea
          className={cn(
            'flex min-h-[120px] w-full rounded-input px-3 py-2 text-sm transition-all duration-200',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            variantClasses[variant],
            !resize && 'resize-none',
            error &&
              'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
          {...props}
        />

        {(error || helperText) && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mt-2 text-xs',
              error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {error || helperText}
          </motion.p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
