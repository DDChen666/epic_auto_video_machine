import { GeminiClient, GeminiErrorType } from '../gemini-client'
import { GeminiService } from '../gemini-service'
import { GeminiKeyManager } from '../gemini-key-manager'
import {
  withRetry,
  ConcurrencyController,
  CircuitBreaker,
} from '../gemini-retry'

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}))

describe('Gemini Integration Tests', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key'
    jest.clearAllMocks()
  })

  describe('Error Classification and Retry Logic', () => {
    let client: GeminiClient

    beforeEach(() => {
      client = new GeminiClient()
    })

    it('should handle rate limit errors with exponential backoff', async () => {
      // Test the retry mechanism directly instead of through the client
      let attemptCount = 0
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount <= 2) {
          const error = new Error('429 rate limit exceeded') as any
          error.type = GeminiErrorType.RATE_LIMIT
          error.retryable = true
          throw error
        }
        return Promise.resolve('success')
      })

      const startTime = Date.now()
      const result = await withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10, // Small delay for test speed
        maxDelay: 100,
        backoffStrategy: 'exponential',
        jitter: false,
        retryableErrors: [GeminiErrorType.RATE_LIMIT],
      })
      const endTime = Date.now()

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(endTime - startTime).toBeGreaterThan(10) // Should have some delay
    })

    it('should not retry non-retryable errors', async () => {
      const apiKeyError = new Error('Invalid API key')
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(apiKeyError),
      }

      ;(client as any).genAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }

      try {
        await client.generateText('test prompt')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.type).toBe(GeminiErrorType.INVALID_API_KEY)
        expect(error.retryable).toBe(false)
        expect(mockModel.generateContent).toHaveBeenCalledTimes(1)
      }
    })

    it('should handle content policy violations gracefully', async () => {
      const contentError = new Error('Content policy violation')
      const mockModel = {
        generateContent: jest.fn().mockRejectedValue(contentError),
      }

      ;(client as any).genAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }

      try {
        await client.generateText('inappropriate content')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.type).toBe(GeminiErrorType.CONTENT_POLICY)
        expect(error.retryable).toBe(false)
      }
    })
  })

  describe('Concurrency Control', () => {
    it('should limit concurrent requests', async () => {
      const controller = new ConcurrencyController(2) // Max 2 concurrent
      let activeCount = 0
      let maxActiveCount = 0

      const operation = () =>
        new Promise<string>(resolve => {
          activeCount++
          maxActiveCount = Math.max(maxActiveCount, activeCount)

          setTimeout(() => {
            activeCount--
            resolve('success')
          }, 50)
        })

      // Start 5 operations simultaneously
      const promises = Array(5)
        .fill(0)
        .map(() => controller.execute(operation))
      await Promise.all(promises)

      expect(maxActiveCount).toBeLessThanOrEqual(2)
    })

    it('should queue requests when at capacity', async () => {
      const controller = new ConcurrencyController(1)
      const results: string[] = []

      const operation = (id: string) =>
        new Promise<string>(resolve => {
          setTimeout(() => {
            results.push(id)
            resolve(id)
          }, 10)
        })

      const promises = [
        controller.execute(() => operation('1')),
        controller.execute(() => operation('2')),
        controller.execute(() => operation('3')),
      ]

      await Promise.all(promises)

      // Should execute in order due to concurrency limit of 1
      expect(results).toEqual(['1', '2', '3'])
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker(2, 1000) // 2 failures, 1 second recovery

      const failingOperation = () => Promise.reject(new Error('Service error'))

      // First two failures should work
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        'Service error'
      )
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        'Service error'
      )

      // Third attempt should be blocked by circuit breaker
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        'Circuit breaker is OPEN'
      )

      expect(circuitBreaker.getState().state).toBe('OPEN')
    })

    it('should recover after timeout', async () => {
      const circuitBreaker = new CircuitBreaker(1, 50) // 1 failure, 50ms recovery

      // Trigger circuit breaker
      await expect(
        circuitBreaker.execute(() => Promise.reject(new Error('Error')))
      ).rejects.toThrow()
      expect(circuitBreaker.getState().state).toBe('OPEN')

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 60))

      // Should allow one attempt in HALF_OPEN state
      const successOperation = () => Promise.resolve('success')
      const result = await circuitBreaker.execute(successOperation)

      expect(result).toBe('success')
      expect(circuitBreaker.getState().state).toBe('CLOSED')
    })
  })

  describe('Fallback Strategies', () => {
    let service: GeminiService
    let mockClient: jest.Mocked<GeminiClient>

    beforeEach(() => {
      mockClient = {
        generateText: jest.fn(),
        generateImage: jest.fn(),
        generateSpeech: jest.fn(),
        checkAvailability: jest.fn(),
        getRateLimitStatus: jest.fn(),
      } as any

      service = new GeminiService(mockClient)
    })

    it('should use fallback prompts when LLM fails', async () => {
      mockClient.generateText.mockRejectedValue(
        new Error('Service unavailable')
      )

      const scenes = [{ index: 0, text: 'A beautiful sunset over mountains' }]

      const results = await service.generateScenePrompts(scenes)

      expect(results).toHaveLength(1)
      expect(results[0].visualPrompt).toContain('cinematic scene')
      expect(results[0].visualPrompt).toContain('beautiful')
      expect(results[0].visualPrompt).toContain('sunset')
    })

    it('should use placeholder images when generation fails', async () => {
      mockClient.generateImage.mockRejectedValue(
        new Error('Image generation failed')
      )

      const prompts = [{ index: 0, prompt: 'A beautiful landscape' }]

      const results = await service.generateSceneImages(prompts, {
        aspectRatio: '16:9',
      })

      expect(results).toHaveLength(1)
      expect(results[0].imageUrl).toContain('placeholder.com')
      expect(results[0].imageUrl).toContain('1920x1080')
    })

    it('should handle TTS failures gracefully', async () => {
      const ttsError = new Error('TTS service unavailable') as any
      ttsError.retryable = false

      // Mock the circuit breaker to throw the error
      const mockCircuitBreaker = {
        execute: jest.fn().mockRejectedValue(ttsError),
      }
      ;(service as any).circuitBreaker = mockCircuitBreaker

      const texts = [{ index: 0, text: 'Hello world' }]

      const results = await service.generateSceneTTS(texts, {
        voice: 'natural',
      })

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true) // Should succeed with fallback
      expect(results[0].audioBuffer.byteLength).toBe(0) // Empty buffer as fallback
    })
  })

  describe('BYO API Key Management', () => {
    it('should validate API keys before storing', async () => {
      // Mock successful validation
      const mockClient = new GeminiClient({ apiKey: 'test-key' })
      jest.spyOn(mockClient, 'checkAvailability').mockResolvedValue(true)
      jest
        .spyOn(GeminiClient.prototype, 'checkAvailability')
        .mockResolvedValue(true)

      const result = await GeminiKeyManager.validateApiKey('valid-key')

      expect(result.valid).toBe(true)
      expect(result.quotaInfo).toBeDefined()
    })

    it('should reject invalid API keys', async () => {
      // Mock failed validation
      jest
        .spyOn(GeminiClient.prototype, 'checkAvailability')
        .mockResolvedValue(false)

      const result = await GeminiKeyManager.validateApiKey('invalid-key')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('invalid')
    })

    it('should calculate cost comparisons correctly', () => {
      const operation = {
        textTokens: 1000,
        imageGenerations: 5,
        ttsCharacters: 500,
      }

      const comparison = GeminiKeyManager.getCostComparison(operation)

      expect(comparison.platformCost).toBeGreaterThan(comparison.byoCost)
      expect(comparison.savings).toBeGreaterThan(0)
      expect(comparison.currency).toBe('USD')
    })
  })

  describe('Rate Limiting', () => {
    let client: GeminiClient

    beforeEach(() => {
      client = new GeminiClient({ userId: 'test-user' })
    })

    it('should track rate limit status correctly', () => {
      const status = client.getRateLimitStatus('TEXT')

      expect(status.remaining).toBeLessThanOrEqual(15) // Free tier limit
      expect(typeof status.resetTime).toBe('number')
    })

    it('should enforce rate limits', async () => {
      // Create a fresh client to avoid interference from other tests
      const testClient = new GeminiClient({ userId: 'rate-limit-test-user' })

      // Mock successful responses
      const mockModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => 'success' },
        }),
      }

      ;(testClient as any).genAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }

      // Make requests up to the limit sequentially to trigger rate limiting
      let rateLimitHit = false
      for (let i = 0; i < 16; i++) {
        // One more than the limit
        try {
          await testClient.generateText('test')
        } catch (error: any) {
          if (error.message.includes('Rate limit')) {
            rateLimitHit = true
            break
          }
        }
      }

      expect(rateLimitHit).toBe(true)
    })
  })

  describe('Regional Availability', () => {
    it('should check regional availability', async () => {
      const availability = await GeminiKeyManager.checkRegionalAvailability()

      expect(availability.regions).toBeInstanceOf(Array)
      expect(availability.regions.length).toBeGreaterThan(0)

      const usRegion = availability.regions.find(r => r.name === 'us-central1')
      expect(usRegion).toBeDefined()
      expect(usRegion?.available).toBe(true)
      expect(usRegion?.services.text).toBe(true)
    })
  })

  describe('Health Monitoring', () => {
    it('should provide comprehensive health status', async () => {
      const service = await GeminiService.create('test-user')
      const health = await service.healthCheck()

      expect(health.available).toBeDefined()
      expect(health.rateLimits).toHaveProperty('text')
      expect(health.rateLimits).toHaveProperty('image')
      expect(health.rateLimits).toHaveProperty('tts')
      expect(health.circuitBreakerState).toHaveProperty('state')
      expect(health.concurrencyStatus).toHaveProperty('active')
    })
  })
})
