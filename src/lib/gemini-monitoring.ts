import { GeminiErrorType } from './gemini-client'

export interface GeminiMetrics {
  requests: {
    total: number
    successful: number
    failed: number
    retried: number
  }
  latency: {
    average: number
    p95: number
    p99: number
  }
  errors: Record<GeminiErrorType, number>
  rateLimits: {
    textHits: number
    imageHits: number
    ttsHits: number
  }
  costs: {
    textTokens: number
    imageGenerations: number
    ttsCharacters: number
    estimatedCost: number
  }
}

export interface RequestMetric {
  timestamp: number
  operation: 'text' | 'image' | 'tts'
  latency: number
  success: boolean
  error?: GeminiErrorType
  retryCount: number
  cost?: number
  userId?: string
}

/**
 * Monitoring service for Gemini API usage and performance
 */
export class GeminiMonitoring {
  private static instance: GeminiMonitoring
  private metrics: Map<string, RequestMetric[]> = new Map()
  private readonly maxMetricsPerUser = 1000 // Keep last 1000 requests per user

  private constructor() {}

  static getInstance(): GeminiMonitoring {
    if (!GeminiMonitoring.instance) {
      GeminiMonitoring.instance = new GeminiMonitoring()
    }
    return GeminiMonitoring.instance
  }

  /**
   * Record a request metric
   */
  recordRequest(metric: RequestMetric): void {
    const userId = metric.userId || 'platform'
    const userMetrics = this.metrics.get(userId) || []

    userMetrics.push(metric)

    // Keep only the most recent metrics
    if (userMetrics.length > this.maxMetricsPerUser) {
      userMetrics.splice(0, userMetrics.length - this.maxMetricsPerUser)
    }

    this.metrics.set(userId, userMetrics)
  }

  /**
   * Get aggregated metrics for a user or platform
   */
  getMetrics(userId?: string, timeWindow?: number): GeminiMetrics {
    const key = userId || 'platform'
    const userMetrics = this.metrics.get(key) || []

    // Filter by time window if specified
    const cutoff = timeWindow ? Date.now() - timeWindow : 0
    const filteredMetrics = userMetrics.filter(m => m.timestamp > cutoff)

    return this.aggregateMetrics(filteredMetrics)
  }

  /**
   * Get metrics for all users (admin only)
   */
  getAllMetrics(timeWindow?: number): Record<string, GeminiMetrics> {
    const result: Record<string, GeminiMetrics> = {}

    for (const [userId, metrics] of this.metrics.entries()) {
      const cutoff = timeWindow ? Date.now() - timeWindow : 0
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff)
      result[userId] = this.aggregateMetrics(filteredMetrics)
    }

    return result
  }

  /**
   * Get real-time performance indicators
   */
  getPerformanceIndicators(userId?: string): {
    currentRPS: number // Requests per second
    errorRate: number // Percentage
    averageLatency: number // Milliseconds
    circuitBreakerTrips: number
    rateLimitHits: number
  } {
    const key = userId || 'platform'
    const userMetrics = this.metrics.get(key) || []

    // Look at last 60 seconds
    const oneMinuteAgo = Date.now() - 60000
    const recentMetrics = userMetrics.filter(m => m.timestamp > oneMinuteAgo)

    const totalRequests = recentMetrics.length
    const failedRequests = recentMetrics.filter(m => !m.success).length
    const rateLimitErrors = recentMetrics.filter(
      m => m.error === GeminiErrorType.RATE_LIMIT
    ).length

    const totalLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0)
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0

    return {
      currentRPS: totalRequests / 60, // Requests per second over last minute
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      averageLatency,
      circuitBreakerTrips: 0, // Would need to track this separately
      rateLimitHits: rateLimitErrors,
    }
  }

  /**
   * Check if user is experiencing issues
   */
  checkUserHealth(userId: string): {
    healthy: boolean
    issues: string[]
    recommendations: string[]
  } {
    const indicators = this.getPerformanceIndicators(userId)
    const issues: string[] = []
    const recommendations: string[] = []

    if (indicators.errorRate > 10) {
      issues.push(`High error rate: ${indicators.errorRate.toFixed(1)}%`)
      recommendations.push('Check API key validity and quota limits')
    }

    if (indicators.averageLatency > 5000) {
      issues.push(`High latency: ${indicators.averageLatency.toFixed(0)}ms`)
      recommendations.push(
        'Consider using regional endpoints or reducing request complexity'
      )
    }

    if (indicators.rateLimitHits > 5) {
      issues.push(
        `Frequent rate limiting: ${indicators.rateLimitHits} hits in last minute`
      )
      recommendations.push('Implement request queuing or upgrade to paid tier')
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'prometheus' | 'json' = 'json'): string {
    const allMetrics = this.getAllMetrics(3600000) // Last hour

    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(allMetrics)
    }

    return JSON.stringify(allMetrics, null, 2)
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanup(maxAge: number = 86400000): void {
    // Default 24 hours
    const cutoff = Date.now() - maxAge

    for (const [userId, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff)

      if (filteredMetrics.length === 0) {
        this.metrics.delete(userId)
      } else {
        this.metrics.set(userId, filteredMetrics)
      }
    }
  }

  /**
   * Aggregate raw metrics into summary
   */
  private aggregateMetrics(metrics: RequestMetric[]): GeminiMetrics {
    const successful = metrics.filter(m => m.success)
    const failed = metrics.filter(m => !m.success)
    const retried = metrics.filter(m => m.retryCount > 0)

    // Calculate latency percentiles
    const latencies = metrics.map(m => m.latency).sort((a, b) => a - b)
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)

    // Count errors by type
    const errors: Record<GeminiErrorType, number> = {} as any
    Object.values(GeminiErrorType).forEach(type => {
      errors[type] = failed.filter(m => m.error === type).length
    })

    // Calculate costs
    const textRequests = metrics.filter(m => m.operation === 'text')
    const imageRequests = metrics.filter(m => m.operation === 'image')
    const ttsRequests = metrics.filter(m => m.operation === 'tts')

    const estimatedCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0)

    return {
      requests: {
        total: metrics.length,
        successful: successful.length,
        failed: failed.length,
        retried: retried.length,
      },
      latency: {
        average:
          latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0,
        p95: latencies[p95Index] || 0,
        p99: latencies[p99Index] || 0,
      },
      errors,
      rateLimits: {
        textHits: errors[GeminiErrorType.RATE_LIMIT] || 0,
        imageHits: errors[GeminiErrorType.RATE_LIMIT] || 0,
        ttsHits: errors[GeminiErrorType.RATE_LIMIT] || 0,
      },
      costs: {
        textTokens: textRequests.length * 100, // Rough estimate
        imageGenerations: imageRequests.length,
        ttsCharacters: ttsRequests.length * 50, // Rough estimate
        estimatedCost,
      },
    }
  }

  /**
   * Format metrics for Prometheus
   */
  private formatPrometheusMetrics(
    allMetrics: Record<string, GeminiMetrics>
  ): string {
    let output = ''

    // Total requests
    output +=
      '# HELP gemini_requests_total Total number of Gemini API requests\n'
    output += '# TYPE gemini_requests_total counter\n'
    for (const [userId, metrics] of Object.entries(allMetrics)) {
      output += `gemini_requests_total{user_id="${userId}",status="success"} ${metrics.requests.successful}\n`
      output += `gemini_requests_total{user_id="${userId}",status="failed"} ${metrics.requests.failed}\n`
    }

    // Latency
    output +=
      '\n# HELP gemini_request_duration_seconds Request duration in seconds\n'
    output += '# TYPE gemini_request_duration_seconds histogram\n'
    for (const [userId, metrics] of Object.entries(allMetrics)) {
      output += `gemini_request_duration_seconds{user_id="${userId}",quantile="0.95"} ${metrics.latency.p95 / 1000}\n`
      output += `gemini_request_duration_seconds{user_id="${userId}",quantile="0.99"} ${metrics.latency.p99 / 1000}\n`
    }

    // Error rates
    output += '\n# HELP gemini_errors_total Total number of errors by type\n'
    output += '# TYPE gemini_errors_total counter\n'
    for (const [userId, metrics] of Object.entries(allMetrics)) {
      for (const [errorType, count] of Object.entries(metrics.errors)) {
        output += `gemini_errors_total{user_id="${userId}",error_type="${errorType}"} ${count}\n`
      }
    }

    return output
  }
}

/**
 * Decorator for automatic request monitoring
 */
export function monitorGeminiRequest(
  operation: 'text' | 'image' | 'tts',
  userId?: string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now()
      const monitoring = GeminiMonitoring.getInstance()
      let retryCount = 0
      let error: GeminiErrorType | undefined

      try {
        const result = await method.apply(this, args)

        monitoring.recordRequest({
          timestamp: Date.now(),
          operation,
          latency: Date.now() - startTime,
          success: true,
          retryCount,
          userId,
        })

        return result
      } catch (err: any) {
        error = err.type || GeminiErrorType.SERVICE_ERROR
        retryCount = err.retryCount || 0

        monitoring.recordRequest({
          timestamp: Date.now(),
          operation,
          latency: Date.now() - startTime,
          success: false,
          error,
          retryCount,
          userId,
        })

        throw err
      }
    }
  }
}

// Global monitoring instance
export const geminiMonitoring = GeminiMonitoring.getInstance()

// Cleanup old metrics every hour
setInterval(() => {
  geminiMonitoring.cleanup()
}, 3600000)
