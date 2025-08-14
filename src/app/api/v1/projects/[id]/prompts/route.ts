import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PromptGenerationService } from '@/lib/prompt-generation-service'
import { ProjectService } from '@/lib/project-service'
import { ApiResponse } from '@/types'
import type { PromptResult } from '@/lib/prompt-generation-service'

interface GeneratePromptsRequest {
  scenes: Array<{
    id: string
    index: number
    text: string
  }>
  config?: {
    aspect_ratio?: '9:16' | '16:9' | '1:1'
    template?: 'classic' | 'dark' | 'vivid'
    safety?: {
      content_policy?: 'strict' | 'standard'
      blocked_words?: string[]
      error_strategy?: 'skip' | 'mask' | 'fail'
    }
  }
}

interface ValidatePromptRequest {
  originalPrompt: string
  editedPrompt: string
}

/**
 * POST /api/v1/projects/[id]/prompts
 * Generate visual prompts for project scenes
 * Requirement 4.1: 使用 Gemini 為每個場景生成英文化的視覺提示詞
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<PromptResult[]>>> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const projectId = params.id
    const body: GeneratePromptsRequest = await request.json()

    // Validate project ownership
    const projectService = new ProjectService({
      userId: session.user.id,
      userRole: 'USER' as any,
      email: session.user.email || '',
    })
    const project = await projectService.getProject(projectId)

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Validate scenes
    if (
      !body.scenes ||
      !Array.isArray(body.scenes) ||
      body.scenes.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Scenes are required' },
        { status: 400 }
      )
    }

    // Create prompt generation service
    const promptService = await PromptGenerationService.create(session.user.id)

    // Merge config with project defaults
    const config = {
      aspect_ratio: body.config?.aspect_ratio || project.config.aspect_ratio,
      template: {
        name: body.config?.template || project.config.template.name,
        transitions: project.config.template.transitions,
        transition_duration: project.config.template.transition_duration,
        background_music: project.config.template.background_music,
        bgm_volume: project.config.template.bgm_volume,
      },
      voice: project.config.voice,
      generation: project.config.generation,
      safety: {
        ...project.config.safety,
        ...body.config?.safety,
      },
    }

    // Generate prompts for all scenes
    const results = await promptService.generateScenePrompts(
      body.scenes,
      config
    )

    // Update project with generated prompts
    await projectService.updateScenePrompts(projectId, results)

    return NextResponse.json({
      success: true,
      data: results,
      message: `Generated prompts for ${results.length} scenes`,
    })
  } catch (error) {
    console.error('Prompt generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/projects/[id]/prompts
 * Validate and update edited prompt
 * Requirement 4.4: 允許編輯個別場景的提示詞
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<
  NextResponse<
    ApiResponse<{
      isValid: boolean
      safetyViolations?: string[]
      suggestions?: string[]
      filteredPrompt?: string
    }>
  >
> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const projectId = params.id
    const body: ValidatePromptRequest = await request.json()

    // Validate project ownership
    const projectService = new ProjectService({
      userId: session.user.id,
      userRole: 'USER' as any,
      email: session.user.email || '',
    })
    const project = await projectService.getProject(projectId)

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Validate request body
    if (!body.originalPrompt || !body.editedPrompt) {
      return NextResponse.json(
        { success: false, error: 'Original and edited prompts are required' },
        { status: 400 }
      )
    }

    // Create prompt generation service
    const promptService = await PromptGenerationService.create(session.user.id)

    // Validate edited prompt
    const validation = await promptService.validateAndEditPrompt(
      body.originalPrompt,
      body.editedPrompt,
      project.config
    )

    return NextResponse.json({
      success: true,
      data: {
        isValid: validation.isValid,
        safetyViolations: validation.safetyResult.violations,
        suggestions: validation.suggestions,
        filteredPrompt: validation.safetyResult.filteredPrompt,
      },
    })
  } catch (error) {
    console.error('Prompt validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/projects/[id]/prompts/preview
 * Get prompt previews for all scenes
 * Requirement 4.2: 顯示每個場景的提示詞預覽（一行摘要）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<
  NextResponse<
    ApiResponse<
      Array<{
        sceneIndex: number
        preview: string
        fullPrompt: string
        safetyStatus: 'safe' | 'filtered' | 'replaced'
      }>
    >
  >
> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const projectId = params.id

    // Get project with scenes
    const projectService = new ProjectService({
      userId: session.user.id,
      userRole: 'USER' as any,
      email: session.user.email || '',
    })
    const project = await projectService.getProjectWithScenes(
      projectId,
      session.user.id
    )

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    // Create prompt generation service for preview generation
    const promptService = await PromptGenerationService.create(session.user.id)

    // Generate previews for scenes with prompts
    const previews = project.scenes
      .filter(scene => scene.prompt)
      .map(scene => ({
        sceneIndex: scene.index,
        preview: promptService.generatePromptPreview(scene.prompt!),
        fullPrompt: scene.prompt!,
        safetyStatus: 'safe' as const, // TODO: Store safety status in database
      }))

    return NextResponse.json({
      success: true,
      data: previews,
    })
  } catch (error) {
    console.error('Prompt preview error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
