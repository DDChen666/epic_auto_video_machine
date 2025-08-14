import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandling } from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { HTTP_STATUS } from '@/lib/constants'

/**
 * GET /api/v1/user/data-export - Export user data (GDPR compliance)
 */
async function handleDataExport(request: NextRequest, context: any) {
  try {
    const exportData = await UserService.exportUserData(context.userId)
    
    return NextResponse.json({
      success: true,
      data: exportData,
      exported_at: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'DATA_EXPORT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to export data',
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }
}

export const GET = withAuth(handleDataExport)