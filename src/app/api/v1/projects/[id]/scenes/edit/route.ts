import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SceneSegmentationService } from '@/lib/scene-segmentation-service'
import { ProjectService } from '@/lib/project-service'
import { validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { z } from 'zod'

// Scene edit operation validation schema
const sceneEditSchema = z.object({
  operation: z.object({
    type: z.enum(['merge', 'split', 'reorder', 'update']),
    scene_ids: z.array(z.string()).min(1, 'At least one scene ID required'),
    new_text: z.string().optional(),
    new_index: z.number().min(0).optional(),
    split_position: z.number().min(1).optional(),
  }),
})

/**
 * POST /api/v1/projects/[id]/scenes/edit
 * Edit scenes (merge, split, reorder, update)
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
    const validation = validateRequest(sceneEditSchema, body)
    if (!validation.success) {
      return createErrorResponse('Invalid request data', 400, validation.errors)
    }

    const { operation } = validation.data

    // Verify project exists and user has access
    const projectService = new ProjectService(authContext)
    const project = await projectService.getProject(projectId, true)

    if (!project) {
      return createErrorResponse('Project not found', 404)
    }

    if (!project.scenes || project.scenes.length === 0) {
      return createErrorResponse('No scenes found in project', 400)
    }

    // Validate operation-specific requirements
    const validationError = validateEditOperation(operation, project.scenes)
    if (validationError) {
      return createErrorResponse(validationError, 400)
    }

    // Initialize segmentation service
    const segmentationService = new SceneSegmentationService(authContext)

    // Perform edit operation
    const updatedScenes = await segmentationService.editScenes(
      project.scenes,
      operation
    )

    // Validate updated scenes
    const validation_result = segmentationService.validateScenes(updatedScenes)

    // Update project with edited scenes
    const sceneData = updatedScenes.map(scene => ({
      index: scene.index,
      text: scene.text,
      prompt: scene.prompt,
    }))

    await projectService.updateProjectScenes(projectId, sceneData)

    return createSuccessResponse({
      project_id: projectId,
      operation_type: operation.type,
      scenes: updatedScenes,
      scene_count: updatedScenes.length,
      validation: validation_result,
    })
  } catch (error) {
    console.error('Scene edit error:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return createErrorResponse(error.message, 404)
      }
      if (error.message.includes('Invalid') || error.message.includes('required')) {
        return createErrorResponse(error.message, 400)
      }
    }

    return createErrorResponse('Failed to edit scenes', 500)
  }
}

/**
 * Validate edit operation requirements
 */
function validateEditOperation(operation: any, scenes: any[]): string | null {
  switch (operation.type) {
    case 'merge':
      if (operation.scene_ids.length < 2) {
        return 'Merge operation requires at least 2 scenes'
      }
      
      // Check if all scene IDs exist
      const existingIds = scenes.map(s => s.id)
      const missingIds = operation.scene_ids.filter((id: string) => !existingIds.includes(id))
      if (missingIds.length > 0) {
        return `Scene IDs not found: ${missingIds.join(', ')}`
      }
      
      // Check if scenes are adjacent (for better UX)
      const sceneIndices = operation.scene_ids
        .map((id: string) => scenes.find(s => s.id === id)?.index)
        .filter((index: number | undefined) => index !== undefined)
        .sort((a: number, b: number) => a - b)
      
      for (let i = 1; i < sceneIndices.length; i++) {
        if (sceneIndices[i] - sceneIndices[i - 1] > 1) {
          return 'Merge operation works best with adjacent scenes'
        }
      }
      break

    case 'split':
      if (operation.scene_ids.length !== 1) {
        return 'Split operation requires exactly one scene ID'
      }
      
      if (!operation.split_position || operation.split_position <= 0) {
        return 'Split operation requires a valid split position'
      }
      
      const sceneToSplit = scenes.find(s => s.id === operation.scene_ids[0])
      if (!sceneToSplit) {
        return 'Scene to split not found'
      }
      
      if (operation.split_position >= sceneToSplit.text.length) {
        return 'Split position is beyond scene text length'
      }
      break

    case 'reorder':
      if (operation.scene_ids.length !== 1) {
        return 'Reorder operation requires exactly one scene ID'
      }
      
      if (operation.new_index === undefined || operation.new_index < 0) {
        return 'Reorder operation requires a valid new index'
      }
      
      if (operation.new_index >= scenes.length) {
        return 'New index is out of bounds'
      }
      
      const sceneToReorder = scenes.find(s => s.id === operation.scene_ids[0])
      if (!sceneToReorder) {
        return 'Scene to reorder not found'
      }
      break

    case 'update':
      if (operation.scene_ids.length !== 1) {
        return 'Update operation requires exactly one scene ID'
      }
      
      if (!operation.new_text || operation.new_text.trim().length === 0) {
        return 'Update operation requires new text'
      }
      
      const sceneToUpdate = scenes.find(s => s.id === operation.scene_ids[0])
      if (!sceneToUpdate) {
        return 'Scene to update not found'
      }
      break

    default:
      return `Unsupported operation type: ${operation.type}`
  }

  return null
}