import { DatabaseService, handlePrismaError, prisma } from './db'
import type {
  ProjectConfig,
  ProjectStatus,
  Project,
  Scene,
  CostEstimate,
  AuthContext,
} from '@/types'

export class ProjectService {
  private db: ReturnType<typeof DatabaseService.getUserScopedClient>
  private userId?: string

  constructor(authContext?: AuthContext) {
    this.userId = authContext?.userId
    this.db = authContext
      ? DatabaseService.getUserScopedClient(authContext.userId)
      : prisma as any // Fallback to direct prisma client
  }

  /**
   * Create a new project
   */
  async createProject(data: {
    title: string
    description?: string
    config: ProjectConfig
  }) {
    try {
      const project = await this.db.project.create({
        data: {
          title: data.title,
          description: data.description,
          status: 'DRAFT',
          config: data.config,
        },
        include: {
          _count: {
            select: {
              scenes: true,
              jobs: true,
            },
          },
        },
      })

      return this.transformProject(project)
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string, includeDetails = false) {
    try {
      const project = await this.db.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: includeDetails
            ? {
                orderBy: { index: 'asc' },
                include: {
                  imageAsset: {
                    select: {
                      id: true,
                      uri: true,
                      metadata: true,
                    },
                  },
                },
              }
            : false,
          jobs: includeDetails
            ? {
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                  id: true,
                  status: true,
                  costEstimate: true,
                  costActual: true,
                  startedAt: true,
                  finishedAt: true,
                  errorDetail: true,
                  createdAt: true,
                },
              }
            : false,
          _count: {
            select: {
              scenes: true,
              jobs: true,
            },
          },
        },
      })

      if (!project) {
        return null
      }

      return this.transformProject(project, includeDetails)
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * List projects with filtering and pagination
   */
  async listProjects(
    options: {
      page?: number
      limit?: number
      status?: ProjectStatus
      search?: string
      sort?: 'created_at' | 'updated_at' | 'title'
      order?: 'asc' | 'desc'
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sort = 'updated_at',
      order = 'desc',
    } = options

    try {
      // Build where clause
      const where: any = {}
      if (status) {
        where.status = status
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Build order by clause
      const orderBy: any = {}
      orderBy[sort] = order

      // Get total count and projects
      const [total, projects] = await Promise.all([
        prisma.project.count({ where: { ...where, userId: this.userId } }),
        this.db.project.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            scenes: {
              select: {
                id: true,
                index: true,
              },
              orderBy: { index: 'asc' },
            },
            jobs: {
              select: {
                id: true,
                status: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: {
              select: {
                scenes: true,
                jobs: true,
              },
            },
          },
        }),
      ])

      return {
        projects: projects.map(project => this.transformProject(project)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: {
      title?: string
      description?: string
      status?: ProjectStatus
      config?: Partial<ProjectConfig>
    }
  ) {
    try {
      // First get existing project
      const existingProject = await this.db.project.findUnique({
        where: { id: projectId },
        select: { id: true, config: true, status: true },
      })

      if (!existingProject) {
        return null
      }

      // Validate status transitions
      if (
        updates.status &&
        !this.isValidStatusTransition(
          existingProject.status as ProjectStatus,
          updates.status
        )
      ) {
        throw new Error(
          `Cannot transition from ${existingProject.status} to ${updates.status}`
        )
      }

      // Merge config updates
      let updatedConfig = existingProject.config as ProjectConfig
      if (updates.config) {
        updatedConfig = this.mergeProjectConfig(updatedConfig, updates.config)
      }

      // Build update data
      const updateData: any = {}
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.description !== undefined)
        updateData.description = updates.description
      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.config !== undefined) updateData.config = updatedConfig

      // Update project
      const updatedProject = await this.db.project.update({
        where: { id: projectId },
        data: updateData,
        include: {
          _count: {
            select: {
              scenes: true,
              jobs: true,
            },
          },
        },
      })

      return this.transformProject(updatedProject)
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string) {
    try {
      // Check if project exists and has active jobs
      const existingProject = await this.db.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          status: true,
          jobs: {
            where: { status: { in: ['QUEUED', 'RUNNING'] } },
            select: { id: true },
          },
        },
      })

      if (!existingProject) {
        return null
      }

      // Prevent deletion if there are active jobs
      if (existingProject.jobs.length > 0) {
        throw new Error(
          'Cannot delete project with active jobs. Please cancel or wait for jobs to complete.'
        )
      }

      // Delete project (cascade will handle related records)
      await this.db.project.delete({
        where: { id: projectId },
      })

      return true
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Update project scenes
   */
  async updateProjectScenes(
    projectId: string,
    scenes: Array<{ index: number; text: string; prompt?: string }>
  ) {
    try {
      // First, delete existing scenes for this project
      await this.db.scene.deleteMany({
        where: { projectId },
      })

      // Create new scenes
      const sceneData = scenes.map(scene => ({
        projectId,
        index: scene.index,
        text: scene.text,
        prompt: scene.prompt,
      }))

      await this.db.scene.createMany({
        data: sceneData,
      })

      return true
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Update scene prompts from prompt generation results
   */
  async updateScenePrompts(
    projectId: string,
    promptResults: Array<{
      sceneIndex: number
      visualPrompt: string
      success: boolean
    }>
  ) {
    try {
      // Update each scene with its generated prompt
      const updatePromises = promptResults.map(result => {
        if (result.success) {
          return this.db.scene.updateMany({
            where: {
              projectId,
              index: result.sceneIndex,
            },
            data: {
              prompt: result.visualPrompt,
            },
          })
        }
        return Promise.resolve()
      })

      await Promise.all(updatePromises)
      return true
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Get project with scenes (for prompt generation)
   */
  async getProjectWithScenes(projectId: string, userId: string) {
    try {
      const project = await this.db.project.findUnique({
        where: {
          id: projectId,
          userId: userId,
        },
        include: {
          scenes: {
            orderBy: { index: 'asc' },
            select: {
              id: true,
              index: true,
              text: true,
              prompt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      })

      if (!project) {
        return null
      }

      return {
        ...project,
        config: project.config as ProjectConfig,
        scenes: project.scenes,
      }
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Estimate project cost based on configuration and scenes
   */
  async estimateProjectCost(projectId: string): Promise<CostEstimate> {
    try {
      const project = await this.db.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: {
            select: {
              text: true,
            },
          },
        },
      })

      if (!project) {
        throw new Error('Project not found')
      }

      const config = project.config as ProjectConfig
      const sceneCount = project.scenes.length
      const totalCharacters = project.scenes.reduce(
        (sum, scene) => sum + scene.text.length,
        0
      )

      // Cost calculation (these would be real pricing in production)
      const PRICING = {
        TEXT_PER_TOKEN: 0.000002, // $0.000002 per token
        IMAGE_PER_GENERATION: 0.04, // $0.04 per image
        TTS_PER_CHARACTER: 0.000016, // $0.000016 per character
        RENDER_PER_SECOND: 0.01, // $0.01 per second of video
      }

      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(totalCharacters / 4)
      const imageCount = sceneCount * config.generation.images_per_scene
      const estimatedDuration = sceneCount * 3 // Assume 3 seconds per scene

      const llmCost = estimatedTokens * PRICING.TEXT_PER_TOKEN
      const imageCost = imageCount * PRICING.IMAGE_PER_GENERATION
      const ttsCost = totalCharacters * PRICING.TTS_PER_CHARACTER
      const renderCost = estimatedDuration * PRICING.RENDER_PER_SECOND

      const totalMin = (llmCost + imageCost + ttsCost + renderCost) * 0.8 // -20% variance
      const totalMax = (llmCost + imageCost + ttsCost + renderCost) * 1.2 // +20% variance

      return {
        llm_cost: llmCost,
        image_cost: imageCost,
        tts_cost: ttsCost,
        render_cost: renderCost,
        total_min: totalMin,
        total_max: totalMax,
        currency: 'USD',
      }
    } catch (error) {
      throw handlePrismaError(error)
    }
  }

  /**
   * Validate project status transition
   */
  private isValidStatusTransition(
    currentStatus: ProjectStatus,
    newStatus: ProjectStatus
  ): boolean {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      DRAFT: ['READY', 'FAILED'],
      READY: ['PROCESSING', 'DRAFT'],
      PROCESSING: ['COMPLETED', 'FAILED'],
      COMPLETED: ['DRAFT'], // Allow re-editing completed projects
      FAILED: ['DRAFT', 'READY'], // Allow retry from failed state
    }

    return validTransitions[currentStatus]?.includes(newStatus) ?? false
  }

  /**
   * Merge project configuration updates
   */
  private mergeProjectConfig(
    existing: ProjectConfig,
    updates: Partial<ProjectConfig>
  ): ProjectConfig {
    const merged = { ...existing }

    if (updates.aspect_ratio) {
      merged.aspect_ratio = updates.aspect_ratio
    }

    if (updates.template) {
      merged.template = { ...merged.template, ...updates.template }
    }

    if (updates.voice) {
      merged.voice = { ...merged.voice, ...updates.voice }
    }

    if (updates.generation) {
      merged.generation = { ...merged.generation, ...updates.generation }
    }

    if (updates.safety) {
      merged.safety = { ...merged.safety, ...updates.safety }
    }

    return merged
  }

  /**
   * Transform database project to API response format
   */
  private transformProject(project: any, includeDetails = false) {
    const base = {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      config: project.config as ProjectConfig,
      scene_count: project._count?.scenes || 0,
      job_count: project._count?.jobs || 0,
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString(),
    }

    if (!includeDetails) {
      return {
        ...base,
        latest_job: project.jobs?.[0]
          ? {
              id: project.jobs[0].id,
              status: project.jobs[0].status,
              created_at: project.jobs[0].createdAt.toISOString(),
            }
          : null,
      }
    }

    return {
      ...base,
      scenes:
        project.scenes?.map((scene: any) => ({
          id: scene.id,
          index: scene.index,
          text: scene.text,
          prompt: scene.prompt,
          image_asset: scene.imageAsset,
          created_at: scene.createdAt.toISOString(),
          updated_at: scene.updatedAt.toISOString(),
        })) || [],
      jobs:
        project.jobs?.map((job: any) => ({
          id: job.id,
          status: job.status,
          cost_estimate: job.costEstimate,
          cost_actual: job.costActual,
          started_at: job.startedAt?.toISOString(),
          finished_at: job.finishedAt?.toISOString(),
          error_detail: job.errorDetail,
          created_at: job.createdAt.toISOString(),
        })) || [],
    }
  }
}
