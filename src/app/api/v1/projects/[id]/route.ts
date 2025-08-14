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

interface RouteContext {
  params: { id: string }
}

// Validation schemas
const UpdateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  description: z.string().optional(),
  config: z.object({
    aspect_ratio: z.enum(['9:16', '16:9', '1:1']).optional(),
    template: z.enum(['classic', 'dark', 'vivid']).optional(),
    voice: z.enum(['male', 'female', 'natural']).optional(),
  }).optional(),
})

/**
 * GET /api/v1/projects/[id] - Get project details
 */
export const GET = withApiHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const projectId = context.params.id

  if (!projectId) {
    return errorResponse(
      ERROR_CODES.INVALID_INPUT,
      'Project ID is required',
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // TODO: Replace with actual database query
  if (projectId === 'proj_1') {
    const project = {
      id: projectId,
      title: 'My First Video',
      description: 'A test video project',
      status: 'draft',
      config: {
        aspect_ratio: '9:16',
        template: 'classic',
        voice: 'natural',
      },
      scenes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return successResponse(project)
  }

  return notFoundResponse('Project')
})

/**
 * PUT /api/v1/projects/[id] - Update project
 */
export const PUT = withApiHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
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
    body = await request.json()
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

  // TODO: Replace with actual database query and update
  if (projectId !== 'proj_1') {
    return notFoundResponse('Project')
  }

  const updatedProject = {
    id: projectId,
    title: body.title || 'My First Video',
    description: body.description || 'A test video project',
    status: 'draft',
    config: {
      aspect_ratio: '9:16',
      template: 'classic',
      voice: 'natural',
      ...body.config,
    },
    scenes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return successResponse(updatedProject)
})

/**
 * DELETE /api/v1/projects/[id] - Delete project
 */
export const DELETE = withApiHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const projectId = context.params.id

  if (!projectId) {
    return errorResponse(
      ERROR_CODES.INVALID_INPUT,
      'Project ID is required',
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // TODO: Replace with actual database query and deletion
  if (projectId !== 'proj_1') {
    return notFoundResponse('Project')
  }

  return successResponse(
    { message: 'Project deleted successfully' },
    HTTP_STATUS.NO_CONTENT
  )
})

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