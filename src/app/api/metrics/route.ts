import { NextRequest } from 'next/server'
import { successResponse, withApiHandler } from '@/lib/api-utils'
import { metricsCollector } from '@/lib/monitoring'

/**
 * GET /api/metrics - Get API metrics and health status
 * This endpoint provides insights into API performance and usage
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const metrics = metricsCollector.getMetrics()
  const health = metricsCollector.getHealthStatus()

  return successResponse({
    ...metrics,
    health,
  })
})

/**
 * OPTIONS /api/metrics - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
