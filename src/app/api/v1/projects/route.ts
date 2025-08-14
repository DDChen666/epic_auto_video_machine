import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  withApiHandler,
  HTTP_STATUS,
  ERROR_CODES,
} from '@/lib/api-utils'
import { withMetrics } from '@/lib/monitoring'
import { withRateLimit, apiRateLimit } from '@/lib/rate-limit'

// Validation schemas
const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  config: z
    .object({
      aspect_ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
      template: z.enum(['classic', 'dark', 'vivid']).default('classic'),
      voice: z.enum(['male', 'female', 'natural']).default('natural'),
    })
    .optional(),
})

const ListProjectsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  status: z
    .enum(['draft', 'ready', 'processing', 'completed', 'failed'])
    .optional(),
})

/**
 * GET /api/v1/projects - List projects
 */
export const GET = withMetrics(
  withRateLimit(
    apiRateLimit,
    withApiHandler(async (request: NextRequest) => {
      const { searchParams } = new URL(request.url)

      // Parse query parameters with defaults
      const page = parseInt(searchParams.get('page') || '1', 10)
      const limit = Math.min(
        parseInt(searchParams.get('limit') || '20', 10),
        100
      )
      const status = searchParams.get('status') as
        | 'draft'
        | 'ready'
        | 'processing'
        | 'completed'
        | 'failed'
        | null

      // Validate parameters
      if (isNaN(page) || page < 1) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Invalid page parameter',
          HTTP_STATUS.BAD_REQUEST
        )
      }
      if (isNaN(limit) || limit < 1) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Invalid limit parameter',
          HTTP_STATUS.BAD_REQUEST
        )
      }
      if (
        status &&
        !['draft', 'ready', 'processing', 'completed', 'failed'].includes(
          status
        )
      ) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Invalid status parameter',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // TODO: Replace with actual database query
      const mockProjects = [
        {
          id: 'proj_1',
          title: 'My First Video',
          description: 'A test video project',
          status: 'draft',
          config: {
            aspect_ratio: '9:16',
            template: 'classic',
            voice: 'natural',
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      const filteredProjects = status
        ? mockProjects.filter(p => p.status === status)
        : mockProjects

      const total = filteredProjects.length
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const projects = filteredProjects.slice(startIndex, endIndex)

      return successResponse({
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: endIndex < total,
          hasPrev: page > 1,
        },
      })
    })
  )
)

/**
 * POST /api/v1/projects - Create a new project
 */
export const POST = withMetrics(
  withRateLimit(
    apiRateLimit,
    withApiHandler(async (request: NextRequest) => {
      let body
      try {
        body = await request.json()
      } catch (error) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Invalid JSON in request body',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Validate request body
      const validation = CreateProjectSchema.safeParse(body)
      if (!validation.success) {
        return validationErrorResponse(validation.error)
      }

      const { title, description, config } = validation.data

      // TODO: Replace with actual database creation
      const newProject = {
        id: `proj_${Date.now()}`,
        title,
        description,
        status: 'draft' as const,
        config: {
          aspect_ratio: '9:16' as const,
          template: 'classic' as const,
          voice: 'natural' as const,
          ...config,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return successResponse(newProject, HTTP_STATUS.CREATED)
    })
  )
)

/**
 * OPTIONS /api/v1/projects - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
