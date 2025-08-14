#!/usr/bin/env tsx

/**
 * Test script for prompt generation API endpoints
 * Tests the API functionality with mock data
 */

import { NextRequest } from 'next/server'
import { POST, PUT, GET } from '../src/app/api/v1/projects/[id]/prompts/route'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
  }),
}))

// Mock services
jest.mock('../src/lib/prompt-generation-service', () => ({
  PromptGenerationService: {
    create: jest.fn().mockResolvedValue({
      generateScenePrompts: jest.fn().mockResolvedValue([
        {
          sceneIndex: 1,
          originalText: '一個美麗的女孩在公園裡散步',
          visualPrompt:
            'beautiful girl walking in park, professional photography',
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
      ]),
      validateAndEditPrompt: jest.fn().mockResolvedValue({
        isValid: true,
        safetyResult: {
          isSafe: true,
          violations: [],
        },
        suggestions: [],
      }),
      generatePromptPreview: jest
        .fn()
        .mockReturnValue('beautiful • girl • walking • park • professional'),
    }),
  },
}))

jest.mock('../src/lib/project-service', () => ({
  ProjectService: jest.fn().mockImplementation(() => ({
    getProject: jest.fn().mockResolvedValue({
      id: 'project-123',
      title: 'Test Project',
      config: {
        aspect_ratio: '9:16',
        template: {
          name: 'classic',
          transitions: 'fade',
          transition_duration: 500,
          background_music: true,
          bgm_volume: -18,
        },
        voice: {
          type: 'natural',
          speed: 1.0,
          language: 'zh-TW',
          accent: 'taiwan',
        },
        generation: {
          images_per_scene: 1,
          image_quality: 'standard',
          retry_attempts: 3,
          timeout_seconds: 300,
          smart_crop: true,
        },
        safety: {
          content_policy: 'standard',
          blocked_words: [],
          error_strategy: 'skip',
          adult_content: 'block',
          violence_filter: true,
        },
      },
    }),
    getProjectWithScenes: jest.fn().mockResolvedValue({
      id: 'project-123',
      scenes: [
        {
          id: 'scene-1',
          index: 1,
          text: 'Scene 1 text',
          prompt: 'beautiful girl walking in park, professional photography',
        },
      ],
    }),
    updateScenePrompts: jest.fn().mockResolvedValue(true),
  })),
}))

async function testPromptAPI() {
  console.log('🚀 Testing Prompt Generation API...\n')

  try {
    // Test 1: POST - Generate prompts
    console.log('📝 Test 1: POST /api/v1/projects/[id]/prompts')
    const postRequest = new NextRequest(
      'http://localhost/api/v1/projects/project-123/prompts',
      {
        method: 'POST',
        body: JSON.stringify({
          scenes: [
            {
              id: 'scene-1',
              index: 1,
              text: '一個美麗的女孩在公園裡散步',
            },
          ],
        }),
      }
    )

    const postResponse = await POST(postRequest, {
      params: { id: 'project-123' },
    })
    const postData = await postResponse.json()

    console.log('  Status:', postResponse.status)
    console.log('  Success:', postData.success)
    console.log('  Data length:', postData.data?.length || 0)
    console.log('  Message:', postData.message)
    console.log('')

    // Test 2: PUT - Validate edited prompt
    console.log('🔒 Test 2: PUT /api/v1/projects/[id]/prompts')
    const putRequest = new NextRequest(
      'http://localhost/api/v1/projects/project-123/prompts',
      {
        method: 'PUT',
        body: JSON.stringify({
          originalPrompt: 'original prompt',
          editedPrompt: 'edited safe prompt',
        }),
      }
    )

    const putResponse = await PUT(putRequest, { params: { id: 'project-123' } })
    const putData = await putResponse.json()

    console.log('  Status:', putResponse.status)
    console.log('  Success:', putData.success)
    console.log('  Is Valid:', putData.data?.isValid)
    console.log('  Violations:', putData.data?.safetyViolations?.length || 0)
    console.log('')

    // Test 3: GET - Get prompt previews
    console.log('👀 Test 3: GET /api/v1/projects/[id]/prompts/preview')
    const getRequest = new NextRequest(
      'http://localhost/api/v1/projects/project-123/prompts/preview'
    )

    const getResponse = await GET(getRequest, { params: { id: 'project-123' } })
    const getData = await getResponse.json()

    console.log('  Status:', getResponse.status)
    console.log('  Success:', getData.success)
    console.log('  Previews count:', getData.data?.length || 0)
    if (getData.data && getData.data.length > 0) {
      console.log('  First preview:', getData.data[0].preview)
    }
    console.log('')

    console.log('🎉 All API tests completed successfully!')
  } catch (error) {
    console.error('❌ API test failed:', error)
    process.exit(1)
  }
}

// Run tests
testPromptAPI().catch(console.error)
