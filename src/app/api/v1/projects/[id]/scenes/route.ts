import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SceneSegmentationService } from '@/lib/scene-segmentation-service'
import { ProjectService } from '@/lib/project-service'
import { validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { z } from 'zod'

// Request validation schemas
const segmentTextSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text too long'),
  config: z.object({
    min_length: z.number().min(50).max(500).optional(),
    max_length: z.number().min(100).max(1000).optional(),
    use_llm: z.boolean().optional(),
    preserve_paragraphs: z.boolean().optional(),
    smart_split: z.boolean().optional(),
  }).optional(),
})

const updateScenesSchema = z.object({
  scenes: z.array(z.object({
    id: z.string(),
    index: z.number().min(0),
    text: z.string().min(1, 'Scene text cannot be empty'),
    prompt: z.string().optional(),
  })),
})

/**
 * GET /api/v1/projects/[id]/scenes
 * Get project scenes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const projectId = params.id
    const authContext = {
      userId: session.user.id,
      userRole: session.user.role,
      email: session.user.email,
    }

    // Get project with scenes
    const projectService = new ProjectService(authContext)
    const project = await projectService.getProject(projectId, true)

    if (!project) {
      return createErrorResponse('Project not found', 404)
    }

    return createSuccessResponse({
      project_id: projectId,
      scenes: project.scenes || [],
      scene_count: project.scenes?.length || 0,
    })
  } catch (error) {
    console.error('Get scenes error:', error)
    return createErrorResponse('Failed to get scenes', 500)
  }
}

/**
 * POST /api/v1/projects/[id]/scenes/segment
 * Segment text into scenes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const projectId = params.id
    const authContext = {
      userId: session.user.id,
      userRole: session.user.role,
      email: session.user.email,
    }

    // Validate request body
    const body = await request.json()
    const validation = validateRequest(segmentTextSchema, body)
    if (!validation.success) {
      return createErrorResponse('Invalid request data', 400, validation.errors)
    }

    const { text, config } = validation.data

    // Verify project exists and user has access
    const projectService = new ProjectService(authContext)
    const project = await projectService.getProject(projectId)

    if (!project) {
      return createErrorResponse('Project not found', 404)
    }

    // Initialize segmentation service
    const segmentationService = new SceneSegmentationService(authContext, config)

    // Segment text
    const result = await segmentationService.segmentText(text, {
      config,
      user_id: session.user.id,
    })

    // Validate segmented scenes
    const validation_result = segmentationService.validateScenes(result.scenes, config)

    // Update project with segmented scenes
    const sceneData = result.scenes.map(scene => ({
      index: scene.index,
      text: scene.text,
      prompt: scene.prompt,
    }))

    await projectService.updateProjectScenes(projectId, sceneData)

    // Update project status to READY if segmentation is successful
    if (validation_result.valid) {
      await projectService.updateProject(projectId, { status: 'READY' })
    }

    return createSuccessResponse({
      project_id: projectId,
      segmentation_result: result,
      validation: validation_result,
      scenes_updated: true,
    })
  } catch (error) {
    console.error('Scene segmentation error:', error)
    return createErrorResponse('Failed to segment text', 500)
  }
}

/**
 * PUT /api/v1/projects/[id]/scenes
 * Update project scenes
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const projectId = params.id
    const authContext = {
      userId: session.user.id,
      userRole: session.user.role,
      email: session.user.email,
    }

    // Validate request body
    const body = await request.json()
    const validation = validateRequest(updateScenesSchema, body)
    if (!validation.success) {
      return createErrorResponse('Invalid request data', 400, validation.errors)
    }

    const { scenes } = validation.data

    // Verify project exists and user has access
    const projectService = new ProjectService(authContext)
    const project = await projectService.getProject(projectId)

    if (!project) {
      return createErrorResponse('Project not found', 404)
    }

    // Validate scenes
    const segmentationService = new SceneSegmentationService(authContext)
    const validation_result = segmentationService.validateScenes(scenes)

    if (!validation_result.valid) {
      return createErrorResponse('Invalid scenes', 400, {
        errors: validation_result.errors,
        warnings: validation_result.warnings,
      })
    }

    // Update project scenes
    const sceneData = scenes.map(scene => ({
      index: scene.index,
      text: scene.text,
      prompt: scene.prompt,
    }))

    await projectService.updateProjectScenes(projectId, sceneData)

    // Update project status to READY
    await projectService.updateProject(projectId, { status: 'READY' })

    return createSuccessResponse({
      project_id: projectId,
      scenes_updated: true,
      scene_count: scenes.length,
      validation: validation_result,
    })
  } catch (error) {
    console.error('Update scenes error:', error)
    return createErrorResponse('Failed to update scenes', 500)
  }
}