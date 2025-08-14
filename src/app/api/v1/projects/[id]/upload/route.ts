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
import { withAuth } from '@/lib/auth-middleware'
import { ProjectService } from '@/lib/project-service'
import { FileUploadService } from '@/lib/file-upload-service'
import type { UploadResponse } from '@/types'

// Validation schemas
const UploadOptionsSchema = z.object({
  auto_segment: z.boolean().default(true),
  use_llm_segment: z.boolean().default(false),
})

// File size limits (5MB as per requirements)
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_CONTENT_LENGTH = 50000 // 50k characters

/**
 * POST /api/v1/projects/[id]/upload - Upload and parse file content
 */
export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    return withAuth(request, async (req, context) => {
      const projectId = params.id

      if (!projectId) {
        return errorResponse(
          ERROR_CODES.INVALID_INPUT,
          'Project ID is required',
          HTTP_STATUS.BAD_REQUEST
        )
      }

      try {
        // Check if project exists and user has access
        const projectService = new ProjectService(context)
        const existingProject = await projectService.getProject(projectId)

        if (!existingProject) {
          return errorResponse(
            ERROR_CODES.NOT_FOUND,
            'Project not found',
            HTTP_STATUS.NOT_FOUND
          )
        }

        // Parse form data
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const textContent = formData.get('text') as string | null
        const optionsJson = formData.get('options') as string | null

        // Validate that either file or text is provided
        if (!file && !textContent) {
          return errorResponse(
            ERROR_CODES.INVALID_INPUT,
            'Either file or text content must be provided',
            HTTP_STATUS.BAD_REQUEST
          )
        }

        // Parse options
        let options = { auto_segment: true, use_llm_segment: false }
        if (optionsJson) {
          try {
            const parsedOptions = JSON.parse(optionsJson)
            const validation = UploadOptionsSchema.safeParse(parsedOptions)
            if (validation.success) {
              options = validation.data
            }
          } catch (error) {
            // Use default options if parsing fails
          }
        }

        // Initialize file upload service
        const fileUploadService = new FileUploadService()
        let parsedContent: { text: string; word_count: number }
        let originalFileUri: string | undefined

        if (file) {
          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            return errorResponse(
              ERROR_CODES.INVALID_INPUT,
              `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
              HTTP_STATUS.BAD_REQUEST
            )
          }

          // Validate file type
          const allowedTypes = ['.txt', '.md', '.docx', '.pdf']
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

          if (!allowedTypes.includes(fileExtension)) {
            return errorResponse(
              ERROR_CODES.INVALID_INPUT,
              `File type ${fileExtension} is not supported. Allowed types: ${allowedTypes.join(', ')}`,
              HTTP_STATUS.BAD_REQUEST
            )
          }

          // Store original file in R2
          originalFileUri = await fileUploadService.storeUploadedFile(
            context.userId,
            projectId,
            file
          )

          // Parse file content
          parsedContent = await fileUploadService.parseFile(file)
        } else {
          // Use provided text content
          parsedContent = fileUploadService.parseTextContent(textContent!)
        }

        // Validate content length
        if (parsedContent.text.length > MAX_CONTENT_LENGTH) {
          return errorResponse(
            ERROR_CODES.INVALID_INPUT,
            `Content length exceeds maximum limit of ${MAX_CONTENT_LENGTH} characters. Current length: ${parsedContent.text.length}`,
            HTTP_STATUS.BAD_REQUEST
          )
        }

        // Clean and normalize text
        const cleanedText = fileUploadService.cleanAndNormalizeText(
          parsedContent.text
        )

        // Store cleaned text in R2
        const cleanedTextUri = await fileUploadService.storeCleanedText(
          context.userId,
          projectId,
          cleanedText,
          file?.name
        )

        // Segment text into scenes
        const scenes = await fileUploadService.segmentText(cleanedText, options)

        // Store scenes data in R2
        const scenesUri = await fileUploadService.storeProcessedContent(
          context.userId,
          projectId,
          'scenes',
          scenes
        )

        // Store scenes in database
        await projectService.updateProjectScenes(projectId, scenes)

        // Update project status to READY if it was DRAFT
        if (existingProject.status === 'DRAFT') {
          await projectService.updateProject(projectId, { status: 'READY' })
        }

        // Prepare response
        const response: UploadResponse = {
          project_id: projectId,
          parsed_content: {
            text: cleanedText,
            word_count: parsedContent.word_count,
            estimated_scenes: scenes.length,
          },
          scenes: scenes.map((scene, index) => ({
            id: scene.id || `temp-${index}`,
            index: scene.index,
            text: scene.text,
            prompt: scene.prompt,
          })),
        }

        return successResponse(response)
      } catch (error) {
        console.error('Error uploading file:', error)

        if (error instanceof Error) {
          // Handle specific error types
          if (error.message.includes('File type not supported')) {
            return errorResponse(
              ERROR_CODES.INVALID_INPUT,
              error.message,
              HTTP_STATUS.BAD_REQUEST
            )
          }

          if (error.message.includes('File parsing failed')) {
            return errorResponse(
              ERROR_CODES.PROCESSING_ERROR,
              error.message,
              HTTP_STATUS.UNPROCESSABLE_ENTITY
            )
          }
        }

        return errorResponse(
          ERROR_CODES.INTERNAL_ERROR,
          'Failed to process file upload',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
      }
    })
  }
)

/**
 * OPTIONS /api/v1/projects/[id]/upload - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
