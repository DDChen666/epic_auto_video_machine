import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { PromptGenerationService } from '../prompt-generation-service'
import { GeminiClient } from '../gemini-client'
import type { ProjectConfig, SceneData } from '../../types'

// Mock GeminiClient
jest.mock('../gemini-client')

describe('PromptGenerationService', () => {
  let service: PromptGenerationService
  let mockClient: {
    generateText: jest.MockedFunction<any>
    checkAvailability: jest.MockedFunction<any>
    getRateLimitStatus: jest.MockedFunction<any>
  }

  const mockConfig: ProjectConfig = {
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

  const mockScenes: SceneData[] = [
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

  beforeEach(() => {
    mockClient = {
      generateText: jest.fn(),
      checkAvailability: jest.fn().mockResolvedValue(true),
      getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 100, resetTime: Date.now() + 3600000 }),
    }

    // Mock the GeminiClient constructor
    ;(GeminiClient as any).mockImplementation(() => mockClient)
    ;(GeminiClient as any).createWithBYOKey = jest.fn().mockResolvedValue(mockClient)

    service = new PromptGenerationService(mockClient as any)
  })

  describe('generateScenePrompts', () => {
    it('should generate visual prompts for multiple scenes', async () => {
      // Mock visual elements extraction
      mockClient.generateText
        .mockResolvedValueOnce(JSON.stringify({
          subject: ['女孩'],
          environment: ['公園'],
          camera: ['medium shot'],
          lighting: ['陽光'],
          mood: ['愉快'],
        }))
        .mockResolvedValueOnce('beautiful girl walking in park, bright sunlight, cheerful mood, professional photography')
        .mockResolvedValueOnce(JSON.stringify({
          subject: ['人們'],
          environment: ['城市街道'],
          camera: ['wide shot'],
          lighting: ['霓虹燈'],
          mood: ['匆忙'],
        }))
        .mockResolvedValueOnce('city street at night, neon lights, people walking, cinematic lighting, urban atmosphere')

      const results = await service.generateScenePrompts(mockScenes, mockConfig)

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        sceneIndex: 1,
        originalText: mockScenes[0].text,
        success: true,
        safetyStatus: 'safe',
      })
      expect(results[0].visualPrompt).toContain('beautiful girl walking in park')
      expect(results[0].visualElements.subject).toContain('女孩')
      expect(results[0].visualElements.environment).toContain('公園')
    })

    it('should handle LLM failures with fallback prompts', async () => {
      mockClient.generateText.mockRejectedValue(new Error('API Error'))

      const results = await service.generateScenePrompts(mockScenes, mockConfig)

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        sceneIndex: 1,
        success: false,
        safetyStatus: 'safe',
      })
      expect(results[0].visualPrompt).toContain('professional photography')
      expect(results[0].error).toBe('API Error')
    })

    it('should apply safety filtering to generated prompts', async () => {
      // Mock prompt with blocked content
      mockClient.generateText
        .mockResolvedValueOnce(JSON.stringify({
          subject: ['人'],
          environment: ['場景'],
          camera: ['shot'],
          lighting: ['光'],
          mood: ['情緒'],
        }))
        .mockResolvedValueOnce('scene with violence and inappropriate content')
        .mockResolvedValueOnce('safe alternative scene, professional photography')

      const results = await service.generateScenePrompts([mockScenes[0]], mockConfig)

      expect(results[0].safetyStatus).toBe('filtered')
      expect(results[0].visualPrompt).not.toContain('violence')
      expect(results[0].visualPrompt).toContain('professional photography')
    })

    it('should apply template-specific enhancements', async () => {
      const darkConfig = {
        ...mockConfig,
        template: { ...mockConfig.template, name: 'dark' as const },
      }

      mockClient.generateText
        .mockResolvedValueOnce(JSON.stringify({
          subject: ['人'],
          environment: ['場景'],
          camera: ['shot'],
          lighting: ['光'],
          mood: ['情緒'],
        }))
        .mockResolvedValueOnce('basic scene description')

      const results = await service.generateScenePrompts([mockScenes[0]], darkConfig)

      expect(results[0].visualPrompt).toContain('dark aesthetic')
      expect(results[0].visualPrompt).toContain('glass morphism')
    })
  })

  describe('validateAndEditPrompt', () => {
    it('should validate safe edited prompts', async () => {
      const originalPrompt = 'original scene description'
      const editedPrompt = 'edited scene description, professional photography'

      const result = await service.validateAndEditPrompt(
        originalPrompt,
        editedPrompt,
        mockConfig
      )

      expect(result.isValid).toBe(true)
      expect(result.safetyResult.isSafe).toBe(true)
      expect(result.safetyResult.violations).toHaveLength(0)
    })

    it('should detect and filter unsafe edited prompts', async () => {
      const originalPrompt = 'original scene description'
      const editedPrompt = 'scene with violence and inappropriate content'

      mockClient.generateText
        .mockResolvedValueOnce('safe alternative prompt')
        .mockResolvedValueOnce('alternative 1\nalternative 2\nalternative 3')

      const result = await service.validateAndEditPrompt(
        originalPrompt,
        editedPrompt,
        mockConfig
      )

      expect(result.isValid).toBe(false)
      expect(result.safetyResult.violations).toContain('Inappropriate content: violence')
      expect(result.safetyResult.violations).toContain('Inappropriate content: inappropriate')
      expect(result.suggestions).toHaveLength(3)
    })

    it('should handle custom blocked words', async () => {
      const configWithCustomBlocked = {
        ...mockConfig,
        safety: {
          ...mockConfig.safety,
          blocked_words: ['custom_blocked_word'],
        },
      }

      const originalPrompt = 'original scene'
      const editedPrompt = 'scene with custom_blocked_word content'

      const result = await service.validateAndEditPrompt(
        originalPrompt,
        editedPrompt,
        configWithCustomBlocked
      )

      expect(result.isValid).toBe(false)
      expect(result.safetyResult.violations).toContain('Blocked word: custom_blocked_word')
    })
  })

  describe('generatePromptPreview', () => {
    it('should generate concise preview from full prompt', () => {
      const fullPrompt = 'beautiful girl walking in park, bright sunlight, cheerful mood, professional photography, high quality'
      
      const preview = service.generatePromptPreview(fullPrompt)
      
      expect(preview).toContain('beautiful')
      expect(preview).toContain('girl')
      expect(preview).toContain('walking')
      expect(preview).toContain('park')
      expect(preview).toContain('bright')
      expect(preview.split(' • ')).toHaveLength(5)
    })

    it('should filter out common words from preview', () => {
      const fullPrompt = 'the beautiful girl was walking with her dog and the weather was nice'
      
      const preview = service.generatePromptPreview(fullPrompt)
      
      expect(preview).not.toContain('the')
      expect(preview).not.toContain('was')
      expect(preview).not.toContain('with')
      expect(preview).not.toContain('and')
    })
  })

  describe('template system', () => {
    it('should apply classic template correctly', () => {
      const prompt = 'basic scene'
      const result = (service as any).applyTemplate(prompt, mockConfig)

      expect(result).toContain('clean composition')
      expect(result).toContain('soft lighting')
      expect(result).toContain('professional photography')
      expect(result).toContain('minimal')
      expect(result).toContain('elegant')
    })

    it('should apply dark template correctly', () => {
      const darkConfig = {
        ...mockConfig,
        template: { ...mockConfig.template, name: 'dark' as const },
      }
      const prompt = 'basic scene'
      const result = (service as any).applyTemplate(prompt, darkConfig)

      expect(result).toContain('dark aesthetic')
      expect(result).toContain('glass morphism')
      expect(result).toContain('moody atmosphere')
      expect(result).toContain('cinematic')
      expect(result).toContain('dramatic lighting')
    })

    it('should apply vivid template correctly', () => {
      const vividConfig = {
        ...mockConfig,
        template: { ...mockConfig.template, name: 'vivid' as const },
      }
      const prompt = 'basic scene'
      const result = (service as any).applyTemplate(prompt, vividConfig)

      expect(result).toContain('vibrant colors')
      expect(result).toContain('gradient backgrounds')
      expect(result).toContain('energetic mood')
      expect(result).toContain('colorful')
      expect(result).toContain('dynamic')
    })
  })

  describe('visual elements extraction', () => {
    it('should extract visual elements from Chinese text', async () => {
      mockClient.generateText.mockResolvedValueOnce(JSON.stringify({
        subject: ['女孩', '狗'],
        environment: ['公園', '草地'],
        camera: ['medium shot', 'close up'],
        lighting: ['陽光', '自然光'],
        mood: ['快樂', '輕鬆'],
      }))

      const elements = await (service as any).extractVisualElements('一個女孩和她的狗在公園的草地上玩耍，陽光明媚，氣氛輕鬆愉快')

      expect(elements.subject).toContain('女孩')
      expect(elements.subject).toContain('狗')
      expect(elements.environment).toContain('公園')
      expect(elements.environment).toContain('草地')
      expect(elements.lighting).toContain('陽光')
      expect(elements.mood).toContain('快樂')
    })

    it('should use fallback extraction when LLM fails', async () => {
      mockClient.generateText.mockRejectedValue(new Error('API Error'))

      const elements = await (service as any).extractVisualElements('一個人在家裡看書，燈光明亮')

      expect(elements.subject).toContain('人')
      expect(elements.environment).toContain('家')
      expect(elements.lighting).toContain('明亮')
      expect(elements.camera).toContain('medium shot') // default
    })
  })

  describe('safety filtering', () => {
    it('should detect built-in blocked words', async () => {
      const prompt = 'scene with violence and weapons'
      
      const result = await (service as any).applySafetyFilter(prompt, mockConfig.safety)

      expect(result.isSafe).toBe(false)
      expect(result.violations).toContain('Inappropriate content: violence')
      expect(result.violations).toContain('Inappropriate content: weapon')
    })

    it('should detect custom blocked words', async () => {
      const customSafety = {
        ...mockConfig.safety,
        blocked_words: ['custom_word'],
      }
      const prompt = 'scene with custom_word content'
      
      const result = await (service as any).applySafetyFilter(prompt, customSafety)

      expect(result.isSafe).toBe(false)
      expect(result.violations).toContain('Blocked word: custom_word')
    })

    it('should pass safe content', async () => {
      const prompt = 'beautiful landscape with mountains and trees'
      
      const result = await (service as any).applySafetyFilter(prompt, mockConfig.safety)

      expect(result.isSafe).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should generate safe alternatives for unsafe content', async () => {
      const prompt = 'scene with violence'
      
      mockClient.generateText
        .mockResolvedValueOnce('safe alternative scene')
        .mockResolvedValueOnce('alternative 1\nalternative 2\nalternative 3')

      const result = await (service as any).applySafetyFilter(prompt, mockConfig.safety)

      expect(result.isSafe).toBe(false)
      expect(result.filteredPrompt).toBe('safe alternative scene')
      expect(result.alternatives).toHaveLength(3)
    })
  })

  describe('error handling', () => {
    it('should handle service creation with BYO key', async () => {
      const mockBYOClient = { ...mockClient }
      ;(GeminiClient as any).createWithBYOKey.mockResolvedValue(mockBYOClient)

      const serviceWithBYO = await PromptGenerationService.create('user-123')

      expect(GeminiClient.createWithBYOKey).toHaveBeenCalledWith('user-123')
      expect(serviceWithBYO).toBeInstanceOf(PromptGenerationService)
    })

    it('should handle service creation without BYO key', async () => {
      const serviceWithoutBYO = await PromptGenerationService.create()

      expect(GeminiClient.createWithBYOKey).not.toHaveBeenCalled()
      expect(serviceWithoutBYO).toBeInstanceOf(PromptGenerationService)
    })

    it('should provide fallback prompts when all generation fails', async () => {
      mockClient.generateText.mockRejectedValue(new Error('Complete API failure'))

      const results = await service.generateScenePrompts([mockScenes[0]], mockConfig)

      expect(results[0].success).toBe(false)
      expect(results[0].visualPrompt).toContain('professional photography')
      expect(results[0].visualPrompt).toContain('high quality')
      expect(results[0].visualPrompt).toContain('appropriate content')
    })
  })
})