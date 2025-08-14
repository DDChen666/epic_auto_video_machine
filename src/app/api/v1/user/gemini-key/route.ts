import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GeminiKeyManager } from '@/lib/gemini-key-manager'
import { HTTP_STATUS } from '@/lib/api-utils'
import { z } from 'zod'

const SetKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

const ValidateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

/**
 * GET /api/v1/user/gemini-key
 * Get BYO Gemini API key status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const status = await GeminiKeyManager.getApiKeyStatus(session.user.id)
    
    return NextResponse.json({
      success: true,
      data: status,
    })
  } catch (error) {
    console.error('Error getting Gemini API key status:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to get API key status' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * POST /api/v1/user/gemini-key
 * Set BYO Gemini API key
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
    const validation = SetKeySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const { apiKey } = validation.data
    const result = await GeminiKeyManager.setBYOApiKey(session.user.id, apiKey)
    
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: result.error || 'Failed to set API key',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'API key set successfully',
    })
  } catch (error) {
    console.error('Error setting Gemini API key:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to set API key' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * DELETE /api/v1/user/gemini-key
 * Remove BYO Gemini API key
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    await GeminiKeyManager.removeBYOApiKey(session.user.id)
    
    return NextResponse.json({
      success: true,
      message: 'API key removed successfully',
    })
  } catch (error) {
    console.error('Error removing Gemini API key:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to remove API key' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

/**
 * POST /api/v1/user/gemini-key/validate
 * Validate a Gemini API key without storing it
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await request.json()
    const validation = ValidateKeySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    const { apiKey } = validation.data
    const result = await GeminiKeyManager.validateApiKey(apiKey)
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error validating Gemini API key:', error)
    
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to validate API key' 
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}