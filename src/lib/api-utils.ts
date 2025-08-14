import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// Standard API response format
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId?: string
    version: string
  }
}

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

// Error codes
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Processing errors
  PROCESSING_ERROR: 'PROCESSING_ERROR',

  // External API errors
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  GEMINI_API_ERROR: 'GEMINI_API_ERROR',
} as const

// Success response helper
export function successResponse<T>(
  data: T,
  status: number = HTTP_STATUS.OK,
  meta?: Partial<ApiResponse['meta']>
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...meta,
    },
  }

  return NextResponse.json(response, { status })
}

// Error response helper
export function errorResponse(
  code: string,
  message: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  details?: any
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  }

  return NextResponse.json(response, { status })
}

// Validation error helper
export function validationErrorResponse(
  error: ZodError | string,
  details?: any
): NextResponse<ApiResponse> {
  if (typeof error === 'string') {
    return errorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      error,
      HTTP_STATUS.BAD_REQUEST,
      details
    )
  }

  const formattedErrors =
    error.issues?.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })) || []

  return errorResponse(
    ERROR_CODES.VALIDATION_ERROR,
    'Validation failed',
    HTTP_STATUS.BAD_REQUEST,
    { errors: formattedErrors }
  )
}

// Not found error helper
export function notFoundResponse(
  resource: string = 'Resource'
): NextResponse<ApiResponse> {
  return errorResponse(
    ERROR_CODES.NOT_FOUND,
    `${resource} not found`,
    HTTP_STATUS.NOT_FOUND
  )
}

// Unauthorized error helper
export function unauthorizedResponse(
  message: string = 'Authentication required'
): NextResponse<ApiResponse> {
  return errorResponse(
    ERROR_CODES.UNAUTHORIZED,
    message,
    HTTP_STATUS.UNAUTHORIZED
  )
}

// Forbidden error helper
export function forbiddenResponse(
  message: string = 'Insufficient permissions'
): NextResponse<ApiResponse> {
  return errorResponse(ERROR_CODES.FORBIDDEN, message, HTTP_STATUS.FORBIDDEN)
}

// Rate limit error helper
export function rateLimitResponse(
  message: string = 'Rate limit exceeded'
): NextResponse<ApiResponse> {
  return errorResponse(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message,
    HTTP_STATUS.TOO_MANY_REQUESTS
  )
}

// Method not allowed helper
export function methodNotAllowedResponse(
  allowedMethods: string[] = []
): NextResponse<ApiResponse> {
  const response = errorResponse(
    ERROR_CODES.INVALID_INPUT,
    'Method not allowed',
    HTTP_STATUS.METHOD_NOT_ALLOWED,
    { allowedMethods }
  )

  if (allowedMethods.length > 0) {
    response.headers.set('Allow', allowedMethods.join(', '))
  }

  return response
}

// Generic error handler
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error)

  if (error instanceof ZodError) {
    return validationErrorResponse(error)
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found')) {
      return notFoundResponse()
    }

    if (error.message.includes('unauthorized')) {
      return unauthorizedResponse()
    }

    if (error.message.includes('forbidden')) {
      return forbiddenResponse()
    }

    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  }

  return errorResponse(
    ERROR_CODES.INTERNAL_ERROR,
    'An unexpected error occurred',
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  )
}

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// API middleware wrapper
export function withApiHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

// CORS headers helper
export function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  return response
}

// Health check response
export function healthCheckResponse(
  status: 'healthy' | 'unhealthy' = 'healthy',
  checks?: Record<string, boolean>
): NextResponse<ApiResponse> {
  const data = {
    status,
    timestamp: new Date().toISOString(),
    version: '1.0',
    checks: checks || {},
  }

  return successResponse(
    data,
    status === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE
  )
}

// Request validation helper
export function validateRequest<T>(schema: any, data: any): { success: true; data: T } | { success: false; errors: any } {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: error.issues }
    }
    return { success: false, errors: [{ message: 'Validation failed' }] }
  }
}

// Convenience aliases for backward compatibility
export const createSuccessResponse = successResponse
export const createErrorResponse = errorResponse
