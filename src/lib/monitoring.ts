import { NextRequest, NextResponse } from 'next/server'

interface MetricData {
  timestamp: number
  method: string
  path: string
  statusCode: number
  responseTime: number
  userAgent?: string
  ip?: string
}

interface ApiMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  requestsByMethod: Record<string, number>
  requestsByStatus: Record<number, number>
  requestsByPath: Record<string, number>
  uptime: number
  startTime: number
}

// In-memory metrics store (use a proper metrics service in production)
class MetricsCollector {
  private metrics: MetricData[] = []
  private startTime: number = Date.now()
  private readonly maxMetrics = 10000 // Keep last 10k requests

  addMetric(data: MetricData) {
    this.metrics.push(data)
    
    // Keep only the last N metrics to prevent memory issues
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getMetrics(): ApiMetrics {
    const now = Date.now()
    const totalRequests = this.metrics.length
    const successfulRequests = this.metrics.filter(m => m.statusCode >= 200 && m.statusCode < 400).length
    const failedRequests = totalRequests - successfulRequests
    
    const totalResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0)
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0

    const requestsByMethod = this.metrics.reduce((acc, m) => {
      acc[m.method] = (acc[m.method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const requestsByStatus = this.metrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const requestsByPath = this.metrics.reduce((acc, m) => {
      acc[m.path] = (acc[m.path] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      requestsByMethod,
      requestsByStatus,
      requestsByPath,
      uptime: now - this.startTime,
      startTime: this.startTime,
    }
  }

  getHealthStatus(): { status: 'healthy' | 'unhealthy'; details: any } {
    const metrics = this.getMetrics()
    const recentMetrics = this.metrics.filter(m => m.timestamp > Date.now() - 5 * 60 * 1000) // Last 5 minutes
    
    const recentFailureRate = recentMetrics.length > 0 
      ? recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length 
      : 0

    const recentAverageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
      : 0

    const isHealthy = recentFailureRate < 0.1 && recentAverageResponseTime < 5000 // < 10% failure rate and < 5s response time

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        recentFailureRate: Math.round(recentFailureRate * 10000) / 100, // Percentage with 2 decimal places
        recentAverageResponseTime: Math.round(recentAverageResponseTime * 100) / 100,
        recentRequestCount: recentMetrics.length,
        uptime: metrics.uptime,
      },
    }
  }
}

export const metricsCollector = new MetricsCollector()

// Middleware to collect metrics
export function withMetrics<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const request = args[0] as NextRequest
    
    try {
      const response = await handler(...args)
      const endTime = Date.now()
      
      // Collect metrics
      metricsCollector.addMetric({
        timestamp: startTime,
        method: request.method,
        path: new URL(request.url).pathname,
        statusCode: response.status,
        responseTime: endTime - startTime,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip || undefined,
      })

      return response
    } catch (error) {
      const endTime = Date.now()
      
      // Collect error metrics
      metricsCollector.addMetric({
        timestamp: startTime,
        method: request.method,
        path: new URL(request.url).pathname,
        statusCode: 500,
        responseTime: endTime - startTime,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip || undefined,
      })

      throw error
    }
  }
}

// Logging utility
export function logRequest(
  request: NextRequest,
  response: NextResponse,
  responseTime: number
) {
  const timestamp = new Date().toISOString()
  const method = request.method
  const url = request.url
  const status = response.status
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip || 'unknown'

  console.log(
    `[${timestamp}] ${method} ${url} ${status} ${responseTime}ms - ${ip} - ${userAgent}`
  )
}

// Error logging utility
export function logError(error: unknown, context?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] ERROR:`, error)
  if (context) {
    console.error('Context:', context)
  }
}