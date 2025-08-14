#!/usr/bin/env tsx

/**
 * Test script for prompt generation service
 * Tests the core functionality without requiring full database setup
 */

import { PromptGenerationService } from '../src/lib/prompt-generation-service'
import { GeminiClient } from '../src/lib/gemini-client'
import type { ProjectConfig, SceneData } from '../src/types'

// Mock GeminiClient for testing
class MockGeminiClient {
  async generateText(prompt: string): Promise<string> {
    console.log(
      '🤖 Mock LLM called with prompt:',
      prompt.substring(0, 100) + '...'
    )

    // Simulate visual elements extraction
    if (prompt.includes('視覺要素分析')) {
      return JSON.stringify({
        subject: ['女孩', '人物'],
        environment: ['公園', '戶外'],
        camera: ['medium shot'],
        lighting: ['陽光', '自然光'],
        mood: ['愉快', '輕鬆'],
      })
    }

    // Simulate English prompt generation
    if (prompt.includes('English visual prompt')) {
      return 'beautiful girl walking in park, bright sunlight, cheerful mood, professional photography, high quality'
    }

    // Simulate safe alternative generation
    if (prompt.includes('content safety expert')) {
      return 'safe and appropriate scene, professional photography, high quality'
    }

    // Simulate alternative prompts
    if (prompt.includes('alternative visual prompts')) {
      return 'alternative prompt 1\nalternative prompt 2\nalternative prompt 3'
    }

    return 'mock response'
  }

  async checkAvailability(): Promise<boolean> {
    return true
  }

  getRateLimitStatus(): { remaining: number; resetTime: number } {
    return { remaining: 100, resetTime: Date.now() + 3600000 }
  }
}

async function testPromptGeneration() {
  console.log('🚀 Testing Prompt Generation Service...\n')

  // Create service with mock client
  const mockClient = new MockGeminiClient()
  const service = new PromptGenerationService(mockClient as any)

  // Test configuration
  const config: ProjectConfig = {
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
      blocked_words: ['violence', 'inappropriate'],
      error_strategy: 'skip',
      adult_content: 'block',
      violence_filter: true,
    },
  }

  // Test scenes
  const scenes: SceneData[] = [
    {
      id: 'scene-1',
      index: 1,
      text: '一個美麗的女孩在公園裡散步，陽光灿爛，心情愉快。',
    },
    {
      id: 'scene-2',
      index: 2,
      text: '夜晚的城市街道，霓虹燈閃爍，人們匆忙走過。',
    },
  ]

  try {
    // Test 1: Generate scene prompts
    console.log('📝 Test 1: Generating scene prompts...')
    const results = await service.generateScenePrompts(scenes, config)

    console.log('✅ Generated prompts:')
    results.forEach((result, index) => {
      console.log(`  Scene ${index + 1}:`)
      console.log(`    Original: ${result.originalText}`)
      console.log(`    Prompt: ${result.visualPrompt}`)
      console.log(`    Safety: ${result.safetyStatus}`)
      console.log(`    Success: ${result.success}`)
      console.log(`    Visual Elements:`, result.visualElements)
      console.log('')
    })

    // Test 2: Generate prompt preview
    console.log('👀 Test 2: Generating prompt previews...')
    results.forEach((result, index) => {
      const preview = service.generatePromptPreview(result.visualPrompt)
      console.log(`  Scene ${index + 1} preview: ${preview}`)
    })
    console.log('')

    // Test 3: Validate edited prompt (safe)
    console.log('🔒 Test 3: Validating safe edited prompt...')
    const safeValidation = await service.validateAndEditPrompt(
      'original prompt',
      'edited safe prompt with improvements',
      config
    )
    console.log('  Safe prompt validation:', {
      isValid: safeValidation.isValid,
      violations: safeValidation.safetyResult.violations,
    })
    console.log('')

    // Test 4: Validate edited prompt (unsafe)
    console.log('⚠️  Test 4: Validating unsafe edited prompt...')
    const unsafeValidation = await service.validateAndEditPrompt(
      'original prompt',
      'prompt with violence and inappropriate content',
      config
    )
    console.log('  Unsafe prompt validation:', {
      isValid: unsafeValidation.isValid,
      violations: unsafeValidation.safetyResult.violations,
      hasAlternatives: (unsafeValidation.suggestions?.length || 0) > 0,
    })
    console.log('')

    // Test 5: Template application
    console.log('🎨 Test 5: Testing template application...')
    const templates = ['classic', 'dark', 'vivid'] as const
    templates.forEach(templateName => {
      const templateConfig = {
        ...config,
        template: { ...config.template, name: templateName },
      }
      const templateResult = (service as any).applyTemplate(
        'basic scene',
        templateConfig
      )
      console.log(
        `  ${templateName} template: ${templateResult.substring(0, 80)}...`
      )
    })
    console.log('')

    console.log('🎉 All tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests
testPromptGeneration().catch(console.error)
