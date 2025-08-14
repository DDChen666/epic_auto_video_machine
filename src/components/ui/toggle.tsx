'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'gradient'
  label?: string
  description?: string
  className?: string
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked,
      onChange,
      disabled = false,
      size = 'md',
      variant = 'default',
      label,
      description,
      className,
    },
    ref
  ) => {
    const sizeClasses = {
      sm: {
        track: 'w-8 h-4',
        thumb: 'w-3 h-3',
        translate: 'translate-x-4',
      },
      md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-5',
      },
      lg: {
        track: 'w-14 h-7',
        thumb: 'w-6 h-6',
        translate: 'translate-x-7',
      },
    }

    const variantClasses = {
      default: {
        trackOn: 'bg-brand-primary',
        trackOff: 'bg-gray-200 dark:bg-gray-700',
        thumb: 'bg-white shadow-sm',
      },
      gradient: {
        trackOn: 'gradient-bg glow',
        trackOff: 'bg-gray-200 dark:bg-gray-700',
        thumb: 'bg-white shadow-brand-glow',
      },
    }

    const handleToggle = () => {
      if (!disabled) {
        onChange(!checked)
      }
    }

    const ToggleButton = (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2',
          sizeClasses[size].track,
          checked
            ? variantClasses[variant].trackOn
            : variantClasses[variant].trackOff,
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <motion.span
          className={cn(
            'inline-block rounded-full transition-all duration-200',
            sizeClasses[size].thumb,
            variantClasses[variant].thumb
          )}
          animate={{
            x: checked
              ? sizeClasses[size].translate.replace('translate-x-', '')
              : '0',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    )

    if (label || description) {
      return (
        <div className="flex items-start space-x-3">
          {ToggleButton}
          <div className="flex-1">
            {label && (
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      )
    }

    return ToggleButton
  }
)
Toggle.displayName = 'Toggle'

export { Toggle }
