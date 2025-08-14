import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandling } from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { HTTP_STATUS } from '@/lib/constants'

/**
 * DELETE /api/v1/user/delete-account - Delete user account and all data (GDPR compliance)
 */
async function handleDeleteAccount(request: NextRequest, context: any) {
  const body = await request.json()
  const { confirmation } = body

  // Require explicit confirmation
  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    return NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_INVALID_INPUT',
        message: 'Account deletion requires explicit confirmation',
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    )
  }

  try {
    await UserService.deleteUserAccount(context.userId)

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted',
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'DELETE_ACCOUNT_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to delete account',
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

export const DELETE = withAuth(handleDeleteAccount)
