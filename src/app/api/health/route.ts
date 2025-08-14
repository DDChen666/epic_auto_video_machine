import { NextRequest } from 'next/server'
import { healthCheckResponse, withApiHandler } from '@/lib/api-utils'
import { metricsCollector } from '@/lib/monitoring'
import { checkDatabaseHealth } from '@/lib/db-health'

/**
 * GET /api/health - Health check endpoint
 * Returns the health status of the API and its dependencies
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  // Get health status from monitoring system
  const healthStatus = metricsCollector.getHealthStatus()

  // Perform database health check
  const dbHealth = await checkDatabaseHealth()

  // Perform basic health checks
  const checks = {
    api: healthStatus.status === 'healthy',
    database: dbHealth.status === 'healthy',
    databaseLatency: dbHealth.latency,
    databaseConnection: dbHealth.connection,
    timestamp: new Date().toISOString(),
    metrics: healthStatus.details,
    databaseStats: dbHealth.stats,
    errors: dbHealth.errors,
  }

  const allHealthy = checks.api && checks.database && checks.databaseConnection

  return healthCheckResponse(allHealthy ? 'healthy' : 'unhealthy', checks)
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
