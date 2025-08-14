'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'glass'
    | 'gradient'
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    { className, variant = 'default', size = 'md', animate = true, children, ...props },
    ref
  ) => {
    const variantClasses = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      secondary: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      glass: 'glass text-white',
      gradient: 'gradient-bg text-white shadow-brand-glow',
    }

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-2 text-base',
    }

    const BadgeComponent = animate ? motion.div : 'div'
    const motionProps = animate
      ? {
          initial: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          whileHover: { scale: 1.05 },
          transition: { duration: 0.2 },
        }
      : {}

    return (
      <BadgeComponent
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-all duration-200',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...motionProps}
        {...props}
      >
        {children}
      </BadgeComponent>
    )
  }
)
Badge.displayName = 'Badge'

export { Badge }