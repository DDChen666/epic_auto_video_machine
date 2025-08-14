import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { GET as GetProject, PUT, DELETE } from '../[id]/route'
import { DEFAULT_PROJECT_CONFIG } from '@/types'

// Mock the auth middleware
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn((request, handler) => {
    const mockContext = {
      userId: 'user_123',
      userRole: 'USER',
      email: 'test@example.com',
    }
    return handler(request, mockContext)
  }),
}))

// Mock the project service
jest.mock('@/lib/project-service', () => ({
  ProjectService: jest.fn().mockImplementation(() => ({
    listProjects: jest.fn(),
    createProject: jest.fn(),
    getProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  })),
}))

const { ProjectService } = require('@/lib/project-service')

describe('/api/v1/projects', () => {
  let mockProjectService: any

  beforeEach(() => {
    mockProjectService = {
      listProjects: jest.fn(),
      createProject: jest.fn(),
      getProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
    }
    ProjectService.mockImplementation(() => mockProjectService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/projects', () => {
    it('should list projects successfully', async () => {
      const mockResult = {
        projects: [
          {
            id: 'proj_1',
            title: 'Test Project',
            status: 'DRAFT',
            scene_count: 0,
            job_count: 0,
            created_at: '2023-01-01T00:00:00.000Z',
            updated_at: '2023-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }

      mockProjectService.listProjects.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost:3000/api/v1/projects')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(mockProjectService.listProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        search: undefined,
        sort: 'updated_at',
        order: 'desc',
      })
    })

    it('should handle query parameters correctly', async () => {
      mockProjectService.listProjects.mockResolvedValue({
        projects: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: true },
      })

      const request = new NextRequest(
        'http://localhost:3000/api/v1/projects?page=2&limit=10&status=COMPLETED&search=test&sort=title&order=asc'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockProjectService.listProjects).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        status: 'COMPLETED',
        search: 'test',
        sort: 'title',
        order: 'asc',
      })
    })

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/projects?page=0')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/v1/projects', () => {
    it('should create project successfully', async () => {
      const mockProject = {
        id: 'proj_123',
        title: 'New Project',
        description: 'Test Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        scene_count: 0,
        job_count: 0,
        latest_job: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockProjectService.createProject.mockResolvedValue(mockProject)

      const requestBody = {
        title: 'New Project',
        description: 'Test Description',
      }

      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockProject)
      expect(mockProjectService.createProject).toHaveBeenCalledWith({
        title: 'New Project',
        description: 'Test Description',
        config: DEFAULT_PROJECT_CONFIG,
      })
    })

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ title: '' }), // Empty title should fail validation
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })
  })
})

describe('/api/v1/projects/[id]', () => {
  let mockProjectService: any

  beforeEach(() => {
    mockProjectService = {
      getProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
    }
    ProjectService.mockImplementation(() => mockProjectService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/projects/[id]', () => {
    it('should get project successfully', async () => {
      const mockProject = {
        id: 'proj_123',
        title: 'Test Project',
        status: 'DRAFT',
        scenes: [],
        jobs: [],
        scene_count: 0,
        job_count: 0,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockProjectService.getProject.mockResolvedValue(mockProject)

      const request = new NextRequest('http://localhost:3000/api/v1/projects/proj_123')
      const response = await GetProject(request, { params: { id: 'proj_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockProject)
      expect(mockProjectService.getProject).toHaveBeenCalledWith('proj_123', true)
    })

    it('should return 404 for non-existent project', async () => {
      mockProjectService.getProject.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent')
      const response = await GetProject(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('PUT /api/v1/projects/[id]', () => {
    it('should update project successfully', async () => {
      const mockUpdatedProject = {
        id: 'proj_123',
        title: 'Updated Project',
        status: 'DRAFT',
        scene_count: 0,
        job_count: 0,
        latest_job: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      mockProjectService.updateProject.mockResolvedValue(mockUpdatedProject)

      const requestBody = {
        title: 'Updated Project',
      }

      const request = new NextRequest('http://localhost:3000/api/v1/projects/proj_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await PUT(request, { params: { id: 'proj_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockUpdatedProject)
      expect(mockProjectService.updateProject).toHaveBeenCalledWith('proj_123', {
        title: 'Updated Project',
        description: undefined,
        status: undefined,
        config: undefined,
      })
    })

    it('should return 404 for non-existent project', async () => {
      mockProjectService.updateProject.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await PUT(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('DELETE /api/v1/projects/[id]', () => {
    it('should delete project successfully', async () => {
      mockProjectService.deleteProject.mockResolvedValue(true)

      const request = new NextRequest('http://localhost:3000/api/v1/projects/proj_123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'proj_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('Project deleted successfully')
      expect(mockProjectService.deleteProject).toHaveBeenCalledWith('proj_123')
    })

    it('should return 404 for non-existent project', async () => {
      mockProjectService.deleteProject.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/v1/projects/nonexistent', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})