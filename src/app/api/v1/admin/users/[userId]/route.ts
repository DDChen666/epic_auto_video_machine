import { NextRequest, NextResponse } from 'next/server'
import {
  withAuth,
  withAuthorization,
  withErrorHandling,
} from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { HTTP_STATUS } from '@/lib/constants'
import { UserRole } from '@prisma/client'

interface RouteContext {
  params: { userId: string }
}

/**
 * GET /api/v1/admin/users/[userId] - Get user details (admin only)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(async (req: NextRequest) => {
    return withAuthorization(
      UserRole.ADMIN,
      req,
      context,
      async (authReq, authCtx) => {
        const userId = context.params.userId

        if (!userId) {
          return NextResponse.json(
            {
              success: false,
              error: 'VALIDATION_INVALID_INPUT',
              message: 'User ID is required',
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }

        try {
          const user = await UserService.getUserById(userId)

          if (!user) {
            return NextResponse.json(
              {
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'User not found',
              },
              { status: HTTP_STATUS.NOT_FOUND }
            )
          }

          // Remove sensitive API keys from admin view
          const { apiKeys, ...safeUser } = user
          const maskedApiKeys = apiKeys
            ? {
                gemini_api_key: apiKeys.gemini_api_key ? '****' : null,
                openai_api_key: apiKeys.openai_api_key ? '****' : null,
                anthropic_api_key: apiKeys.anthropic_api_key ? '****' : null,
                created_at: apiKeys.created_at,
                last_used_at: apiKeys.last_used_at,
              }
            : null

          return NextResponse.json({
            success: true,
            data: {
              ...safeUser,
              apiKeys: maskedApiKeys,
              usage: await UserService.getUserUsageStats(userId),
            },
          })
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: 'GET_USER_FAILED',
              message:
                error instanceof Error ? error.message : 'Failed to get user',
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }
      }
    )
  })(request)
}

/**
 * PUT /api/v1/admin/users/[userId] - Update user role (admin only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  return withAuth(async (req: NextRequest) => {
    return withAuthorization(
      UserRole.ADMIN,
      req,
      context,
      async (authReq, authCtx) => {
        const userId = context.params.userId

        if (!userId) {
          return NextResponse.json(
            {
              success: false,
              error: 'VALIDATION_INVALID_INPUT',
              message: 'User ID is required',
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }

        const body = await req.json()
        const { role } = body

        if (!role || !Object.values(UserRole).includes(role)) {
          return NextResponse.json(
            {
              success: false,
              error: 'VALIDATION_INVALID_INPUT',
              message: 'Valid role is required (USER, PREMIUM, ADMIN)',
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }

        try {
          await UserService.updateUserRole(authCtx.userId, userId, role)

          return NextResponse.json({
            success: true,
            message: `User role updated to ${role}`,
          })
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: 'UPDATE_USER_FAILED',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to update user',
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }
      }
    )
  })(request)
}

/**
 * DELETE /api/v1/admin/users/[userId] - Delete user account (admin only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withAuth(async (req: NextRequest) => {
    return withAuthorization(
      UserRole.ADMIN,
      req,
      context,
      async (authReq, authCtx) => {
        const userId = context.params.userId

        if (!userId) {
          return NextResponse.json(
            {
              success: false,
              error: 'VALIDATION_INVALID_INPUT',
              message: 'User ID is required',
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }

        // Prevent admin from deleting themselves
        if (userId === authCtx.userId) {
          return NextResponse.json(
            {
              success: false,
              error: 'VALIDATION_INVALID_INPUT',
              message: 'Cannot delete your own account',
            },
            { status: HTTP_STATUS.BAD_REQUEST }
          )
        }

        try {
          await UserService.deleteUserAccount(userId)

          return NextResponse.json({
            success: true,
            message: 'User account deleted successfully',
          })
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: 'DELETE_USER_FAILED',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to delete user',
            },
            { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
          )
        }
      }
    )
  })(request)
}
