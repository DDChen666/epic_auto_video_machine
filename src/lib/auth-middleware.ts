import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { DatabaseService } from './db'
import { ERROR_CODES, HTTP_STATUS } from './constants'

export interface AuthContext {
  userId: string
  userRole: 'USER' | 'PREMIUM' | 'ADMIN'
  email: string
}

/**
 * Authentication middleware for API routes
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || !token.sub) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_CODES.AUTH_INVALID_TOKEN,
          message: 'Authentication required',
        },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const context: AuthContext = {
      userId: token.sub,
      userRole: (token.role as 'USER' | 'PREMIUM' | 'ADMIN') || 'USER',
      email: token.email || '',
    }

    return await handler(request, context)
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return NextResponse.json(
      {
        success: false,
        error: ERROR_CODES.AUTH_INVALID_TOKEN,
        message: 'Authentication failed',
      },
      { status: HTTP_STATUS.UNAUTHORIZED }
    )
  }
}

/**
 * Authorization middleware for role-based access control
 */
export async function withAuthorization(
  requiredRole: 'USER' | 'PREMIUM' | 'ADMIN',
  request: NextRequest,
  context: AuthContext,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const roleHierarchy = {
    USER: 0,
    PREMIUM: 1,
    ADMIN: 2,
  }

  if (roleHierarchy[context.userRole] < roleHierarchy[requiredRole]) {
    return NextResponse.json(
      {
        success: false,
        error: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: `${requiredRole} role required`,
      },
      { status: HTTP_STATUS.FORBIDDEN }
    )
  }

  return await handler(request, context)
}

/**
 * Resource ownership verification middleware
 */
export async function withResourceOwnership(
  resourceType: 'project' | 'asset' | 'preset',
  resourceIdParam: string,
  request: NextRequest,
  context: AuthContext,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const resourceId = url.pathname.split('/').find((segment, index, array) => {
      return array[index - 1] === resourceIdParam
    })

    if (!resourceId) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_CODES.VALIDATION_INVALID_INPUT,
          message: `${resourceIdParam} parameter required`,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Skip ownership check for admins
    if (context.userRole === 'ADMIN') {
      return await handler(request, context)
    }

    const hasOwnership = await DatabaseService.verifyUserOwnership(
      context.userId,
      resourceType,
      resourceId
    )

    if (!hasOwnership) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          message: 'Resource not found or access denied',
        },
        { status: HTTP_STATUS.NOT_FOUND }
      )
    }

    return await handler(request, context)
  } catch (error) {
    console.error('Resource ownership verification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
        message: 'Access verification failed',
      },
      { status: HTTP_STATUS.FORBIDDEN }
    )
  }
}

/**
 * Rate limiting middleware (simplified implementation)
 */
export async function withRateLimit(
  limit: number,
  windowMs: number,
  request: NextRequest,
  context: AuthContext,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  // In production, you'd use Redis or a proper rate limiting service
  // This is a simplified in-memory implementation for development
  const key = `rate_limit:${context.userId}:${request.nextUrl.pathname}`

  // For now, just proceed - implement proper rate limiting with Redis in production
  return await handler(request, context)
}

/**
 * Multi-tenant data isolation middleware
 */
export function createTenantScopedHandler<T>(
  handler: (
    req: NextRequest,
    context: AuthContext,
    db: ReturnType<typeof DatabaseService.getUserScopedClient>
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: AuthContext
  ): Promise<NextResponse> => {
    const scopedDb = DatabaseService.getUserScopedClient(context.userId)
    return await handler(request, context, scopedDb)
  }
}

/**
 * Input validation middleware
 */
export async function withValidation<T>(
  schema: (data: any) => { success: boolean; data?: T; error?: any },
  request: NextRequest,
  context: AuthContext,
  handler: (
    req: NextRequest,
    context: AuthContext,
    validatedData: T
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    let data: any

    if (request.method === 'GET') {
      const url = new URL(request.url)
      data = Object.fromEntries(url.searchParams.entries())
    } else {
      data = await request.json()
    }

    const validation = schema(data)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_CODES.VALIDATION_INVALID_INPUT,
          message: 'Invalid input data',
          details: validation.error,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    return await handler(request, context, validation.data!)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: ERROR_CODES.VALIDATION_INVALID_INPUT,
        message: 'Invalid JSON data',
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    )
  }
}

/**
 * Error handling wrapper
 */
export function withErrorHandling(
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: AuthContext
  ): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('API handler error:', error)

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          return NextResponse.json(
            {
              success: false,
              error: ERROR_CODES.DB_QUERY_TIMEOUT,
              message: 'Request timeout',
            },
            { status: HTTP_STATUS.GATEWAY_TIMEOUT }
          )
        }

        if (error.message.includes('connection')) {
          return NextResponse.json(
            {
              success: false,
              error: ERROR_CODES.DB_CONNECTION_FAILED,
              message: 'Database connection failed',
            },
            { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
          )
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }
  }
}

/**
 * Compose multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<
    (
      req: NextRequest,
      context: AuthContext,
      next: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
    ) => Promise<NextResponse>
  >
) {
  return (
    request: NextRequest,
    context: AuthContext,
    finalHandler: (
      req: NextRequest,
      context: AuthContext
    ) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const executeMiddleware = (index: number): Promise<NextResponse> => {
      if (index >= middlewares.length) {
        return finalHandler(request, context)
      }

      return middlewares[index](request, context, (req, ctx) =>
        executeMiddleware(index + 1)
      )
    }

    return executeMiddleware(0)
  }
}
