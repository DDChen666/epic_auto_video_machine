'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'gradient' | 'dots'
  text?: string
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', variant = 'default', text, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12',
    }

    const textSizeClasses = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
    }

    if (variant === 'dots') {
      return (
        <div
          className={cn('flex items-center space-x-1', className)}
          ref={ref}
          {...props}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className={cn(
                'rounded-full bg-brand-primary',
                size === 'sm'
                  ? 'w-2 h-2'
                  : size === 'md'
                    ? 'w-3 h-3'
                    : size === 'lg'
                      ? 'w-4 h-4'
                      : 'w-5 h-5'
              )}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
          {text && (
            <span
              className={cn(
                'ml-3 text-gray-600 dark:text-gray-400',
                textSizeClasses[size]
              )}
            >
              {text}
            </span>
          )}
        </div>
      )
    }

    return (
      <div
        className={cn('flex items-center space-x-3', className)}
        ref={ref}
        {...props}
      >
        <motion.div
          className={cn(
            'rounded-full border-2 border-transparent',
            sizeClasses[size],
            variant === 'gradient'
              ? 'border-t-brand-primary border-r-brand-secondary'
              : 'border-t-brand-primary border-r-gray-200 dark:border-r-gray-700'
          )}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        {text && (
          <span
            className={cn(
              'text-gray-600 dark:text-gray-400',
              textSizeClasses[size]
            )}
          >
            {text}
          </span>
        )}
      </div>
    )
  }
)
Spinner.displayName = 'Spinner'

export { Spinner }
