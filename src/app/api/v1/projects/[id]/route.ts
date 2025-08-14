import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  withApiHandler,
  HTTP_STATUS,
  ERROR_CODES,
} from '@/lib/api-utils'
import { withAuth, AuthContext } from '@/lib/auth-middleware'
import { ProjectService } from '@/lib/project-service'
import type { ProjectConfig, ProjectStatus } from '@/types'

interface RouteContext {
  params: { id: string }
}

// Validation schemas
const ProjectConfigUpdateSchema = z.object({
  aspect_ratio: z.enum(['9:16', '16:9', '1:1']).optional(),
  template: z
    .object({
      name: z.enum(['classic', 'dark', 'vivid']).optional(),
      transitions: z.enum(['none', 'fade', 'zoom']).optional(),
      transition_duration: z.number().min(100).max(2000).optional(),
      background_music: z.boolean().optional(),
      bgm_volume: z.number().min(-30).max(0).optional(),
    })
    .optional(),
  voice: z
    .object({
      type: z.enum(['male', 'female', 'natural']).optional(),
      speed: z.number().min(0.5).max(2.0).optional(),
      language: z.enum(['zh-TW', 'en']).optional(),
      accent: z.enum(['taiwan', 'mainland', 'hongkong']).optional(),
    })
    .optional(),
  generation: z
    .object({
      images_per_scene: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      image_quality: z.enum(['standard', 'high']).optional(),
      retry_attempts: z.number().min(1).max(5).optional(),
      timeout_seconds: z.number().min(60).max(600).optional(),
      smart_crop: z.boolean().optional(),
    })
    .optional(),
  safety: z
    .object({
      content_policy: z.enum(['strict', 'standard']).optional(),
      blocked_words: z.array(z.string()).optional(),
      error_strategy: z.enum(['skip', 'mask', 'fail']).optional(),
      adult_content: z.enum(['block', 'warn', 'allow']).optional(),
      violence_filter: z.boolean().optional(),
    })
    .optional(),
})

const UpdateProjectSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z
    .enum(['DRAFT', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED'])
    .optional(),
  config: ProjectConfigUpdateSchema.optional(),
})

/**
 * GET /api/v1/projects/[id] - Get project details
 */
export const GET = withApiHandler(
  async (request: NextRequest, context: RouteContext) => {
    return withAuth(request, async (req, authContext) => {
      const projectId = context.params.id

      if (!projectId) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Project ID is required',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      try {
        const projectService = new ProjectService(authContext)
        const project = await projectService.getProject(projectId, true)

        if (!project) {
          return notFoundResponse('Project')
        }

        return successResponse(project)
      } catch (error) {
        console.error('Error fetching project:', error)
        return errorResponse(
          ERROR_CODES.DATABASE_ERROR,
          error instanceof Error ? error.message : 'Failed to fetch project',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
      }
    })
  }
)

/**
 * PUT /api/v1/projects/[id] - Update project
 */
export const PUT = withApiHandler(
  async (request: NextRequest, context: RouteContext) => {
    return withAuth(request, async (req, authContext) => {
      const projectId = context.params.id

      if (!projectId) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Project ID is required',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      let body
      try {
        body = await req.json()
      } catch (error) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Invalid JSON in request body',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Validate request body
      const validation = UpdateProjectSchema.safeParse(body)
      if (!validation.success) {
        return validationErrorResponse(validation.error)
      }

      const { title, description, status, config } = validation.data

      try {
        const projectService = new ProjectService(authContext)
        const updatedProject = await projectService.updateProject(projectId, {
          title,
          description,
          status,
          config,
        })

        if (!updatedProject) {
          return notFoundResponse('Project')
        }

        return successResponse(updatedProject)
      } catch (error) {
        console.error('Error updating project:', error)
        return errorResponse(
          ERROR_CODES.DATABASE_ERROR,
          error instanceof Error ? error.message : 'Failed to update project',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
      }
    })
  }
)

/**
 * DELETE /api/v1/projects/[id] - Delete project
 */
export const DELETE = withApiHandler(
  async (request: NextRequest, context: RouteContext) => {
    return withAuth(request, async (req, authContext) => {
      const projectId = context.params.id

      if (!projectId) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Project ID is required',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      try {
        const projectService = new ProjectService(authContext)
        const deleted = await projectService.deleteProject(projectId)

        if (!deleted) {
          return notFoundResponse('Project')
        }

        return successResponse(
          { message: 'Project deleted successfully' },
          HTTP_STATUS.OK
        )
      } catch (error) {
        console.error('Error deleting project:', error)
        return errorResponse(
          ERROR_CODES.DATABASE_ERROR,
          error instanceof Error ? error.message : 'Failed to delete project',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
      }
    })
  }
)

/**
 * OPTIONS /api/v1/projects/[id] - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
