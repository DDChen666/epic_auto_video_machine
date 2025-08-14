import { NextRequest, NextResponse } from 'next/server'
import {
  withAuth,
  withAuthorization,
  withErrorHandling,
} from '@/lib/auth-middleware'
import { UserService } from '@/lib/user-service'
import { prisma } from '@/lib/db'
import { HTTP_STATUS } from '@/lib/constants'
import { UserRole } from '@prisma/client'

/**
 * GET /api/v1/admin/users - List all users (admin only)
 */
async function handleListUsers(request: NextRequest, context: any) {
  return withAuthorization(
    UserRole.ADMIN,
    request,
    context,
    async (req, ctx) => {
      const url = new URL(req.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const search = url.searchParams.get('search')
      const role = url.searchParams.get('role') as UserRole | null

      const skip = (page - 1) * limit

      try {
        const where: any = {}

        if (search) {
          where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ]
        }

        if (role && Object.values(UserRole).includes(role)) {
          where.role = role
        }

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  projects: true,
                  assets: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.user.count({ where }),
        ])

        return NextResponse.json({
          success: true,
          data: {
            users,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          },
        })
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'LIST_USERS_FAILED',
            message:
              error instanceof Error ? error.message : 'Failed to list users',
          },
          { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
        )
      }
    }
  )
}

export const GET = withAuth(handleListUsers)
