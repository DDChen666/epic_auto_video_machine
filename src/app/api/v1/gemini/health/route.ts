import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GeminiService } from '@/lib/gemini-service'
import { GeminiKeyManager } from '@/lib/gemini-key-manager'
import { HTTP_STATUS } from '@/lib/api-utils'

/**
 * GET /api/v1/gemini/health
 * Get Gemini service health status and regional availability
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    // Get user's Gemini service instance
    const service = await GeminiService.create(session.user.id)

    // Get comprehensive health check
    const healthStatus = await service.healthCheck()

    // Get regional availability
    const regionalAvailability =
      await GeminiKeyManager.checkRegionalAvailability()

    // Get user's BYO key status
    const keyStatus = await GeminiKeyManager.getApiKeyStatus(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        service: healthStatus,
        regions: regionalAvailability,
        userKey: keyStatus,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error getting Gemini health status:', error)

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get service health status',
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * POST /api/v1/gemini/health/quota-check
 * Check if user has sufficient quota for a specific operation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await request.json()
    const { textRequests = 0, imageRequests = 0, ttsRequests = 0 } = body

    // Validate input
    if (textRequests < 0 || imageRequests < 0 || ttsRequests < 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Request counts must be non-negative',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const quotaCheck = await GeminiKeyManager.checkQuotaForOperation(
      session.user.id,
      { textRequests, imageRequests, ttsRequests }
    )

    return NextResponse.json({
      success: true,
      data: quotaCheck,
    })
  } catch (error) {
    console.error('Error checking quota:', error)

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check quota',
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}
