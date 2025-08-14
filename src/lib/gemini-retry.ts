import { GeminiError, GeminiErrorType } from './gemini-client'

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
  jitter: boolean
  retryableErrors: GeminiErrorType[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffStrategy: 'exponential',
  jitter: true,
  retryableErrors: [
    GeminiErrorType.RATE_LIMIT,
    GeminiErrorType.TIMEOUT,
    GeminiErrorType.SERVICE_ERROR,
    GeminiErrorType.QUOTA_EXCEEDED,
    GeminiErrorType.REGION_UNAVAILABLE,
  ],
}

/**
 * Calculate delay for retry attempt with backoff strategy
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.baseDelay

  switch (config.backoffStrategy) {
    case 'exponential':
      delay = config.baseDelay * Math.pow(2, attempt - 1)
      break
    case 'linear':
      delay = config.baseDelay * attempt
      break
    case 'fixed':
      delay = config.baseDelay
      break
  }

  // Apply max delay limit
  delay = Math.min(delay, config.maxDelay)

  // Add jitter to prevent thundering herd
  if (config.jitter) {
    const jitterAmount = delay * 0.1 // 10% jitter
    delay += Math.random() * jitterAmount * 2 - jitterAmount
  }

  return Math.max(0, delay)
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable based on configuration
 */
export function isRetryableError(
  error: GeminiError,
  config: RetryConfig
): boolean {
  return error.retryable && config.retryableErrors.includes(error.type)
}

/**
 * Retry wrapper for Gemini API calls with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: GeminiError
  let attempt = 1

  while (attempt <= config.maxAttempts) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as GeminiError

      // If not retryable or max attempts reached, throw immediately
      if (
        !isRetryableError(lastError, config) ||
        attempt === config.maxAttempts
      ) {
        throw lastError
      }

      // Calculate delay for next attempt
      let delay = calculateDelay(attempt, config)

      // If error has retryAfter, use that instead
      if (lastError.retryAfter && lastError.retryAfter > delay) {
        delay = lastError.retryAfter
      }

      console.warn(
        `Gemini API call failed (attempt ${attempt}/${config.maxAttempts}): ${lastError.message}. Retrying in ${delay}ms...`
      )

      await sleep(delay)
      attempt++
    }
  }

  throw lastError!
}

/**
 * Fallback strategies for different types of failures
 */
export interface FallbackStrategies {
  imageGenerationFallback?: () => Promise<string>
  ttsGenerationFallback?: (text: string) => Promise<string>
  contentPolicyFallback?: (originalPrompt: string) => Promise<string>
}

/**
 * Execute operation with retry and fallback strategies
 */
export async function withRetryAndFallback<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  try {
    return await withRetry(operation, config)
  } catch (error) {
    const geminiError = error as GeminiError

    // If we have a fallback and the error is not retryable, try fallback
    if (fallback && !geminiError.retryable) {
      console.warn(
        `Gemini API call failed with non-retryable error: ${geminiError.message}. Trying fallback...`
      )
      return await fallback()
    }

    throw error
  }
}

/**
 * Concurrency control for batch operations
 */
export class ConcurrencyController {
  private activeRequests = 0
  private queue: Array<() => void> = []

  constructor(private maxConcurrency: number = 5) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        this.activeRequests++

        try {
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.activeRequests--
          this.processQueue()
        }
      }

      if (this.activeRequests < this.maxConcurrency) {
        executeOperation()
      } else {
        this.queue.push(executeOperation)
      }
    })
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
      const nextOperation = this.queue.shift()
      if (nextOperation) {
        nextOperation()
      }
    }
  }

  getStatus(): { active: number; queued: number } {
    return {
      active: this.activeRequests,
      queued: this.queue.length,
    }
  }
}

/**
 * Circuit breaker pattern for Gemini API
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures,
    }
  }
}
