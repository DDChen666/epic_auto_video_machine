import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandling } from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { HTTP_STATUS } from '@/lib/constants'

/**
 * GET /api/v1/user/profile - Get user profile
 */
async function handleGetProfile(request: NextRequest, context: any) {
  const user = await UserService.getUserById(context.userId)

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

  // Remove sensitive data from response
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
      usage: await UserService.getUserUsageStats(context.userId),
    },
  })
}

/**
 * PUT /api/v1/user/profile - Update user profile
 */
async function handleUpdateProfile(request: NextRequest, context: any) {
  const body = await request.json()
  const { settings } = body

  if (!settings) {
    return NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_INVALID_INPUT',
        message: 'Settings are required',
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    )
  }

  try {
    const updatedSettings = await UserService.updateUserSettings(
      context.userId,
      settings
    )

    return NextResponse.json({
      success: true,
      data: { settings: updatedSettings },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'UPDATE_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to update profile',
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

export const GET = withAuth(handleGetProfile)
export const PUT = withAuth(handleUpdateProfile)
