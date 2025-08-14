'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'gradient' | 'glass'
  showValue?: boolean
  animated?: boolean
  label?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = 'md',
      variant = 'default',
      showValue = false,
      animated = true,
      label,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizeClasses = {
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
    }

    const variantClasses = {
      default: {
        track: 'bg-gray-200 dark:bg-gray-700',
        fill: 'bg-brand-primary',
      },
      gradient: {
        track: 'bg-gray-200 dark:bg-gray-700',
        fill: 'gradient-bg',
      },
      glass: {
        track: 'glass-dark',
        fill: 'glass glow',
      },
    }

    return (
      <div className="w-full">
        {(label || showValue) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </span>
            )}
            {showValue && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
        
        <div
          className={cn(
            'relative w-full rounded-full overflow-hidden',
            sizeClasses[size],
            variantClasses[variant].track,
            className
          )}
          ref={ref}
          {...props}
        >
          <motion.div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              variantClasses[variant].fill
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{
              duration: animated ? 0.5 : 0,
              ease: 'easeOut',
            }}
          />
          
          {animated && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 1,
                ease: 'easeInOut',
              }}
            />
          )}
        </div>
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }