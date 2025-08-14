import { ProjectService } from '../project-service'
import { DatabaseService } from '../db'
import { DEFAULT_PROJECT_CONFIG } from '@/types'
import type { AuthContext, ProjectConfig } from '@/types'

// Mock the database service
jest.mock('../db', () => ({
  DatabaseService: {
    getUserScopedClient: jest.fn(),
  },
  handlePrismaError: jest.fn((error) => error),
}))

describe('ProjectService', () => {
  let projectService: ProjectService
  let mockDb: any
  let authContext: AuthContext

  beforeEach(() => {
    authContext = {
      userId: 'user_123',
      userRole: 'USER',
      email: 'test@example.com',
    }

    mockDb = {
      project: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }

    ;(DatabaseService.getUserScopedClient as jest.Mock).mockReturnValue(mockDb)
    projectService = new ProjectService(authContext)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createProject', () => {
    it('should create a project with default config', async () => {
      const mockProject = {
        id: 'proj_123',
        title: 'Test Project',
        description: 'Test Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { scenes: 0, jobs: 0 },
      }

      mockDb.project.create.mockResolvedValue(mockProject)

      const result = await projectService.createProject({
        title: 'Test Project',
        description: 'Test Description',
        config: DEFAULT_PROJECT_CONFIG,
      })

      expect(mockDb.project.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Project',
          description: 'Test Description',
          status: 'DRAFT',
          config: DEFAULT_PROJECT_CONFIG,
        },
        include: {
          _count: {
            select: {
              scenes: true,
              jobs: true,
            },
          },
        },
      })

      expect(result).toEqual({
        id: 'proj_123',
        title: 'Test Project',
        description: 'Test Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        scene_count: 0,
        job_count: 0,
        latest_job: null,
        created_at: mockProject.createdAt.toISOString(),
        updated_at: mockProject.updatedAt.toISOString(),
      })
    })
  })

  describe('getProject', () => {
    it('should return null if project not found', async () => {
      mockDb.project.findUnique.mockResolvedValue(null)

      const result = await projectService.getProject('nonexistent')

      expect(result).toBeNull()
    })

    it('should return project without details by default', async () => {
      const mockProject = {
        id: 'proj_123',
        title: 'Test Project',
        description: 'Test Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { scenes: 2, jobs: 1 },
        jobs: [{ id: 'job_1', status: 'COMPLETED', createdAt: new Date() }],
      }

      mockDb.project.findUnique.mockResolvedValue(mockProject)

      const result = await projectService.getProject('proj_123')

      expect(result).toEqual({
        id: 'proj_123',
        title: 'Test Project',
        description: 'Test Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        scene_count: 2,
        job_count: 1,
        latest_job: {
          id: 'job_1',
          status: 'COMPLETED',
          created_at: mockProject.jobs[0].createdAt.toISOString(),
        },
        created_at: mockProject.createdAt.toISOString(),
        updated_at: mockProject.updatedAt.toISOString(),
      })
    })
  })

  describe('listProjects', () => {
    it('should list projects with pagination', async () => {
      const mockProjects = [
        {
          id: 'proj_1',
          title: 'Project 1',
          description: 'Description 1',
          status: 'DRAFT',
          config: DEFAULT_PROJECT_CONFIG,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { scenes: 1, jobs: 0 },
          scenes: [],
          jobs: [],
        },
      ]

      mockDb.project.count.mockResolvedValue(1)
      mockDb.project.findMany.mockResolvedValue(mockProjects)

      const result = await projectService.listProjects({
        page: 1,
        limit: 20,
      })

      expect(result.projects).toHaveLength(1)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should filter projects by status', async () => {
      mockDb.project.count.mockResolvedValue(0)
      mockDb.project.findMany.mockResolvedValue([])

      await projectService.listProjects({
        status: 'COMPLETED',
      })

      expect(mockDb.project.count).toHaveBeenCalledWith({
        where: { status: 'COMPLETED' },
      })
      expect(mockDb.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      )
    })

    it('should search projects by title and description', async () => {
      mockDb.project.count.mockResolvedValue(0)
      mockDb.project.findMany.mockResolvedValue([])

      await projectService.listProjects({
        search: 'test',
      })

      expect(mockDb.project.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
          ],
        },
      })
    })
  })

  describe('updateProject', () => {
    it('should return null if project not found', async () => {
      mockDb.project.findUnique.mockResolvedValue(null)

      const result = await projectService.updateProject('nonexistent', {
        title: 'New Title',
      })

      expect(result).toBeNull()
    })

    it('should update project successfully', async () => {
      const existingProject = {
        id: 'proj_123',
        config: DEFAULT_PROJECT_CONFIG,
        status: 'DRAFT',
      }

      const updatedProject = {
        id: 'proj_123',
        title: 'Updated Title',
        description: 'Updated Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { scenes: 0, jobs: 0 },
      }

      mockDb.project.findUnique.mockResolvedValue(existingProject)
      mockDb.project.update.mockResolvedValue(updatedProject)

      const result = await projectService.updateProject('proj_123', {
        title: 'Updated Title',
        description: 'Updated Description',
      })

      expect(mockDb.project.update).toHaveBeenCalledWith({
        where: { id: 'proj_123' },
        data: {
          title: 'Updated Title',
          description: 'Updated Description',
        },
        include: {
          _count: {
            select: {
              scenes: true,
              jobs: true,
            },
          },
        },
      })

      expect(result).toEqual({
        id: 'proj_123',
        title: 'Updated Title',
        description: 'Updated Description',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
        scene_count: 0,
        job_count: 0,
        latest_job: null,
        created_at: updatedProject.createdAt.toISOString(),
        updated_at: updatedProject.updatedAt.toISOString(),
      })
    })

    it('should reject invalid status transitions', async () => {
      const existingProject = {
        id: 'proj_123',
        config: DEFAULT_PROJECT_CONFIG,
        status: 'PROCESSING',
      }

      mockDb.project.findUnique.mockResolvedValue(existingProject)

      await expect(
        projectService.updateProject('proj_123', {
          status: 'READY',
        })
      ).rejects.toThrow('Cannot transition from PROCESSING to READY')
    })
  })

  describe('deleteProject', () => {
    it('should return null if project not found', async () => {
      mockDb.project.findUnique.mockResolvedValue(null)

      const result = await projectService.deleteProject('nonexistent')

      expect(result).toBeNull()
    })

    it('should prevent deletion of projects with active jobs', async () => {
      const existingProject = {
        id: 'proj_123',
        status: 'PROCESSING',
        jobs: [{ id: 'job_1' }],
      }

      mockDb.project.findUnique.mockResolvedValue(existingProject)

      await expect(
        projectService.deleteProject('proj_123')
      ).rejects.toThrow('Cannot delete project with active jobs')
    })

    it('should delete project successfully', async () => {
      const existingProject = {
        id: 'proj_123',
        status: 'COMPLETED',
        jobs: [],
      }

      mockDb.project.findUnique.mockResolvedValue(existingProject)
      mockDb.project.delete.mockResolvedValue(existingProject)

      const result = await projectService.deleteProject('proj_123')

      expect(mockDb.project.delete).toHaveBeenCalledWith({
        where: { id: 'proj_123' },
      })
      expect(result).toBe(true)
    })
  })

  describe('estimateProjectCost', () => {
    it('should calculate cost estimate based on scenes and config', async () => {
      const mockProject = {
        id: 'proj_123',
        config: {
          ...DEFAULT_PROJECT_CONFIG,
          generation: { ...DEFAULT_PROJECT_CONFIG.generation, images_per_scene: 2 },
        },
        scenes: [
          { text: 'Scene 1 with some text content' },
          { text: 'Scene 2 with more text content for testing' },
        ],
      }

      mockDb.project.findUnique.mockResolvedValue(mockProject)

      const result = await projectService.estimateProjectCost('proj_123')

      expect(result).toEqual({
        llm_cost: expect.any(Number),
        image_cost: expect.any(Number),
        tts_cost: expect.any(Number),
        render_cost: expect.any(Number),
        total_min: expect.any(Number),
        total_max: expect.any(Number),
        currency: 'USD',
      })

      // Verify image cost calculation (2 scenes × 2 images per scene × $0.04)
      expect(result.image_cost).toBe(0.16)
    })

    it('should throw error if project not found', async () => {
      mockDb.project.findUnique.mockResolvedValue(null)

      await expect(
        projectService.estimateProjectCost('nonexistent')
      ).rejects.toThrow('Project not found')
    })
  })
})