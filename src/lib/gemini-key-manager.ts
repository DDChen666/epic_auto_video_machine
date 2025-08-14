import { UserService } from './user-service'
import { GeminiClient } from './gemini-client'

export interface ApiKeyValidationResult {
  valid: boolean
  error?: string
  quotaInfo?: {
    textQuota: number
    imageQuota: number
    ttsQuota: number
  }
  region?: string
}

/**
 * Manager for BYO Gemini API keys with validation and quota checking
 */
export class GeminiKeyManager {
  /**
   * Validate a Gemini API key by making a test request
   */
  static async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    try {
      const testClient = new GeminiClient({ apiKey })

      // Test connectivity with a minimal request
      const isAvailable = await testClient.checkAvailability()

      if (!isAvailable) {
        return {
          valid: false,
          error: 'API key is invalid or service is unavailable',
        }
      }

      // Get rate limit status to check quotas
      const textStatus = testClient.getRateLimitStatus('TEXT')
      const imageStatus = testClient.getRateLimitStatus('IMAGE')
      const ttsStatus = testClient.getRateLimitStatus('TTS')

      return {
        valid: true,
        quotaInfo: {
          textQuota: textStatus.remaining,
          imageQuota: imageStatus.remaining,
          ttsQuota: ttsStatus.remaining,
        },
        region: 'us-central1', // Default region
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Failed to validate API key',
      }
    }
  }

  /**
   * Set and validate BYO API key for a user
   */
  static async setBYOApiKey(
    userId: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First validate the key
      const validation = await this.validateApiKey(apiKey)

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid API key',
        }
      }

      // Store the validated key
      await UserService.setBYOApiKey(userId, 'gemini', apiKey)

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to set API key',
      }
    }
  }

  /**
   * Remove BYO API key for a user
   */
  static async removeBYOApiKey(userId: string): Promise<void> {
    await UserService.removeBYOApiKey(userId, 'gemini')
  }

  /**
   * Get BYO API key status for a user
   */
  static async getApiKeyStatus(userId: string): Promise<{
    hasBYOKey: boolean
    keyValid?: boolean
    quotaInfo?: {
      textQuota: number
      imageQuota: number
      ttsQuota: number
    }
    error?: string
  }> {
    try {
      const apiKey = await UserService.getBYOApiKey(userId, 'gemini')

      if (!apiKey) {
        return { hasBYOKey: false }
      }

      // Validate the stored key
      const validation = await this.validateApiKey(apiKey)

      return {
        hasBYOKey: true,
        keyValid: validation.valid,
        quotaInfo: validation.quotaInfo,
        error: validation.error,
      }
    } catch (error: any) {
      return {
        hasBYOKey: true,
        keyValid: false,
        error: error.message || 'Failed to check API key status',
      }
    }
  }

  /**
   * Create a Gemini client with user's BYO key or platform key
   */
  static async createClientForUser(userId: string): Promise<{
    client: GeminiClient
    usingBYOKey: boolean
  }> {
    try {
      const apiKey = await UserService.getBYOApiKey(userId, 'gemini')

      if (apiKey) {
        // Validate BYO key before using
        const validation = await this.validateApiKey(apiKey)

        if (validation.valid) {
          return {
            client: new GeminiClient({ apiKey, userId }),
            usingBYOKey: true,
          }
        } else {
          console.warn(
            `Invalid BYO key for user ${userId}, falling back to platform key`
          )
        }
      }

      // Fall back to platform key
      return {
        client: new GeminiClient({ userId }),
        usingBYOKey: false,
      }
    } catch (error) {
      console.error('Error creating Gemini client for user:', error)

      // Final fallback to platform key
      return {
        client: new GeminiClient({ userId }),
        usingBYOKey: false,
      }
    }
  }

  /**
   * Check if user has sufficient quota for an operation
   */
  static async checkQuotaForOperation(
    userId: string,
    operation: {
      textRequests?: number
      imageRequests?: number
      ttsRequests?: number
    }
  ): Promise<{
    sufficient: boolean
    details: {
      text: { required: number; available: number; sufficient: boolean }
      image: { required: number; available: number; sufficient: boolean }
      tts: { required: number; available: number; sufficient: boolean }
    }
  }> {
    const { client } = await this.createClientForUser(userId)

    const textStatus = client.getRateLimitStatus('TEXT')
    const imageStatus = client.getRateLimitStatus('IMAGE')
    const ttsStatus = client.getRateLimitStatus('TTS')

    const details = {
      text: {
        required: operation.textRequests || 0,
        available: textStatus.remaining,
        sufficient: (operation.textRequests || 0) <= textStatus.remaining,
      },
      image: {
        required: operation.imageRequests || 0,
        available: imageStatus.remaining,
        sufficient: (operation.imageRequests || 0) <= imageStatus.remaining,
      },
      tts: {
        required: operation.ttsRequests || 0,
        available: ttsStatus.remaining,
        sufficient: (operation.ttsRequests || 0) <= ttsStatus.remaining,
      },
    }

    const sufficient =
      details.text.sufficient &&
      details.image.sufficient &&
      details.tts.sufficient

    return { sufficient, details }
  }

  /**
   * Get regional availability for Gemini APIs
   */
  static async checkRegionalAvailability(): Promise<{
    regions: Array<{
      name: string
      available: boolean
      services: {
        text: boolean
        image: boolean
        tts: boolean
      }
    }>
  }> {
    // This would typically check multiple regions
    // For now, we'll return a static list based on known availability
    const regions = [
      {
        name: 'us-central1',
        available: true,
        services: { text: true, image: true, tts: true },
      },
      {
        name: 'us-east1',
        available: true,
        services: { text: true, image: true, tts: true },
      },
      {
        name: 'europe-west1',
        available: true,
        services: { text: true, image: false, tts: true }, // Image might not be available in all regions
      },
      {
        name: 'asia-southeast1',
        available: true,
        services: { text: true, image: false, tts: false },
      },
    ]

    // In a real implementation, we would test each region
    // For now, return the static list
    return { regions }
  }

  /**
   * Get cost estimation for BYO vs platform usage
   */
  static getCostComparison(operation: {
    textTokens: number
    imageGenerations: number
    ttsCharacters: number
  }): {
    platformCost: number
    byoCost: number
    savings: number
    currency: string
  } {
    // Platform pricing (with markup)
    const platformRates = {
      textPerToken: 0.000002, // $0.000002 per token (2x markup)
      imagePerGeneration: 0.08, // $0.08 per image (2x markup)
      ttsPerCharacter: 0.000016, // $0.000016 per character (2x markup)
    }

    // BYO pricing (direct Google rates)
    const byoRates = {
      textPerToken: 0.000001, // $0.000001 per token
      imagePerGeneration: 0.04, // $0.04 per image
      ttsPerCharacter: 0.000008, // $0.000008 per character
    }

    const platformCost =
      operation.textTokens * platformRates.textPerToken +
      operation.imageGenerations * platformRates.imagePerGeneration +
      operation.ttsCharacters * platformRates.ttsPerCharacter

    const byoCost =
      operation.textTokens * byoRates.textPerToken +
      operation.imageGenerations * byoRates.imagePerGeneration +
      operation.ttsCharacters * byoRates.ttsPerCharacter

    const savings = platformCost - byoCost

    return {
      platformCost: Math.round(platformCost * 100) / 100,
      byoCost: Math.round(byoCost * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      currency: 'USD',
    }
  }
}
