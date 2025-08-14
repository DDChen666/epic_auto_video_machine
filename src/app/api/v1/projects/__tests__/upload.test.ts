import { NextRequest } from 'next/server'
import { POST } from '../[id]/upload/route'
import { ProjectService } from '@/lib/project-service'
import { FileUploadService } from '@/lib/file-upload-service'

// Mock dependencies
jest.mock('@/lib/project-service')
jest.mock('@/lib/file-upload-service')
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn((request, handler) =>
    handler(request, {
      userId: 'test-user',
      userRole: 'USER',
      email: 'test@example.com',
    })
  ),
}))

const mockProjectService = ProjectService as jest.MockedClass<
  typeof ProjectService
>
const mockFileUploadService = FileUploadService as jest.MockedClass<
  typeof FileUploadService
>

describe('/api/v1/projects/[id]/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock ProjectService
    mockProjectService.prototype.getProject = jest.fn().mockResolvedValue({
      id: 'project-123',
      title: 'Test Project',
      status: 'DRAFT',
    })
    mockProjectService.prototype.updateProjectScenes = jest
      .fn()
      .mockResolvedValue(true)
    mockProjectService.prototype.updateProject = jest.fn().mockResolvedValue({
      id: 'project-123',
      status: 'READY',
    })

    // Mock FileUploadService
    mockFileUploadService.prototype.storeUploadedFile = jest
      .fn()
      .mockResolvedValue('r2://bucket/file-key')
    mockFileUploadService.prototype.parseFile = jest.fn().mockResolvedValue({
      text: 'Parsed file content',
      word_count: 3,
    })
    mockFileUploadService.prototype.parseTextContent = jest
      .fn()
      .mockReturnValue({
        text: 'Direct text content',
        word_count: 3,
      })
    mockFileUploadService.prototype.cleanAndNormalizeText = jest
      .fn()
      .mockReturnValue('Cleaned content')
    mockFileUploadService.prototype.storeCleanedText = jest
      .fn()
      .mockResolvedValue('r2://bucket/cleaned-key')
    mockFileUploadService.prototype.segmentText = jest.fn().mockResolvedValue([
      { index: 0, text: 'Scene 1 content' },
      { index: 1, text: 'Scene 2 content' },
    ])
    mockFileUploadService.prototype.storeProcessedContent = jest
      .fn()
      .mockResolvedValue('r2://bucket/scenes-key')
  })

  describe('POST', () => {
    it('should handle file upload successfully', async () => {
      const formData = new FormData()
      const file = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      formData.append('file', file)
      formData.append(
        'options',
        JSON.stringify({ auto_segment: true, use_llm_segment: false })
      )

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.project_id).toBe('project-123')
      expect(data.data.parsed_content.text).toBe('Cleaned content')
      expect(data.data.scenes).toHaveLength(2)
    })

    it('should handle text content upload successfully', async () => {
      const formData = new FormData()
      formData.append('text', 'Direct text input')
      formData.append(
        'options',
        JSON.stringify({ auto_segment: true, use_llm_segment: false })
      )

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.project_id).toBe('project-123')
    })

    it('should return error for missing project', async () => {
      mockProjectService.prototype.getProject = jest
        .fn()
        .mockResolvedValue(null)

      const formData = new FormData()
      formData.append('text', 'Some text')

      const request = new NextRequest(
        'http://localhost/api/v1/projects/nonexistent/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return error for missing file and text', async () => {
      const formData = new FormData()

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('should return error for oversized file', async () => {
      const formData = new FormData()
      // Create a mock file that appears to be over 5MB
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.txt', {
        type: 'text/plain',
      })
      formData.append('file', largeFile)

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
      expect(data.error.message).toContain('File size exceeds maximum limit')
    })

    it('should return error for unsupported file type', async () => {
      const formData = new FormData()
      const file = new File(['test content'], 'test.jpg', {
        type: 'image/jpeg',
      })
      formData.append('file', file)

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
      expect(data.error.message).toContain('File type .jpg is not supported')
    })

    it('should return error for content that is too long', async () => {
      const longText = 'x'.repeat(50001) // Exceeds 50k character limit

      mockFileUploadService.prototype.parseTextContent = jest
        .fn()
        .mockReturnValue({
          text: longText,
          word_count: 50001,
        })

      const formData = new FormData()
      formData.append('text', longText)

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const response = await POST(request, { params: { id: 'project-123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
      expect(data.error.message).toContain(
        'Content length exceeds maximum limit'
      )
    })

    it('should update project status from DRAFT to READY', async () => {
      const formData = new FormData()
      formData.append('text', 'Some text content')

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      await POST(request, { params: { id: 'project-123' } })

      expect(mockProjectService.prototype.updateProject).toHaveBeenCalledWith(
        'project-123',
        { status: 'READY' }
      )
    })

    it('should not update project status if already READY', async () => {
      mockProjectService.prototype.getProject = jest.fn().mockResolvedValue({
        id: 'project-123',
        title: 'Test Project',
        status: 'READY',
      })

      const formData = new FormData()
      formData.append('text', 'Some text content')

      const request = new NextRequest(
        'http://localhost/api/v1/projects/project-123/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      await POST(request, { params: { id: 'project-123' } })

      expect(mockProjectService.prototype.updateProject).not.toHaveBeenCalled()
    })
  })
})
