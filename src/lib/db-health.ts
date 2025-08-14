import { prisma, DatabaseService } from './db'
import { DATABASE_CONFIG } from './constants'

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  connection: boolean
  latency: number
  stats: {
    users: number
    projects: number
    jobs: number
    assets: number
  } | null
  errors: string[]
  timestamp: string
}

/**
 * Comprehensive database health check
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now()
  const errors: string[] = []
  let connection = false
  let stats = null

  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`
    connection = true

    // Get database statistics
    stats = await DatabaseService.getDatabaseStats()
    if (!stats) {
      errors.push('Failed to retrieve database statistics')
    }
  } catch (error) {
    connection = false
    errors.push(
      `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  const latency = Date.now() - startTime

  // Determine overall health status
  let status: DatabaseHealthStatus['status'] = 'healthy'
  if (!connection) {
    status = 'unhealthy'
  } else if (
    latency > DATABASE_CONFIG.CONNECTION_TIMEOUT / 2 ||
    errors.length > 0
  ) {
    status = 'degraded'
  }

  return {
    status,
    connection,
    latency,
    stats,
    errors,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Test database performance with sample queries
 */
export async function performDatabaseBenchmark(): Promise<{
  queries: Array<{
    name: string
    duration: number
    success: boolean
    error?: string
  }>
  totalDuration: number
}> {
  const queries = []
  const startTime = Date.now()

  // Test queries
  const testQueries = [
    {
      name: 'Simple SELECT',
      query: () => prisma.$queryRaw`SELECT 1`,
    },
    {
      name: 'Count users',
      query: () => prisma.user.count(),
    },
    {
      name: 'Count projects',
      query: () => prisma.project.count(),
    },
    {
      name: 'Complex join query',
      query: () =>
        prisma.project.findMany({
          take: 10,
          include: {
            user: {
              select: { id: true, name: true },
            },
            jobs: {
              select: { id: true, status: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
            _count: {
              select: { scenes: true },
            },
          },
        }),
    },
  ]

  for (const test of testQueries) {
    const queryStart = Date.now()
    try {
      await test.query()
      queries.push({
        name: test.name,
        duration: Date.now() - queryStart,
        success: true,
      })
    } catch (error) {
      queries.push({
        name: test.name,
        duration: Date.now() - queryStart,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    queries,
    totalDuration: Date.now() - startTime,
  }
}

/**
 * Clean up expired assets and return count
 */
export async function performDatabaseMaintenance(): Promise<{
  expiredAssetsDeleted: number
  errors: string[]
}> {
  const errors: string[] = []
  let expiredAssetsDeleted = 0

  try {
    expiredAssetsDeleted = await DatabaseService.cleanupExpiredAssets()
  } catch (error) {
    errors.push(
      `Asset cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return {
    expiredAssetsDeleted,
    errors,
  }
}

/**
 * Validate database schema integrity
 */
export async function validateDatabaseSchema(): Promise<{
  valid: boolean
  issues: string[]
}> {
  const issues: string[] = []

  try {
    // Check if all required tables exist
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `

    const requiredTables = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'projects',
      'jobs',
      'scenes',
      'assets',
      'presets',
    ]

    const existingTables = tables.map(t => t.table_name)
    const missingTables = requiredTables.filter(
      table => !existingTables.includes(table)
    )

    if (missingTables.length > 0) {
      issues.push(`Missing tables: ${missingTables.join(', ')}`)
    }

    // Check for orphaned records
    const orphanedScenes = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM scenes s
      LEFT JOIN projects p ON s."projectId" = p.id
      WHERE p.id IS NULL
    `

    if (orphanedScenes[0]?.count > 0) {
      issues.push(`Found ${orphanedScenes[0].count} orphaned scenes`)
    }

    const orphanedJobs = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM jobs j
      LEFT JOIN projects p ON j."projectId" = p.id
      WHERE p.id IS NULL
    `

    if (orphanedJobs[0]?.count > 0) {
      issues.push(`Found ${orphanedJobs[0].count} orphaned jobs`)
    }
  } catch (error) {
    issues.push(
      `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Get database connection pool status
 */
export async function getDatabaseConnectionStatus() {
  try {
    // This is a simplified version - in production you'd want to check actual pool metrics
    const result = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'
    `

    return {
      activeConnections: result[0]?.count || 0,
      maxConnections: DATABASE_CONFIG.MAX_CONNECTIONS,
      healthy: (result[0]?.count || 0) < DATABASE_CONFIG.MAX_CONNECTIONS * 0.8,
    }
  } catch (error) {
    return {
      activeConnections: -1,
      maxConnections: DATABASE_CONFIG.MAX_CONNECTIONS,
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
