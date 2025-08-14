import { prisma } from './db'
import { UserRole } from '@prisma/client'
import { encryptApiKey, decryptApiKey, maskSensitiveData } from './encryption'
import { DEFAULT_USER_SETTINGS } from './constants'

export interface UserSettings {
  language: string
  timezone: string
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    discord: boolean
    webhook: boolean
  }
  privacy: {
    analytics: boolean
    error_reporting: boolean
  }
  generation: {
    default_aspect_ratio: '9:16' | '16:9' | '1:1'
    default_template: 'classic' | 'dark' | 'vivid'
    default_voice: 'male' | 'female' | 'natural'
    images_per_scene: 1 | 2 | 3
    auto_segment: boolean
    use_llm_segment: boolean
  }
  safety: {
    content_policy: 'strict' | 'standard'
    blocked_words: string[]
    error_strategy: 'skip' | 'mask' | 'fail'
  }
}

export interface BYOApiKeys {
  gemini_api_key?: string
  openai_api_key?: string
  anthropic_api_key?: string
  created_at: string
  last_used_at?: string
}

export class UserService {
  /**
   * Get user by ID with decrypted sensitive data
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
        sessions: true,
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            projects: true,
            assets: true,
          },
        },
      },
    })

    if (!user) {
      return null
    }

    // Decrypt sensitive data
    let decryptedSettings: UserSettings = DEFAULT_USER_SETTINGS as UserSettings
    let decryptedApiKeys: BYOApiKeys | null = null

    try {
      if (user.settings) {
        decryptedSettings = {
          ...DEFAULT_USER_SETTINGS,
          ...(typeof user.settings === 'string'
            ? JSON.parse(user.settings)
            : user.settings),
        } as UserSettings
      }

      if (user.apiKeys) {
        const apiKeysData =
          typeof user.apiKeys === 'string'
            ? JSON.parse(user.apiKeys)
            : user.apiKeys

        decryptedApiKeys = {
          ...apiKeysData,
          gemini_api_key: apiKeysData.gemini_api_key
            ? decryptApiKey(apiKeysData.gemini_api_key)
            : undefined,
          openai_api_key: apiKeysData.openai_api_key
            ? decryptApiKey(apiKeysData.openai_api_key)
            : undefined,
          anthropic_api_key: apiKeysData.anthropic_api_key
            ? decryptApiKey(apiKeysData.anthropic_api_key)
            : undefined,
        }
      }
    } catch (error) {
      console.error('Error decrypting user data:', error)
    }

    return {
      ...user,
      settings: decryptedSettings,
      apiKeys: decryptedApiKeys,
    }
  }

  /**
   * Update user settings
   */
  static async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>
  ) {
    const currentUser = await this.getUserById(userId)
    if (!currentUser) {
      throw new Error('User not found')
    }

    const updatedSettings = {
      ...currentUser.settings,
      ...settings,
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    })

    return updatedSettings
  }

  /**
   * Set BYO API key
   */
  static async setBYOApiKey(
    userId: string,
    provider: 'gemini' | 'openai' | 'anthropic',
    apiKey: string
  ) {
    const currentUser = await this.getUserById(userId)
    if (!currentUser) {
      throw new Error('User not found')
    }

    // Check if user has permission to use BYO API keys
    if (currentUser.role === UserRole.USER) {
      throw new Error(
        'BYO API keys are only available for Premium and Admin users'
      )
    }

    const encryptedKey = encryptApiKey(apiKey)
    const currentApiKeys = (currentUser.apiKeys || {}) as Record<string, any>

    const updatedApiKeys = {
      ...currentApiKeys,
      [`${provider}_api_key`]: encryptedKey,
      created_at: currentApiKeys.created_at || new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        apiKeys: updatedApiKeys,
        updatedAt: new Date(),
      },
    })

    console.log(
      `BYO API key set for user ${userId}, provider: ${provider}, key: ${maskSensitiveData(apiKey)}`
    )

    return true
  }

  /**
   * Remove BYO API key
   */
  static async removeBYOApiKey(
    userId: string,
    provider: 'gemini' | 'openai' | 'anthropic'
  ) {
    const currentUser = await this.getUserById(userId)
    if (!currentUser) {
      throw new Error('User not found')
    }

    const currentApiKeys = (currentUser.apiKeys || {}) as Record<string, any>
    const updatedApiKeys = { ...currentApiKeys }
    delete updatedApiKeys[`${provider}_api_key`]

    await prisma.user.update({
      where: { id: userId },
      data: {
        apiKeys:
          Object.keys(updatedApiKeys).length > 2
            ? (updatedApiKeys as any)
            : null,
        updatedAt: new Date(),
      },
    })

    return true
  }

  /**
   * Get BYO API key for a provider
   */
  static async getBYOApiKey(
    userId: string,
    provider: 'gemini' | 'openai' | 'anthropic'
  ): Promise<string | null> {
    const user = await this.getUserById(userId)
    if (!user || !user.apiKeys) {
      return null
    }

    return user.apiKeys[`${provider}_api_key`] || null
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: UserRole
  ) {
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    })

    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new Error('Insufficient permissions')
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        role: newRole,
        updatedAt: new Date(),
      },
    })

    console.log(
      `User ${targetUserId} role updated to ${newRole} by admin ${adminUserId}`
    )

    return true
  }

  /**
   * Get user usage statistics
   */
  static async getUserUsageStats(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [projectsToday, totalProjects, totalAssets, activeJobs] =
      await Promise.all([
        prisma.project.count({
          where: {
            userId,
            createdAt: { gte: today },
          },
        }),
        prisma.project.count({
          where: { userId },
        }),
        prisma.asset.count({
          where: { userId },
        }),
        prisma.job.count({
          where: {
            project: { userId },
            status: { in: ['QUEUED', 'RUNNING'] },
          },
        }),
      ])

    return {
      projects_today: projectsToday,
      total_projects: totalProjects,
      total_assets: totalAssets,
      active_jobs: activeJobs,
      last_activity: await this.getLastActivity(userId),
    }
  }

  /**
   * Get user's last activity
   */
  private static async getLastActivity(userId: string) {
    const lastProject = await prisma.project.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    })

    return lastProject?.updatedAt || null
  }

  /**
   * Delete user account and all associated data (GDPR compliance)
   */
  static async deleteUserAccount(userId: string) {
    // This will cascade delete all related data due to foreign key constraints
    await prisma.user.delete({
      where: { id: userId },
    })

    console.log(`User account ${userId} and all associated data deleted`)

    return true
  }

  /**
   * Export user data (GDPR compliance)
   */
  static async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: {
          include: {
            scenes: true,
            jobs: true,
          },
        },
        assets: true,
        presets: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Remove sensitive data from export
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        settings: user.settings,
      },
      projects: user.projects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        config: project.config,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        scenes: project.scenes,
        jobs: project.jobs.map(job => ({
          id: job.id,
          status: job.status,
          config: job.config,
          costEstimate: job.costEstimate,
          costActual: job.costActual,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
        })),
      })),
      assets: user.assets.map(asset => ({
        id: asset.id,
        type: asset.type,
        metadata: asset.metadata,
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt,
        expiresAt: asset.expiresAt,
      })),
      presets: user.presets,
    }

    return exportData
  }

  /**
   * Check if user can perform action based on role and limits
   */
  static async canPerformAction(
    userId: string,
    action: 'create_project' | 'generate_image' | 'use_tts' | 'use_byo_key'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user) {
      return { allowed: false, reason: 'User not found' }
    }

    // Check role-based permissions
    switch (action) {
      case 'use_byo_key':
        if (user.role === UserRole.USER) {
          return {
            allowed: false,
            reason: 'BYO API keys require Premium or Admin role',
          }
        }
        break
    }

    // Check usage limits based on role
    const stats = await this.getUserUsageStats(userId)

    switch (action) {
      case 'create_project':
        const limit = user.role === UserRole.USER ? 3 : 50
        if (stats.projects_today >= limit) {
          return {
            allowed: false,
            reason: `Daily project limit reached (${limit})`,
          }
        }
        break
    }

    return { allowed: true }
  }
}
