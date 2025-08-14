import { NextRequest } from 'next/server'
import { healthCheckResponse, withApiHandler } from '@/lib/api-utils'
import { metricsCollector } from '@/lib/monitoring'

/**
 * GET /api/health - Health check endpoint
 * Returns the health status of the API and its dependencies
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  // Get health status from monitoring system
  const healthStatus = metricsCollector.getHealthStatus()
  
  // Perform basic health checks
  const checks = {
    api: healthStatus.status === 'healthy',
    database: true, // TODO: Add actual database health check
    timestamp: true,
    metrics: healthStatus.details,
  }

  const allHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : true
  )
  
  return healthCheckResponse(
    allHealthy ? 'healthy' : 'unhealthy',
    checks
  )
})

/**
 * OPTIONS /api/health - CORS preflight
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