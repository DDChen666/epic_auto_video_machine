'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  icon?: React.ReactNode
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
  variant?: 'default' | 'glass' | 'outline'
  className?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option...',
      disabled = false,
      error,
      label,
      variant = 'default',
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [focusedIndex, setFocusedIndex] = React.useState(-1)
    const selectRef = React.useRef<HTMLDivElement>(null)

    const selectedOption = options.find(option => option.value === value)

    const variantClasses = {
      default: 'bg-white/5 border-white/20 focus-within:border-brand-primary',
      glass: 'glass border-glass-border focus-within:border-brand-primary',
      outline:
        'bg-transparent border-gray-300 dark:border-gray-600 focus-within:border-brand-primary',
    }

    // Handle keyboard navigation
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setFocusedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0))
            break
          case 'ArrowUp':
            e.preventDefault()
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1))
            break
          case 'Enter':
            e.preventDefault()
            if (focusedIndex >= 0) {
              onChange(options[focusedIndex].value)
              setIsOpen(false)
            }
            break
          case 'Escape':
            setIsOpen(false)
            break
        }
      }

      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen, focusedIndex, options, onChange])

    // Handle click outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          selectRef.current &&
          !selectRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () =>
          document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen])

    return (
      <div className="w-full" ref={ref}>
        {label && (
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}

        <div className="relative" ref={selectRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              'relative w-full h-12 px-3 py-2 text-left rounded-input transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
              variantClasses[variant],
              disabled && 'opacity-50 cursor-not-allowed',
              error &&
                'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedOption?.icon && (
                  <span className="text-gray-400">{selectedOption.icon}</span>
                )}
                <span
                  className={cn(
                    'block truncate text-sm',
                    selectedOption
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400'
                  )}
                >
                  {selectedOption?.label || placeholder}
                </span>
              </div>

              <motion.svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </motion.svg>
            </div>
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute z-50 w-full mt-1 glass-card border border-glass-border shadow-elevation-3 max-h-60 overflow-auto"
              >
                {options.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value)
                        setIsOpen(false)
                      }
                    }}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center space-x-2',
                      'hover:bg-white/10 focus:bg-white/10 focus:outline-none',
                      focusedIndex === index && 'bg-white/10',
                      option.value === value &&
                        'bg-brand-primary/20 text-brand-primary',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {option.icon && (
                      <span className="text-gray-400">{option.icon}</span>
                    )}
                    <span className="block truncate">{option.label}</span>
                    {option.value === value && (
                      <svg
                        className="w-4 h-4 ml-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
