import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  withApiHandler,
  HTTP_STATUS,
  ERROR_CODES,
} from '@/lib/api-utils'
import { withAuth, AuthContext } from '@/lib/auth-middleware'
import { ProjectService } from '@/lib/project-service'
import { DEFAULT_PROJECT_CONFIG } from '@/types'
import type { ProjectConfig, ProjectStatus } from '@/types'

// Validation schemas
const ProjectConfigSchema = z.object({
  aspect_ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  template: z.object({
    name: z.enum(['classic', 'dark', 'vivid']).default('classic'),
    transitions: z.enum(['none', 'fade', 'zoom']).default('fade'),
    transition_duration: z.number().min(100).max(2000).default(500),
    background_music: z.boolean().default(true),
    bgm_volume: z.number().min(-30).max(0).default(-18),
  }).default(DEFAULT_PROJECT_CONFIG.template),
  voice: z.object({
    type: z.enum(['male', 'female', 'natural']).default('natural'),
    speed: z.number().min(0.5).max(2.0).default(1.0),
    language: z.enum(['zh-TW', 'en']).default('zh-TW'),
    accent: z.enum(['taiwan', 'mainland', 'hongkong']).default('taiwan'),
  }).default(DEFAULT_PROJECT_CONFIG.voice),
  generation: z.object({
    images_per_scene: z.enum([1, 2, 3]).default(1),
    image_quality: z.enum(['standard', 'high']).default('standard'),
    retry_attempts: z.number().min(1).max(5).default(3),
    timeout_seconds: z.number().min(60).max(600).default(300),
    smart_crop: z.boolean().default(true),
  }).default(DEFAULT_PROJECT_CONFIG.generation),
  safety: z.object({
    content_policy: z.enum(['strict', 'standard']).default('standard'),
    blocked_words: z.array(z.string()).default([]),
    error_strategy: z.enum(['skip', 'mask', 'fail']).default('skip'),
    adult_content: z.enum(['block', 'warn', 'allow']).default('block'),
    violence_filter: z.boolean().default(true),
  }).default(DEFAULT_PROJECT_CONFIG.safety),
})

const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  config: ProjectConfigSchema.optional(),
})

const ListProjectsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  status: z
    .enum(['DRAFT', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED'])
    .optional(),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'updated_at', 'title']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * GET /api/v1/projects - List projects
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  return withAuth(request, async (req, context) => {
    const { searchParams } = new URL(req.url)
    
    // Parse and validate query parameters
    const queryParams = Object.fromEntries(searchParams.entries())
    const validation = ListProjectsSchema.safeParse(queryParams)
    
    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const { page, limit, status, search, sort, order } = validation.data

    try {
      const projectService = new ProjectService(context)
      const result = await projectService.listProjects({
        page,
        limit,
        status,
        search,
        sort,
        order,
      })

      return successResponse(result)
    } catch (error) {
      console.error('Error listing projects:', error)
      return errorResponse(
        ERROR_CODES.DATABASE_ERROR,
        error instanceof Error ? error.message : 'Failed to list projects',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  })
})

/**
 * POST /api/v1/projects - Create a new project
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  return withAuth(request, async (req, context) => {
    let body
    try {
      body = await req.json()
    } catch (error) {
      return errorResponse(
        ERROR_CODES.INVALID_INPUT,
        'Invalid JSON in request body',
        HTTP_STATUS.BAD_REQUEST
      )
    }

    // Validate request body
    const validation = CreateProjectSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error)
    }

    const { title, description, config } = validation.data

    try {
      const projectService = new ProjectService(context)
      
      // Merge with default config
      const projectConfig: ProjectConfig = {
        ...DEFAULT_PROJECT_CONFIG,
        ...config,
      }

      const newProject = await projectService.createProject({
        title,
        description,
        config: projectConfig,
      })

      return successResponse(newProject, HTTP_STATUS.CREATED)
    } catch (error) {
      console.error('Error creating project:', error)
      return errorResponse(
        ERROR_CODES.DATABASE_ERROR,
        error instanceof Error ? error.message : 'Failed to create project',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  })
})

/**
 * OPTIONS /api/v1/projects - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
