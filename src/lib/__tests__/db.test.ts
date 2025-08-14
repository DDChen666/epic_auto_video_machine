/**
 * Database connection and basic functionality tests
 * These tests verify that the database setup is working correctly
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { prisma, checkDatabaseConnection, DatabaseService } from '../db'
import { DEFAULT_PROJECT_CONFIG } from '../../types'

describe('Database Connection', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect()
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.scene.deleteMany({
      where: { project: { title: { contains: 'Test' } } },
    })
    await prisma.job.deleteMany({
      where: { project: { title: { contains: 'Test' } } },
    })
    await prisma.project.deleteMany({ where: { title: { contains: 'Test' } } })
    await prisma.preset.deleteMany({ where: { name: { contains: 'Test' } } })
    await prisma.asset.deleteMany({ where: { uri: { contains: 'test' } } })
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } })
    await prisma.$disconnect()
  })

  it('should connect to database successfully', async () => {
    const isConnected = await checkDatabaseConnection()
    expect(isConnected).toBe(true)
  })

  it('should create and retrieve a user', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      },
    })

    expect(testUser.id).toBeDefined()
    expect(testUser.email).toBe('test@example.com')
    expect(testUser.role).toBe('USER')

    const retrievedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    })

    expect(retrievedUser).not.toBeNull()
    expect(retrievedUser?.email).toBe('test@example.com')
  })

  it('should create a project with proper user scoping', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'test-project@example.com',
        name: 'Test Project User',
        role: 'USER',
      },
    })

    const testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        title: 'Test Project',
        description: 'A test project',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
      },
    })

    expect(testProject.id).toBeDefined()
    expect(testProject.userId).toBe(testUser.id)
    expect(testProject.title).toBe('Test Project')
    expect(testProject.status).toBe('DRAFT')
  })

  it('should enforce user scoping with DatabaseService', async () => {
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@example.com',
        name: 'User 1',
        role: 'USER',
      },
    })

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        name: 'User 2',
        role: 'USER',
      },
    })

    // Create project for user1
    const user1Project = await prisma.project.create({
      data: {
        userId: user1.id,
        title: 'User 1 Test Project',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
      },
    })

    // User2 should not be able to access user1's project
    const hasOwnership = await DatabaseService.verifyUserOwnership(
      user2.id,
      'project',
      user1Project.id
    )

    expect(hasOwnership).toBe(false)

    // User1 should be able to access their own project
    const hasOwnOwnership = await DatabaseService.verifyUserOwnership(
      user1.id,
      'project',
      user1Project.id
    )

    expect(hasOwnOwnership).toBe(true)
  })

  it('should create scenes with proper ordering', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'test-scenes@example.com',
        name: 'Test Scenes User',
        role: 'USER',
      },
    })

    const testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        title: 'Test Scenes Project',
        status: 'DRAFT',
        config: DEFAULT_PROJECT_CONFIG,
      },
    })

    const scenes = await Promise.all([
      prisma.scene.create({
        data: {
          projectId: testProject.id,
          index: 0,
          text: 'First scene',
        },
      }),
      prisma.scene.create({
        data: {
          projectId: testProject.id,
          index: 1,
          text: 'Second scene',
        },
      }),
      prisma.scene.create({
        data: {
          projectId: testProject.id,
          index: 2,
          text: 'Third scene',
        },
      }),
    ])

    expect(scenes).toHaveLength(3)
    expect(scenes[0].index).toBe(0)
    expect(scenes[1].index).toBe(1)
    expect(scenes[2].index).toBe(2)

    // Verify scenes are retrieved in order
    const retrievedScenes = await prisma.scene.findMany({
      where: { projectId: testProject.id },
      orderBy: { index: 'asc' },
    })

    expect(retrievedScenes).toHaveLength(3)
    expect(retrievedScenes[0].text).toBe('First scene')
    expect(retrievedScenes[1].text).toBe('Second scene')
    expect(retrievedScenes[2].text).toBe('Third scene')
  })

  it('should handle JSON configuration properly', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'test-config@example.com',
        name: 'Test Config User',
        role: 'USER',
      },
    })

    const customConfig = {
      ...DEFAULT_PROJECT_CONFIG,
      aspect_ratio: '16:9' as const,
      template: {
        ...DEFAULT_PROJECT_CONFIG.template,
        name: 'dark' as const,
      },
    }

    const testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        title: 'Test Config Project',
        status: 'DRAFT',
        config: customConfig,
      },
    })

    const retrievedProject = await prisma.project.findUnique({
      where: { id: testProject.id },
    })

    expect(retrievedProject?.config).toEqual(customConfig)
  })

  it('should get database statistics', async () => {
    const stats = await DatabaseService.getDatabaseStats()

    expect(stats).not.toBeNull()
    expect(typeof stats?.users).toBe('number')
    expect(typeof stats?.projects).toBe('number')
    expect(typeof stats?.jobs).toBe('number')
    expect(typeof stats?.assets).toBe('number')
    expect(stats?.timestamp).toBeDefined()
  })
})
