import { NextRequest, NextResponse } from 'next/server'
import {
  withAuth,
  withAuthorization,
  withErrorHandling,
} from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { HTTP_STATUS } from '@/lib/constants'
import { UserRole } from '@prisma/client'

/**
 * POST /api/v1/user/api-keys - Set BYO API key
 */
async function handleSetApiKey(request: NextRequest, context: any) {
  return withAuthorization(
    UserRole.PREMIUM,
    request,
    context,
    async (req, ctx) => {
      const body = await req.json()
      const { provider, apiKey } = body

      if (!provider || !apiKey) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_INVALID_INPUT',
            message: 'Provider and API key are required',
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }

      if (!['gemini', 'openai', 'anthropic'].includes(provider)) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_INVALID_INPUT',
            message:
              'Invalid provider. Must be one of: gemini, openai, anthropic',
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }

      try {
        await UserService.setBYOApiKey(ctx.userId, provider, apiKey)

        return NextResponse.json({
          success: true,
          message: `${provider} API key set successfully`,
        })
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'SET_API_KEY_FAILED',
            message:
              error instanceof Error ? error.message : 'Failed to set API key',
          },
          { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
        )
      }
    }
  )
}

/**
 * DELETE /api/v1/user/api-keys - Remove BYO API key
 */
async function handleRemoveApiKey(request: NextRequest, context: any) {
  return withAuthorization(
    UserRole.PREMIUM,
    request,
    context,
    async (req, ctx) => {
      const url = new URL(req.url)
      const provider = url.searchParams.get('provider')

      if (!provider) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_INVALID_INPUT',
            message: 'Provider parameter is required',
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }

      if (!['gemini', 'openai', 'anthropic'].includes(provider)) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_INVALID_INPUT',
            message:
              'Invalid provider. Must be one of: gemini, openai, anthropic',
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        )
      }

      try {
        await UserService.removeBYOApiKey(ctx.userId, provider as any)

        return NextResponse.json({
          success: true,
          message: `${provider} API key removed successfully`,
        })
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'REMOVE_API_KEY_FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to remove API key',
          },
          { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
        )
      }
    }
  )
}

export const POST = withAuth(handleSetApiKey)
export const DELETE = withAuth(handleRemoveApiKey)
