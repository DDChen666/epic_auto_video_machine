import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiMonitoring } from '@/lib/gemini-monitoring'
import { HTTP_STATUS } from '@/lib/api-utils'

/**
 * GET /api/v1/gemini/metrics
 * Get Gemini API usage metrics for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeWindow = searchParams.get('timeWindow')
    const format = searchParams.get('format') as 'json' | 'prometheus' | null

    // Parse time window (in milliseconds)
    let windowMs: number | undefined
    if (timeWindow) {
      const windowValue = parseInt(timeWindow)
      if (!isNaN(windowValue) && windowValue > 0) {
        windowMs = windowValue
      }
    }

    // Get user metrics
    const metrics = geminiMonitoring.getMetrics(session.user.id, windowMs)
    const performanceIndicators = geminiMonitoring.getPerformanceIndicators(session.user.id)
    const healthCheck = geminiMonitoring.checkUserHealth(session.user.id)

    if (format === 'prometheus') {
      const prometheusData = geminiMonitoring.exportMetrics('prometheus')
      return new Response(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        performance: performanceIndicators,
        health: healthCheck,
        timeWindow: windowMs,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error getting Gemini metrics:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to get metrics' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * GET /api/v1/gemini/metrics/admin
 * Get aggregated metrics for all users (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Check if user is admin (you'll need to implement this check)
    // For now, we'll skip the admin check
    // const user = await UserService.getUserById(session.user.id)
    // if (user.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'FORBIDDEN', message: 'Admin access required' },
    //     { status: HTTP_STATUS.FORBIDDEN }
    //   )
    // }

    const body = await request.json()
    const { timeWindow, includeUserDetails = false } = body

    // Parse time window
    let windowMs: number | undefined
    if (timeWindow && typeof timeWindow === 'number' && timeWindow > 0) {
      windowMs = timeWindow
    }

    const allMetrics = geminiMonitoring.getAllMetrics(windowMs)
    
    // Aggregate platform-wide statistics
    const platformStats = {
      totalUsers: Object.keys(allMetrics).length,
      totalRequests: Object.values(allMetrics).reduce((sum, m) => sum + m.requests.total, 0),
      totalSuccessful: Object.values(allMetrics).reduce((sum, m) => sum + m.requests.successful, 0),
      totalFailed: Object.values(allMetrics).reduce((sum, m) => sum + m.requests.failed, 0),
      averageLatency: Object.values(allMetrics).reduce((sum, m) => sum + m.latency.average, 0) / Object.keys(allMetrics).length,
      totalCost: Object.values(allMetrics).reduce((sum, m) => sum + m.costs.estimatedCost, 0),
    }

    const response: any = {
      success: true,
      data: {
        platformStats,
        timeWindow: windowMs,
        timestamp: new Date().toISOString(),
      },
    }

    if (includeUserDetails) {
      response.data.userMetrics = allMetrics
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting admin metrics:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to get admin metrics' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}