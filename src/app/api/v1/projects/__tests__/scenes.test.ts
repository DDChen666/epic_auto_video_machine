import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { GET, POST, PUT } from '../[id]/scenes/route'
import { POST as EditPOST } from '../[id]/scenes/edit/route'
import { ProjectService } from '@/lib/project-service'
import { SceneSegmentationService } from '@/lib/scene-segmentation-service'

// Mock dependencies
jest.mock('next-auth')
jest.mock('@/lib/project-service')
jest.mock('@/lib/scene-segmentation-service')
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))
jest.mock('@/lib/api-utils', () => ({
  validateRequest: jest.fn(),
  createErrorResponse: jest.fn(),
  createSuccessResponse: jest.fn(),
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const MockedProjectService = ProjectService as jest.MockedClass<typeof ProjectService>
const MockedSceneSegmentationService = SceneSegmentationService as jest.MockedClass<typeof SceneSegmentationService>

// Import mocked functions
const { validateRequest, createErrorResponse, createSuccessResponse } = require('@/lib/api-utils')

describe('/api/v1/projects/[id]/scenes', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'USER',
    },
  }

  const mockProject = {
    id: 'test-project-id',
    title: 'Test Project',
    status: 'DRAFT',
    scenes: [
      { id: 'scene_0', index: 0, text: '第一個場景內容' },
      { id: 'scene_1', index: 1, text: '第二個場景內容' },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession)
    
    // Setup API utils mocks
    validateRequest.mockImplementation((schema, data) => ({ success: true, data }))
    createSuccessResponse.mockImplementation((data) => ({
      json: () => Promise.resolve({ success: true, data }),
      status: 200,
    }))
    createErrorResponse.mockImplementation((message, status) => ({
      json: () => Promise.resolve({ success: false, error: message }),
      status: status || 500,
    }))
  })

  describe('GET /api/v1/projects/[id]/scenes', () => {
    it('should return project scenes', async () => {
      const mockProjectService = {
        getProject: jest.fn().mockResolvedValue(mockProject),
      }
      MockedProjectService.mockImplementation(() => mockProjectService as any)

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes')
      const response = await GET(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.scenes).toHaveLength(2)
      expect(data.data.project_id).toBe('test-project-id')
    })

    it('should return 404 for non-existent project', async () => {
      const mockProjectService = {
        getProject: jest.fn().mockResolvedValue(null),
      }
      MockedProjectService.mockImplementation(() => mockProjectService as any)

      const request = new NextRequest('http://localhost/api/v1/projects/nonexistent/scenes')
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should return 401 for unauthenticated request', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes')
      const response = await GET(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /api/v1/projects/[id]/scenes/segment', () => {
    const mockSegmentationResult = {
      scenes: [
        { id: 'scene_0', index: 0, text: '第一個切分的場景' },
        { id: 'scene_1', index: 1, text: '第二個切分的場景' },
      ],
      metadata: {
        original_length: 100,
        scene_count: 2,
        average_scene_length: 50,
        segmentation_method: 'rule_based' as const,
        processing_time: 100,
      },
    }

    const mockValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    }

    beforeEach(() => {
      const mockProjectService = {
        getProject: jest.fn().mockResolvedValue(mockProject),
        updateProjectScenes: jest.fn().mockResolvedValue(true),
        updateProject: jest.fn().mockResolvedValue(mockProject),
      }
      MockedProjectService.mockImplementation(() => mockProjectService as any)

      const mockSegmentationService = {
        segmentText: jest.fn().mockResolvedValue(mockSegmentationResult),
        validateScenes: jest.fn().mockReturnValue(mockValidationResult),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)
    })

    it('should segment text successfully', async () => {
      const requestBody = {
        text: '這是一個需要切分的長文字段落，包含多個語義單元和句子。',
        config: {
          min_length: 100,
          max_length: 280,
          use_llm: false,
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/segment', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.segmentation_result).toBeDefined()
      expect(data.data.scenes_updated).toBe(true)
    })

    it('should handle LLM segmentation', async () => {
      const requestBody = {
        text: '測試文字內容',
        config: {
          use_llm: true,
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/segment', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should validate request body', async () => {
      const invalidRequestBody = {
        text: '', // Empty text
        config: {
          min_length: -1, // Invalid min_length
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/segment', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should handle segmentation service errors', async () => {
      const mockSegmentationService = {
        segmentText: jest.fn().mockRejectedValue(new Error('Segmentation failed')),
        validateScenes: jest.fn().mockReturnValue(mockValidationResult),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)

      const requestBody = {
        text: '測試文字內容',
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/segment', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })

  describe('PUT /api/v1/projects/[id]/scenes', () => {
    beforeEach(() => {
      const mockProjectService = {
        getProject: jest.fn().mockResolvedValue(mockProject),
        updateProjectScenes: jest.fn().mockResolvedValue(true),
        updateProject: jest.fn().mockResolvedValue(mockProject),
      }
      MockedProjectService.mockImplementation(() => mockProjectService as any)

      const mockSegmentationService = {
        validateScenes: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)
    })

    it('should update project scenes', async () => {
      const requestBody = {
        scenes: [
          { id: 'scene_0', index: 0, text: '更新後的第一個場景' },
          { id: 'scene_1', index: 1, text: '更新後的第二個場景' },
        ],
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await PUT(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.scenes_updated).toBe(true)
    })

    it('should validate scene data', async () => {
      const mockSegmentationService = {
        validateScenes: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Scene 0 is too short'],
          warnings: [],
        }),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)

      const requestBody = {
        scenes: [
          { id: 'scene_0', index: 0, text: '短' }, // Too short
        ],
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await PUT(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /api/v1/projects/[id]/scenes/edit', () => {
    beforeEach(() => {
      const mockProjectService = {
        getProject: jest.fn().mockResolvedValue(mockProject),
        updateProjectScenes: jest.fn().mockResolvedValue(true),
      }
      MockedProjectService.mockImplementation(() => mockProjectService as any)

      const mockSegmentationService = {
        editScenes: jest.fn().mockResolvedValue([
          { id: 'merged_scene', index: 0, text: '合併後的場景內容' },
          { id: 'scene_2', index: 1, text: '第三個場景內容' },
        ]),
        validateScenes: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)
    })

    it('should merge scenes', async () => {
      const requestBody = {
        operation: {
          type: 'merge',
          scene_ids: ['scene_0', 'scene_1'],
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.operation_type).toBe('merge')
    })

    it('should split scene', async () => {
      const requestBody = {
        operation: {
          type: 'split',
          scene_ids: ['scene_0'],
          split_position: 5,
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.operation_type).toBe('split')
    })

    it('should reorder scene', async () => {
      const requestBody = {
        operation: {
          type: 'reorder',
          scene_ids: ['scene_0'],
          new_index: 1,
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.operation_type).toBe('reorder')
    })

    it('should update scene text', async () => {
      const requestBody = {
        operation: {
          type: 'update',
          scene_ids: ['scene_0'],
          new_text: '更新後的場景內容',
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.operation_type).toBe('update')
    })

    it('should validate edit operations', async () => {
      const requestBody = {
        operation: {
          type: 'merge',
          scene_ids: ['scene_0'], // Only one scene for merge
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should handle edit service errors', async () => {
      const mockSegmentationService = {
        editScenes: jest.fn().mockRejectedValue(new Error('Scene not found')),
        validateScenes: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      }
      MockedSceneSegmentationService.mockImplementation(() => mockSegmentationService as any)

      const requestBody = {
        operation: {
          type: 'update',
          scene_ids: ['nonexistent'],
          new_text: '新內容',
        },
      }

      const request = new NextRequest('http://localhost/api/v1/projects/test-project-id/scenes/edit', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await EditPOST(request, { params: { id: 'test-project-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })
})