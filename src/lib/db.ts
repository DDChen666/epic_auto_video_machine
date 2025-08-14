import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Database connection with connection pooling and error handling
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'pretty',
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}

// Multi-tenant helper functions for Row Level Security
export class DatabaseService {
  /**
   * Get user-scoped Prisma client with RLS context
   * This ensures all queries are automatically filtered by user ID
   */
  static getUserScopedClient(userId: string) {
    return {
      // Projects scoped to user
      project: {
        findMany: (args?: any) =>
          prisma.project.findMany({
            ...args,
            where: { ...args?.where, userId },
          }),
        findUnique: (args: any) =>
          prisma.project.findFirst({
            ...args,
            where: { ...args.where, userId },
          }),
        findFirst: (args?: any) =>
          prisma.project.findFirst({
            ...args,
            where: { ...args?.where, userId },
          }),
        create: (args: any) =>
          prisma.project.create({
            ...args,
            data: { ...args.data, userId },
          }),
        update: (args: any) =>
          prisma.project.updateMany({
            ...args,
            where: { ...args.where, userId },
          }),
        delete: (args: any) =>
          prisma.project.deleteMany({
            ...args,
            where: { ...args.where, userId },
          }),
      },

      // Assets scoped to user
      asset: {
        findMany: (args?: any) =>
          prisma.asset.findMany({
            ...args,
            where: { ...args?.where, userId },
          }),
        findUnique: (args: any) =>
          prisma.asset.findFirst({
            ...args,
            where: { ...args.where, userId },
          }),
        create: (args: any) =>
          prisma.asset.create({
            ...args,
            data: { ...args.data, userId },
          }),
        update: (args: any) =>
          prisma.asset.updateMany({
            ...args,
            where: { ...args.where, userId },
          }),
        delete: (args: any) =>
          prisma.asset.deleteMany({
            ...args,
            where: { ...args.where, userId },
          }),
      },

      // Presets scoped to user
      preset: {
        findMany: (args?: any) =>
          prisma.preset.findMany({
            ...args,
            where: { ...args?.where, userId },
          }),
        findUnique: (args: any) =>
          prisma.preset.findFirst({
            ...args,
            where: { ...args.where, userId },
          }),
        create: (args: any) =>
          prisma.preset.create({
            ...args,
            data: { ...args.data, userId },
          }),
        update: (args: any) =>
          prisma.preset.updateMany({
            ...args,
            where: { ...args.where, userId },
          }),
        delete: (args: any) =>
          prisma.preset.deleteMany({
            ...args,
            where: { ...args.where, userId },
          }),
      },

      // Jobs are accessed through projects, so they inherit user scope
      job: prisma.job,
      scene: prisma.scene,
      user: prisma.user,
    }
  }

  /**
   * Verify user owns a resource before allowing access
   */
  static async verifyUserOwnership(
    userId: string,
    resourceType: 'project' | 'asset' | 'preset',
    resourceId: string
  ): Promise<boolean> {
    try {
      let resource
      switch (resourceType) {
        case 'project':
          resource = await prisma.project.findFirst({
            where: { id: resourceId, userId },
            select: { id: true },
          })
          break
        case 'asset':
          resource = await prisma.asset.findFirst({
            where: { id: resourceId, userId },
            select: { id: true },
          })
          break
        case 'preset':
          resource = await prisma.preset.findFirst({
            where: { id: resourceId, userId },
            select: { id: true },
          })
          break
      }
      return !!resource
    } catch (error) {
      console.error('Error verifying user ownership:', error)
      return false
    }
  }

  /**
   * Clean up expired assets based on lifecycle policy
   */
  static async cleanupExpiredAssets(): Promise<number> {
    try {
      const result = await prisma.asset.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })
      return result.count
    } catch (error) {
      console.error('Error cleaning up expired assets:', error)
      return 0
    }
  }

  /**
   * Get database statistics for monitoring
   */
  static async getDatabaseStats() {
    try {
      const [userCount, projectCount, jobCount, assetCount, activeJobs] =
        await Promise.all([
          prisma.user.count(),
          prisma.project.count(),
          prisma.job.count(),
          prisma.asset.count(),
          prisma.job.count({
            where: { status: { in: ['QUEUED', 'RUNNING'] } },
          }),
        ])

      return {
        users: userCount,
        projects: projectCount,
        jobs: jobCount,
        assets: assetCount,
        active_jobs: activeJobs,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error getting database stats:', error)
      return null
    }
  }

  /**
   * Get user resource counts for quota checking
   */
  static async getUserResourceCounts(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      const [
        totalProjects,
        projectsToday,
        totalAssets,
        activeJobs,
        totalScenes,
      ] = await Promise.all([
        prisma.project.count({ where: { userId } }),
        prisma.project.count({
          where: { userId, createdAt: { gte: today } },
        }),
        prisma.asset.count({ where: { userId } }),
        prisma.job.count({
          where: {
            project: { userId },
            status: { in: ['QUEUED', 'RUNNING'] },
          },
        }),
        prisma.scene.count({
          where: { project: { userId } },
        }),
      ])

      return {
        total_projects: totalProjects,
        projects_today: projectsToday,
        total_assets: totalAssets,
        active_jobs: activeJobs,
        total_scenes: totalScenes,
      }
    } catch (error) {
      console.error('Error getting user resource counts:', error)
      return {
        total_projects: 0,
        projects_today: 0,
        total_assets: 0,
        active_jobs: 0,
        total_scenes: 0,
      }
    }
  }

  /**
   * Check database health
   */
  static async getHealthStatus() {
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }
}

// Error handling utilities
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public meta?: any
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export function handlePrismaError(error: any): DatabaseError {
  if (error.code === 'P2002') {
    return new DatabaseError(
      'Unique constraint violation',
      error.code,
      error.meta
    )
  }
  if (error.code === 'P2025') {
    return new DatabaseError('Record not found', error.code, error.meta)
  }
  if (error.code === 'P2003') {
    return new DatabaseError(
      'Foreign key constraint violation',
      error.code,
      error.meta
    )
  }
  return new DatabaseError(
    error.message || 'Database operation failed',
    error.code,
    error.meta
  )
}

// Transaction helper
export async function withTransaction<T>(
  callback: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
    >
  ) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback)
}
