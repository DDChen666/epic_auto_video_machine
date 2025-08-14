import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai'
import { UserService } from './user-service'

// Model constants (centralized management for easy upgrades)
export const GEMINI_MODELS = {
  TEXT: 'gemini-2.0-flash-exp', // Latest GA version
  TTS: 'gemini-2.0-flash-exp', // TTS capabilities in latest model
  IMAGE: 'gemini-2.0-flash-exp', // Image generation in latest model
  IMAGEN: 'imagen-3.0-generate-001', // Dedicated image generation model
} as const

// Free Tier limits (RPM = Requests Per Minute)
export const FREE_TIER_LIMITS = {
  TEXT: { rpm: 15, tpm: 1000000, rpd: 1500 }, // Updated limits for 2.0-flash-exp
  TTS: { rpm: 15, tpm: 1000000, rpd: 1500 },
  IMAGE: { rpm: 15, tpm: 1000000, rpd: 1500 },
  IMAGEN: { rpm: 10, tpm: 200000, rpd: 100 },
} as const

// Aspect ratio mapping for image generation
export const ASPECT_RATIOS = {
  '9:16': '9:16',
  '16:9': '16:9', 
  '1:1': '1:1',
} as const

export type AspectRatio = keyof typeof ASPECT_RATIOS

// Voice configuration for TTS
export const VOICE_CONFIG = {
  male: 'Kore',
  female: 'Puck', 
  natural: 'Kore', // Default to Kore
} as const

export type VoiceType = keyof typeof VOICE_CONFIG

// Error types for classification
export enum GeminiErrorType {
  INVALID_API_KEY = 'INVALID_API_KEY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED', 
  RATE_LIMIT = 'RATE_LIMIT',
  CONTENT_POLICY = 'CONTENT_POLICY',
  TIMEOUT = 'TIMEOUT',
  SERVICE_ERROR = 'SERVICE_ERROR',
  REGION_UNAVAILABLE = 'REGION_UNAVAILABLE',
}

export interface GeminiError extends Error {
  type: GeminiErrorType
  retryable: boolean
  retryAfter?: number
}

export interface TextGenerationOptions {
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
}

export interface ImageGenerationOptions {
  aspectRatio: AspectRatio
  numberOfImages?: number
  quality?: 'standard' | 'high'
}

export interface TTSOptions {
  voice: VoiceType
  speed?: number
  language?: string
}

export interface GeminiClientConfig {
  apiKey?: string // BYO API key (optional)
  userId?: string // For BYO key lookup
  region?: string // For regional availability
  timeout?: number // Request timeout in ms
}

/**
 * Gemini API Client with BYO key support and rate limiting
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI
  private config: GeminiClientConfig
  private rateLimiter: Map<string, number[]> = new Map()

  constructor(config: GeminiClientConfig = {}) {
    this.config = {
      timeout: 30000, // 30 second default timeout
      region: 'us-central1', // Default region
      ...config,
    }

    // Initialize with platform key or BYO key
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('Gemini API key is required')
    }

    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  /**
   * Create client instance with BYO API key support
   */
  static async createWithBYOKey(userId: string): Promise<GeminiClient> {
    try {
      // Try to get user's BYO API key first
      const byoKey = await UserService.getBYOApiKey(userId, 'gemini')
      
      return new GeminiClient({
        apiKey: byoKey || undefined,
        userId,
      })
    } catch (error) {
      // Fall back to platform key
      return new GeminiClient({ userId })
    }
  }

  /**
   * Check regional availability and connectivity
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODELS.TEXT })
      
      // Simple test request to check connectivity
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 1 },
      })

      return !!result.response.text()
    } catch (error) {
      console.error('Gemini availability check failed:', error)
      return false
    }
  }

  /**
   * Generate text using Gemini Text API
   */
  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    await this.checkRateLimit('TEXT')

    const model = this.genAI.getGenerativeModel({ 
      model: GEMINI_MODELS.TEXT,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        topP: options.topP ?? 0.8,
        topK: options.topK ?? 40,
      },
    })

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })

      const response = result.response
      const text = response.text()
      
      if (!text) {
        throw new Error('Empty response from Gemini Text API')
      }

      this.recordRequest('TEXT')
      return text
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Generate image using Gemini Image API
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions
  ): Promise<string> {
    await this.checkRateLimit('IMAGE')

    const model = this.genAI.getGenerativeModel({ 
      model: GEMINI_MODELS.IMAGE,
    })

    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Generate an image: ${prompt}. Aspect ratio: ${options.aspectRatio}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 4096,
        },
      })

      const response = result.response
      
      // Extract image data from response
      // Note: This is a simplified implementation
      // The actual implementation would need to handle the image data properly
      const candidates = response.candidates
      if (!candidates || candidates.length === 0) {
        throw new Error('No image generated')
      }

      // For now, return a placeholder URL
      // In a real implementation, this would extract and process the actual image data
      this.recordRequest('IMAGE')
      return 'data:image/placeholder' // Placeholder for actual image data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Generate speech using Gemini TTS
   */
  async generateSpeech(
    text: string,
    options: TTSOptions
  ): Promise<ArrayBuffer> {
    await this.checkRateLimit('TTS')

    const model = this.genAI.getGenerativeModel({ 
      model: GEMINI_MODELS.TTS,
    })

    try {
      // Note: This is a simplified implementation
      // The actual TTS implementation would use the proper TTS API
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Convert to speech with voice ${options.voice}: ${text}`
          }]
        }],
      })

      // Placeholder for actual audio data
      this.recordRequest('TTS')
      return new ArrayBuffer(0) // Placeholder
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(apiType: keyof typeof FREE_TIER_LIMITS): Promise<void> {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const limit = FREE_TIER_LIMITS[apiType].rpm

    const key = `${this.config.userId || 'platform'}_${apiType}`
    const requests = this.rateLimiter.get(key) || []
    
    // Remove requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs)
    
    if (validRequests.length >= limit) {
      const oldestRequest = Math.min(...validRequests)
      const waitTime = windowMs - (now - oldestRequest)
      
      const error = new Error(`Rate limit exceeded for ${apiType}. Try again in ${Math.ceil(waitTime / 1000)} seconds.`) as GeminiError
      error.type = GeminiErrorType.RATE_LIMIT
      error.retryable = true
      error.retryAfter = waitTime
      
      throw error
    }

    this.rateLimiter.set(key, validRequests)
  }

  /**
   * Record a successful request for rate limiting
   */
  private recordRequest(apiType: keyof typeof FREE_TIER_LIMITS): void {
    const key = `${this.config.userId || 'platform'}_${apiType}`
    const requests = this.rateLimiter.get(key) || []
    requests.push(Date.now())
    this.rateLimiter.set(key, requests)
  }

  /**
   * Handle and classify errors
   */
  private handleError(error: any): GeminiError {
    const geminiError = error as GeminiError
    
    // Classify error based on message/status - order matters for specificity
    if (error.message?.includes('API key')) {
      geminiError.type = GeminiErrorType.INVALID_API_KEY
      geminiError.retryable = false
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      geminiError.type = GeminiErrorType.RATE_LIMIT
      geminiError.retryable = true
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      geminiError.type = GeminiErrorType.QUOTA_EXCEEDED
      geminiError.retryable = true
    } else if (error.message?.includes('content') || error.message?.includes('policy')) {
      geminiError.type = GeminiErrorType.CONTENT_POLICY
      geminiError.retryable = false
    } else if (error.message?.includes('timeout')) {
      geminiError.type = GeminiErrorType.TIMEOUT
      geminiError.retryable = true
    } else if (error.message?.includes('region') || error.message?.includes('unavailable')) {
      geminiError.type = GeminiErrorType.REGION_UNAVAILABLE
      geminiError.retryable = true
    } else {
      geminiError.type = GeminiErrorType.SERVICE_ERROR
      geminiError.retryable = true
    }

    return geminiError
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(apiType: keyof typeof FREE_TIER_LIMITS): {
    remaining: number
    resetTime: number
  } {
    const now = Date.now()
    const windowMs = 60 * 1000
    const limit = FREE_TIER_LIMITS[apiType].rpm

    const key = `${this.config.userId || 'platform'}_${apiType}`
    const requests = this.rateLimiter.get(key) || []
    const validRequests = requests.filter(time => now - time < windowMs)

    const remaining = Math.max(0, limit - validRequests.length)
    const resetTime = validRequests.length > 0 
      ? Math.min(...validRequests) + windowMs 
      : now

    return { remaining, resetTime }
  }
}