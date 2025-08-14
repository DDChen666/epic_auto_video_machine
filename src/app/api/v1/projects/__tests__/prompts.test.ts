import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST, PUT, GET } from '../[id]/prompts/route'
import { PromptGenerationService } from '@/lib/prompt-generation-service'
import { ProjectService } from '@/lib/project-service'

// Mock dependencies
jest.mock('next-auth')
jest.mock('@/lib/prompt-generation-service')
jest.mock('@/lib/project-service')

describe('/api/v1/projects/[id]/prompts', () => {
  let mockSession: any
  let mockPromptService: {
    generateScenePrompts: jest.MockedFunction<any>
    validateAndEditPrompt: jest.MockedFunction<any>
    generatePromptPreview: jest.MockedFunction<any>
  }
  let mockProjectService: {
    getProject: jest.MockedFunction<any>
    getProjectWithScenes: jest.MockedFunction<any>
    updateScenePrompts: jest.MockedFunction<any>
  }

  const mockProject = {
    id: 'project-123',
    title: 'Test Project',
    config: {
      aspect_ratio: '9:16' as const,
      template: {
        name: 'classic' as const,
        transitions: 'fade' as const,
        transition_duration: 500,
        background_music: true,
        bgm_volume: -18,
      },
      voice: {
        type: 'natural' as const,
        speed: 1.0,
        language: 'zh-TW' as const,
        accent: 'taiwan' as const,
      },
      generation: {
        images_per_scene: 1 as const,
        image_quality: 'standard' as const,
        retry_attempts: 3,
        timeout_seconds: 300,
        smart_crop: true,
      },
      safety: {
        content_policy: 'standard' as const,
        blocked_words: [],
        error_strategy: 'skip' as const,
        adult_content: 'block' as const,
        violence_filter: true,
      },
    },
  }

  const mockScenes = [
    {
      id: 'scene-1',
      index: 1,
      text: '一個美麗的女孩在公園裡散步',
    },
    {
      id: 'scene-2',
      index: 2,
      text: '夜晚的城市街道，霓虹燈閃爍',
    },
  ]

  beforeEach(() => {
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
    }

    mockPromptService = {
      generateScenePrompts: jest.fn(),
      validateAndEditPrompt: jest.fn(),
      generatePromptPreview: jest.fn(),
    }

    mockProjectService = {
      getProject: jest.fn(),
      getProjectWithScenes: jest.fn(),
      updateScenePrompts: jest.fn(),
    }

    // Mock implementations
    ;(getServerSession as jest.MockedFunction<any>).mockResolvedValue(mockSession)
    ;(PromptGenerationService.create as jest.MockedFunction<any>).mockResolvedValue(mockPromptService)
    ;(ProjectService as any).mockImplementation(() => mockProjectService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('POST /api/v1/projects/[id]/prompts', () => {
    it('should generate prompts for project scenes', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)
      mockPromptService.generateScenePrompts.mockResolvedValue([
        {
          sceneIndex: 1,
          originalText: mockScenes[0].text,
          visualPrompt: 'beautiful girl walking in park, professional photography',
          visualElements: {
            subject: ['女孩'],
            environment: ['公園'],
            camera: ['medium shot'],
            lighting: ['陽光'],
            mood: ['愉快'],
          },
          safetyStatus: 'safe',
          success: true,
        },
        {
          sceneIndex: 2,
          originalText: mockScenes[1].text,
          visualPrompt: 'city street at night, neon lights, cinematic',
          visualElements: {
            subject: ['人們'],
            environment: ['城市街道'],
            camera: ['wide shot'],
            lighting: ['霓虹燈'],
            mood: ['匆忙'],
          },
          safetyStatus: 'safe',
          success: true,
        },
      ])
      mockProjectService.updateScenePrompts.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({
          scenes: mockScenes,
        }),
      })

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].visualPrompt).toContain('beautiful girl walking in park')
      expect(data.data[1].visualPrompt).toContain('city street at night')
      expect(mockProjectService.updateScenePrompts).toHaveBeenCalledWith(
        'project-123',
        expect.arrayContaining([
          expect.objectContaining({ sceneIndex: 1, success: true }),
          expect.objectContaining({ sceneIndex: 2, success: true }),
        ])
      )
    })

    it('should handle custom configuration overrides', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)
      mockPromptService.generateScenePrompts.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({
          scenes: mockScenes,
          config: {
            aspect_ratio: '16:9',
            template: 'dark',
            safety: {
              content_policy: 'strict',
              blocked_words: ['custom_word'],
            },
          },
        }),
      })

      await POST(request, { params: { id: 'project-123' } })

      expect(mockPromptService.generateScenePrompts).toHaveBeenCalledWith(
        mockScenes,
        expect.objectContaining({
          aspect_ratio: '16:9',
          template: expect.objectContaining({ name: 'dark' }),
          safety: expect.objectContaining({
            content_policy: 'strict',
            blocked_words: ['custom_word'],
          }),
        })
      )
    })

    it('should return 401 for unauthenticated requests', async () => {
      ;(getServerSession as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: mockScenes }),
      })

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 for non-existent projects', async () => {
      mockProjectService.getProject.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: mockScenes }),
      })

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Project not found')
    })

    it('should return 400 for invalid scenes data', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: [] }),
      })

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Scenes are required')
    })

    it('should handle prompt generation service errors', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)
      mockPromptService.generateScenePrompts.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: mockScenes }),
      })

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Service error')
    })
  })

  describe('PUT /api/v1/projects/[id]/prompts', () => {
    it('should validate and update edited prompts', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)
      mockPromptService.validateAndEditPrompt.mockResolvedValue({
        isValid: true,
        safetyResult: {
          isSafe: true,
          violations: [],
        },
        suggestions: [],
      })

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'PUT',
        body: JSON.stringify({
          originalPrompt: 'original prompt',
          editedPrompt: 'edited prompt with improvements',
        }),
      })

      const response = await PUT(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isValid).toBe(true)
      expect(data.data.safetyViolations).toHaveLength(0)
    })

    it('should detect safety violations in edited prompts', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)
      mockPromptService.validateAndEditPrompt.mockResolvedValue({
        isValid: false,
        safetyResult: {
          isSafe: false,
          violations: ['Inappropriate content: violence'],
          filteredPrompt: 'safe alternative prompt',
        },
        suggestions: ['suggestion 1', 'suggestion 2'],
      })

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'PUT',
        body: JSON.stringify({
          originalPrompt: 'original prompt',
          editedPrompt: 'prompt with violence',
        }),
      })

      const response = await PUT(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.isValid).toBe(false)
      expect(data.data.safetyViolations).toContain('Inappropriate content: violence')
      expect(data.data.filteredPrompt).toBe('safe alternative prompt')
      expect(data.data.suggestions).toHaveLength(2)
    })

    it('should return 400 for missing prompt data', async () => {
      mockProjectService.getProject.mockResolvedValue(mockProject)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'PUT',
        body: JSON.stringify({
          originalPrompt: 'original',
          // Missing editedPrompt
        }),
      })

      const response = await PUT(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Original and edited prompts are required')
    })
  })

  describe('GET /api/v1/projects/[id]/prompts/preview', () => {
    it('should return prompt previews for project scenes', async () => {
      const projectWithScenes = {
        ...mockProject,
        scenes: [
          {
            id: 'scene-1',
            index: 1,
            text: 'Scene 1 text',
            prompt: 'beautiful girl walking in park, professional photography, high quality',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'scene-2',
            index: 2,
            text: 'Scene 2 text',
            prompt: 'city street at night, neon lights, cinematic lighting, urban atmosphere',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }

      mockProjectService.getProjectWithScenes.mockResolvedValue(projectWithScenes)
      mockPromptService.generatePromptPreview
        .mockReturnValueOnce('beautiful • girl • walking • park • professional')
        .mockReturnValueOnce('city • street • night • neon • lights')

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts/preview')

      const response = await GET(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0]).toMatchObject({
        sceneIndex: 1,
        preview: 'beautiful • girl • walking • park • professional',
        fullPrompt: 'beautiful girl walking in park, professional photography, high quality',
        safetyStatus: 'safe',
      })
      expect(data.data[1]).toMatchObject({
        sceneIndex: 2,
        preview: 'city • street • night • neon • lights',
        fullPrompt: 'city street at night, neon lights, cinematic lighting, urban atmosphere',
        safetyStatus: 'safe',
      })
    })

    it('should return empty array for project with no prompts', async () => {
      const projectWithoutPrompts = {
        ...mockProject,
        scenes: [
          {
            id: 'scene-1',
            index: 1,
            text: 'Scene 1 text',
            prompt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }

      mockProjectService.getProjectWithScenes.mockResolvedValue(projectWithoutPrompts)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts/preview')

      const response = await GET(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(0)
    })

    it('should return 404 for non-existent projects', async () => {
      mockProjectService.getProjectWithScenes.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/projects/project-123/prompts/preview')

      const response = await GET(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Project not found')
    })
  })

  describe('authentication and authorization', () => {
    it('should require authentication for all endpoints', async () => {
      ;(getServerSession as jest.MockedFunction<any>).mockResolvedValue(null)

      const postRequest = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: mockScenes }),
      })

      const putRequest = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'PUT',
        body: JSON.stringify({
          originalPrompt: 'original',
          editedPrompt: 'edited',
        }),
      })

      const getRequest = new NextRequest('http://localhost/api/v1/projects/project-123/prompts/preview')

      const [postResponse, putResponse, getResponse] = await Promise.all([
        POST(postRequest, { params: { id: 'project-123' } }),
        PUT(putRequest, { params: { id: 'project-123' } }),
        GET(getRequest, { params: { id: 'project-123' } }),
      ])

      expect(postResponse.status).toBe(401)
      expect(putResponse.status).toBe(401)
      expect(getResponse.status).toBe(401)
    })

    it('should validate project ownership', async () => {
      mockProjectService.getProject.mockResolvedValue(null)
      mockProjectService.getProjectWithScenes.mockResolvedValue(null)

      const postRequest = new NextRequest('http://localhost/api/v1/projects/project-123/prompts', {
        method: 'POST',
        body: JSON.stringify({ scenes: mockScenes }),
      })

      const response = await POST(postRequest, { params: { id: 'project-123' } })

      expect(response.status).toBe(404)
      expect(mockProjectService.getProject).toHaveBeenCalledWith('project-123')
    })
  })
})