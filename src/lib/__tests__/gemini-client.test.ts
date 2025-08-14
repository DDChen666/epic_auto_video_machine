import {
  GeminiClient,
  GEMINI_MODELS,
  FREE_TIER_LIMITS,
  GeminiErrorType,
} from '../gemini-client'
import {
  withRetry,
  calculateDelay,
  DEFAULT_RETRY_CONFIG,
} from '../gemini-retry'
import { GeminiService } from '../gemini-service'

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}))

describe('GeminiClient', () => {
  let client: GeminiClient

  beforeEach(() => {
    // Set up environment variable for testing
    process.env.GEMINI_API_KEY = 'test-api-key'
    client = new GeminiClient()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with API key from environment', () => {
      expect(client).toBeInstanceOf(GeminiClient)
    })

    it('should throw error if no API key provided', () => {
      delete process.env.GEMINI_API_KEY
      expect(() => new GeminiClient()).toThrow('Gemini API key is required')
    })

    it('should accept BYO API key in config', () => {
      const customClient = new GeminiClient({ apiKey: 'custom-key' })
      expect(customClient).toBeInstanceOf(GeminiClient)
    })
  })

  describe('model constants', () => {
    it('should have correct model names', () => {
      expect(GEMINI_MODELS.TEXT).toBe('gemini-2.0-flash-exp')
      expect(GEMINI_MODELS.TTS).toBe('gemini-2.0-flash-exp')
      expect(GEMINI_MODELS.IMAGE).toBe('gemini-2.0-flash-exp')
      expect(GEMINI_MODELS.IMAGEN).toBe('imagen-3.0-generate-001')
    })
  })

  describe('rate limiting', () => {
    it('should have correct free tier limits', () => {
      expect(FREE_TIER_LIMITS.TEXT.rpm).toBe(15)
      expect(FREE_TIER_LIMITS.TTS.rpm).toBe(15)
      expect(FREE_TIER_LIMITS.IMAGE.rpm).toBe(15)
      expect(FREE_TIER_LIMITS.IMAGEN.rpm).toBe(10)
    })

    it('should track rate limit status', () => {
      const status = client.getRateLimitStatus('TEXT')
      expect(status).toHaveProperty('remaining')
      expect(status).toHaveProperty('resetTime')
      expect(typeof status.remaining).toBe('number')
      expect(typeof status.resetTime).toBe('number')
    })
  })

  describe('error handling', () => {
    it('should classify API key errors correctly', async () => {
      const mockModel = {
        generateContent: jest
          .fn()
          .mockRejectedValue(new Error('Invalid API key')),
      }

      const mockGenAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }

      // Mock the client's genAI instance
      ;(client as any).genAI = mockGenAI

      try {
        await client.generateText('test prompt')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.type).toBe(GeminiErrorType.INVALID_API_KEY)
        expect(error.retryable).toBe(false)
      }
    })

    it('should classify rate limit errors correctly', async () => {
      const mockModel = {
        generateContent: jest
          .fn()
          .mockRejectedValue(new Error('429 rate limit')),
      }

      const mockGenAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockModel),
      }

      ;(client as any).genAI = mockGenAI

      try {
        await client.generateText('test prompt')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.type).toBe(GeminiErrorType.RATE_LIMIT)
        expect(error.retryable).toBe(true)
      }
    })
  })
})

describe('Retry Mechanism', () => {
  describe('calculateDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitter: false }

      expect(calculateDelay(1, config)).toBe(1000) // 1 * 1000
      expect(calculateDelay(2, config)).toBe(2000) // 2 * 1000
      expect(calculateDelay(3, config)).toBe(4000) // 4 * 1000
    })

    it('should respect max delay limit', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelay: 5000, jitter: false }

      expect(calculateDelay(10, config)).toBe(5000)
    })

    it('should add jitter when enabled', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitter: true }

      const delay1 = calculateDelay(1, config)
      const delay2 = calculateDelay(1, config)

      // With jitter, delays should be different
      expect(delay1).not.toBe(delay2)
      expect(delay1).toBeGreaterThan(900) // Should be around 1000 ± 10%
      expect(delay1).toBeLessThan(1100)
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const retryableError = new Error('Service error') as any
      retryableError.type = GeminiErrorType.SERVICE_ERROR
      retryableError.retryable = true

      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success')

      const result = await withRetry(operation, {
        ...DEFAULT_RETRY_CONFIG,
        baseDelay: 10, // Speed up test
        maxAttempts: 3,
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid API key') as any
      nonRetryableError.type = GeminiErrorType.INVALID_API_KEY
      nonRetryableError.retryable = false

      const operation = jest.fn().mockRejectedValue(nonRetryableError)

      await expect(withRetry(operation)).rejects.toThrow('Invalid API key')
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})

describe('GeminiService', () => {
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

  describe('generateScenePrompts', () => {
    it('should generate prompts for multiple scenes', async () => {
      mockClient.generateText.mockResolvedValue(
        'A cinematic scene with beautiful lighting'
      )

      const scenes = [
        { index: 0, text: 'A person walking in the park' },
        { index: 1, text: 'The sun setting behind mountains' },
      ]

      const results = await service.generateScenePrompts(scenes)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[0].visualPrompt).toBe(
        'A cinematic scene with beautiful lighting'
      )
      expect(results[1].success).toBe(true)
      expect(mockClient.generateText).toHaveBeenCalledTimes(2)
    })

    it('should handle failures with fallback prompts', async () => {
      // Mock the circuit breaker to throw an error that will trigger fallback
      const circuitBreakerError = new Error('API error') as any
      circuitBreakerError.retryable = false

      // Mock the service's circuit breaker execute method
      const mockCircuitBreaker = {
        execute: jest.fn().mockRejectedValue(circuitBreakerError),
      }
      ;(service as any).circuitBreaker = mockCircuitBreaker

      const scenes = [{ index: 0, text: 'A person walking in the park' }]

      const results = await service.generateScenePrompts(scenes)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true) // Should succeed with fallback
      expect(results[0].visualPrompt).toContain('cinematic scene')
    })
  })

  describe('segmentTextIntoScenes', () => {
    it('should use LLM segmentation when available', async () => {
      const mockSegments = [
        { index: 1, text: 'First scene text', startChar: 0, endChar: 50 },
        { index: 2, text: 'Second scene text', startChar: 51, endChar: 100 },
      ]

      mockClient.generateText.mockResolvedValue(JSON.stringify(mockSegments))

      const result = await service.segmentTextIntoScenes(
        'A long story text here...'
      )

      expect(result).toEqual(mockSegments)
      expect(mockClient.generateText).toHaveBeenCalledTimes(1)
    })

    it('should fall back to rule-based segmentation on LLM failure', async () => {
      mockClient.generateText.mockRejectedValue(new Error('LLM error'))

      const text = 'First sentence. Second sentence. Third sentence.'
      const result = await service.segmentTextIntoScenes(text)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('index')
      expect(result[0]).toHaveProperty('text')
      expect(result[0]).toHaveProperty('startChar')
      expect(result[0]).toHaveProperty('endChar')
    })
  })

  describe('healthCheck', () => {
    it('should return comprehensive health status', async () => {
      mockClient.checkAvailability.mockResolvedValue(true)
      mockClient.getRateLimitStatus.mockReturnValue({
        remaining: 10,
        resetTime: Date.now() + 60000,
      })

      const health = await service.healthCheck()

      expect(health.available).toBe(true)
      expect(health.rateLimits).toHaveProperty('text')
      expect(health.rateLimits).toHaveProperty('image')
      expect(health.rateLimits).toHaveProperty('tts')
      expect(health.circuitBreakerState).toHaveProperty('state')
      expect(health.concurrencyStatus).toHaveProperty('active')
    })
  })
})
