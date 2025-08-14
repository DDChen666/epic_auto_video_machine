import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import DiscordProvider from 'next-auth/providers/discord'
import { prisma } from './db'
import { UserRole } from '@prisma/client'
import { DEFAULT_USER_SETTINGS } from './constants'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Allow sign in
        return true
      } catch (error) {
        console.error('Sign in error:', error)
        return false
      }
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        // Fetch user from database to get role and settings
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            settings: true,
          },
        })

        if (dbUser) {
          token.role = dbUser.role
          token.settings = dbUser.settings as UserSettings
        } else {
          // New user, set default role
          token.role = UserRole.USER
          token.settings = {
            ...DEFAULT_USER_SETTINGS,
            generation: {
              default_aspect_ratio: '9:16',
              default_template: 'classic',
              default_voice: 'natural',
              images_per_scene: 1,
              auto_segment: true,
              use_llm_segment: false,
            },
            safety: {
              content_policy: 'standard',
              blocked_words: [],
              error_strategy: 'skip',
            },
          } as UserSettings
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.settings = token.settings
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // Initialize new user with default settings
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.USER,
          settings: DEFAULT_USER_SETTINGS,
        },
      })
    },
    async signIn({ user, account, isNewUser }) {
      // Log sign in event
      console.log(`User ${user.email} signed in via ${account?.provider}`)

      // Update last sign in time if needed
      if (!isNewUser) {
        await prisma.user.update({
          where: { id: user.id },
          data: { updatedAt: new Date() },
        })
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
}

/**
 * Get server-side session
 */
export async function getServerSession() {
  const { getServerSession } = await import('next-auth')
  return await getServerSession(authOptions)
}

/**
 * Role hierarchy for authorization checks
 */
export const ROLE_HIERARCHY = {
  [UserRole.USER]: 0,
  [UserRole.PREMIUM]: 1,
  [UserRole.ADMIN]: 2,
} as const

/**
 * Check if user has required role or higher
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Permission definitions for RBAC
 */
export const PERMISSIONS = {
  // Project permissions
  PROJECT_CREATE: 'project:create',
  PROJECT_READ_OWN: 'project:read:own',
  PROJECT_READ_ALL: 'project:read:all',
  PROJECT_UPDATE_OWN: 'project:update:own',
  PROJECT_UPDATE_ALL: 'project:update:all',
  PROJECT_DELETE_OWN: 'project:delete:own',
  PROJECT_DELETE_ALL: 'project:delete:all',

  // Job permissions
  JOB_CREATE: 'job:create',
  JOB_READ_OWN: 'job:read:own',
  JOB_READ_ALL: 'job:read:all',
  JOB_CANCEL_OWN: 'job:cancel:own',
  JOB_CANCEL_ALL: 'job:cancel:all',

  // Asset permissions
  ASSET_READ_OWN: 'asset:read:own',
  ASSET_READ_ALL: 'asset:read:all',
  ASSET_DELETE_OWN: 'asset:delete:own',
  ASSET_DELETE_ALL: 'asset:delete:all',

  // Admin permissions
  USER_MANAGE: 'user:manage',
  SYSTEM_MONITOR: 'system:monitor',
  SETTINGS_MANAGE: 'settings:manage',

  // Premium features
  BYO_API_KEY: 'byo:api_key',
  PRIORITY_QUEUE: 'queue:priority',
  ADVANCED_TEMPLATES: 'templates:advanced',
} as const

/**
 * Role-based permission mapping
 */
const USER_PERMISSIONS = [
  PERMISSIONS.PROJECT_CREATE,
  PERMISSIONS.PROJECT_READ_OWN,
  PERMISSIONS.PROJECT_UPDATE_OWN,
  PERMISSIONS.PROJECT_DELETE_OWN,
  PERMISSIONS.JOB_CREATE,
  PERMISSIONS.JOB_READ_OWN,
  PERMISSIONS.JOB_CANCEL_OWN,
  PERMISSIONS.ASSET_READ_OWN,
  PERMISSIONS.ASSET_DELETE_OWN,
] as const

const PREMIUM_PERMISSIONS = [
  ...USER_PERMISSIONS,
  PERMISSIONS.BYO_API_KEY,
  PERMISSIONS.PRIORITY_QUEUE,
  PERMISSIONS.ADVANCED_TEMPLATES,
] as const

const ADMIN_PERMISSIONS = [
  ...PREMIUM_PERMISSIONS,
  PERMISSIONS.PROJECT_READ_ALL,
  PERMISSIONS.PROJECT_UPDATE_ALL,
  PERMISSIONS.PROJECT_DELETE_ALL,
  PERMISSIONS.JOB_READ_ALL,
  PERMISSIONS.JOB_CANCEL_ALL,
  PERMISSIONS.ASSET_READ_ALL,
  PERMISSIONS.ASSET_DELETE_ALL,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.SYSTEM_MONITOR,
  PERMISSIONS.SETTINGS_MANAGE,
] as const

export const ROLE_PERMISSIONS = {
  [UserRole.USER]: USER_PERMISSIONS,
  [UserRole.PREMIUM]: PREMIUM_PERMISSIONS,
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
} as const

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission as any)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role]
}
