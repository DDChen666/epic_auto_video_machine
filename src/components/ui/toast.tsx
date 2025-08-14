'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface Toast {
  id: string
  title?: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps extends Toast {
  onClose: (id: string) => void
}

const ToastComponent: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  action,
  onClose,
}) => {
  const [isVisible, setIsVisible] = React.useState(true)

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose(id), 300)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, id, onClose])

  const typeStyles = {
    success: {
      bg: 'bg-green-500/10 border-green-500/20',
      icon: '✓',
      iconBg: 'bg-green-500',
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/20',
      icon: '✕',
      iconBg: 'bg-red-500',
    },
    warning: {
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      icon: '⚠',
      iconBg: 'bg-yellow-500',
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/20',
      icon: 'ℹ',
      iconBg: 'bg-blue-500',
    },
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(id), 300)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn(
            'glass-card border max-w-md w-full shadow-elevation-3',
            typeStyles[type].bg
          )}
        >
          <div className="flex items-start space-x-3">
            <div
              className={cn(
                'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold',
                typeStyles[type].iconBg
              )}
            >
              {typeStyles[type].icon}
            </div>

            <div className="flex-1 min-w-0">
              {title && (
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h4>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {message}
              </p>

              {action && (
                <button
                  onClick={action.onClick}
                  className="mt-2 text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  {action.label}
                </button>
              )}
            </div>

            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Toast Container
interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center'
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
  position = 'top-right',
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
  }

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col space-y-3',
        positionClasses[position]
      )}
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <ToastComponent key={toast.id} {...toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Toast Hook
export const useToast = () => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearToasts = React.useCallback(() => {
    setToasts([])
  }, [])

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  }
}

export { ToastContainer, ToastComponent }
