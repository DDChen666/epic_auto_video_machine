import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  withApiHandler,
  HTTP_STATUS,
  ERROR_CODES,
} from '@/lib/api-utils'
import { withAuth } from '@/lib/auth-middleware'
import { ProjectService } from '@/lib/project-service'

interface RouteContext {
  params: { id: string }
}

/**
 * GET /api/v1/projects/[id]/estimate - Get project cost estimate
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
        const estimate = await projectService.estimateProjectCost(projectId)

        return successResponse(estimate)
      } catch (error) {
        console.error('Error estimating project cost:', error)
        
        if (error instanceof Error && error.message === 'Project not found') {
          return notFoundResponse('Project')
        }

        return errorResponse(
          ERROR_CODES.DATABASE_ERROR,
          error instanceof Error ? error.message : 'Failed to estimate project cost',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
      }
    })
  }
)

/**
 * OPTIONS /api/v1/projects/[id]/estimate - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}