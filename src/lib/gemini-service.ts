import {
  GeminiClient,
  AspectRatio,
  VoiceType,
  TextGenerationOptions,
  ImageGenerationOptions,
  TTSOptions,
  GeminiError,
  GeminiErrorType,
} from './gemini-client'
import {
  withRetry,
  withRetryAndFallback,
  ConcurrencyController,
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG,
} from './gemini-retry'

export interface ScenePromptResult {
  sceneIndex: number
  originalText: string
  visualPrompt: string
  success: boolean
  error?: string
}

export interface ImageGenerationResult {
  sceneIndex: number
  imageUrl: string
  prompt: string
  success: boolean
  error?: string
}

export interface TTSResult {
  sceneIndex: number
  audioBuffer: ArrayBuffer
  text: string
  duration: number
  success: boolean
  error?: string
}

/**
 * High-level Gemini service with retry, fallback, and concurrency control
 */
export class GeminiService {
  private client: GeminiClient
  private concurrencyController: ConcurrencyController
  private circuitBreaker: CircuitBreaker

  constructor(client: GeminiClient) {
    this.client = client
    this.concurrencyController = new ConcurrencyController(3) // Max 3 concurrent requests
    this.circuitBreaker = new CircuitBreaker(5, 60000) // 5 failures, 1 minute recovery
  }

  /**
   * Create service instance with BYO key support
   */
  static async create(userId?: string): Promise<GeminiService> {
    const client = userId
      ? await GeminiClient.createWithBYOKey(userId)
      : new GeminiClient()

    return new GeminiService(client)
  }

  /**
   * Generate visual prompts for multiple scenes
   */
  async generateScenePrompts(
    scenes: Array<{ index: number; text: string }>,
    options: {
      aspectRatio: AspectRatio
      style?: string
    } = { aspectRatio: '9:16' }
  ): Promise<ScenePromptResult[]> {
    const results: ScenePromptResult[] = []

    // Process scenes with concurrency control
    const promises = scenes.map(scene =>
      this.concurrencyController.execute(async () => {
        try {
          const prompt = await this.generateSingleScenePrompt(
            scene.text,
            options
          )
          return {
            sceneIndex: scene.index,
            originalText: scene.text,
            visualPrompt: prompt,
            success: true,
          }
        } catch (error) {
          const geminiError = error as GeminiError
          return {
            sceneIndex: scene.index,
            originalText: scene.text,
            visualPrompt: this.getFallbackPrompt(scene.text),
            success: false,
            error: geminiError.message,
          }
        }
      })
    )

    const sceneResults = await Promise.all(promises)
    results.push(...sceneResults)

    return results.sort((a, b) => a.sceneIndex - b.sceneIndex)
  }

  /**
   * Generate single scene visual prompt
   */
  private async generateSingleScenePrompt(
    sceneText: string,
    options: { aspectRatio: AspectRatio; style?: string }
  ): Promise<string> {
    const systemPrompt = `You are a visual prompt generator for AI image generation. 
Convert the following scene text into a detailed English visual prompt suitable for image generation.

Requirements:
- Aspect ratio: ${options.aspectRatio}
- Style: ${options.style || 'cinematic, professional'}
- Focus on visual elements: subjects, environment, lighting, mood, camera angle
- Avoid text, logos, or copyrighted content
- Keep it concise but descriptive (max 200 characters)
- Use photography/cinematography terms

Scene text: "${sceneText}"

Generate visual prompt:`

    return await withRetryAndFallback(
      () =>
        this.circuitBreaker.execute(() =>
          this.client.generateText(systemPrompt, {
            temperature: 0.7,
            maxOutputTokens: 200,
          })
        ),
      () => Promise.resolve(this.getFallbackPrompt(sceneText)),
      DEFAULT_RETRY_CONFIG
    )
  }

  /**
   * Generate images for multiple scenes
   */
  async generateSceneImages(
    prompts: Array<{ index: number; prompt: string }>,
    options: ImageGenerationOptions
  ): Promise<ImageGenerationResult[]> {
    const results: ImageGenerationResult[] = []

    const promises = prompts.map(({ index, prompt }) =>
      this.concurrencyController.execute(async () => {
        try {
          const imageUrl = await withRetryAndFallback(
            () =>
              this.circuitBreaker.execute(() =>
                this.client.generateImage(prompt, options)
              ),
            () =>
              Promise.resolve(this.getFallbackImageUrl(options.aspectRatio)),
            DEFAULT_RETRY_CONFIG
          )

          return {
            sceneIndex: index,
            imageUrl,
            prompt,
            success: true,
          }
        } catch (error) {
          const geminiError = error as GeminiError
          return {
            sceneIndex: index,
            imageUrl: this.getFallbackImageUrl(options.aspectRatio),
            prompt,
            success: false,
            error: geminiError.message,
          }
        }
      })
    )

    const imageResults = await Promise.all(promises)
    results.push(...imageResults)

    return results.sort((a, b) => a.sceneIndex - b.sceneIndex)
  }

  /**
   * Generate TTS audio for multiple scenes
   */
  async generateSceneTTS(
    texts: Array<{ index: number; text: string }>,
    options: TTSOptions
  ): Promise<TTSResult[]> {
    const results: TTSResult[] = []

    const promises = texts.map(({ index, text }) =>
      this.concurrencyController.execute(async () => {
        try {
          const audioBuffer = await withRetryAndFallback(
            () =>
              this.circuitBreaker.execute(() =>
                this.client.generateSpeech(text, options)
              ),
            () => Promise.resolve(new ArrayBuffer(0)), // Empty audio as fallback
            DEFAULT_RETRY_CONFIG
          )

          // Estimate duration (rough calculation: ~150 words per minute)
          const wordCount = text.split(' ').length
          const estimatedDuration = (wordCount / 150) * 60 // seconds

          return {
            sceneIndex: index,
            audioBuffer,
            text,
            duration: estimatedDuration,
            success: true,
          }
        } catch (error) {
          const geminiError = error as GeminiError
          return {
            sceneIndex: index,
            audioBuffer: new ArrayBuffer(0),
            text,
            duration: 0,
            success: false,
            error: geminiError.message,
          }
        }
      })
    )

    const ttsResults = await Promise.all(promises)
    results.push(...ttsResults)

    return results.sort((a, b) => a.sceneIndex - b.sceneIndex)
  }

  /**
   * Segment text into scenes using LLM
   */
  async segmentTextIntoScenes(
    text: string,
    options: {
      targetSceneLength?: number
      maxScenes?: number
    } = {}
  ): Promise<
    Array<{ index: number; text: string; startChar: number; endChar: number }>
  > {
    const { targetSceneLength = 200, maxScenes = 50 } = options

    const systemPrompt = `You are a text segmentation expert. Segment the following text into scenes for video generation.

Requirements:
- Each scene should be ${targetSceneLength}±80 characters
- Maximum ${maxScenes} scenes
- Maintain narrative flow and logical breaks
- Each scene should be visually distinct
- Return as JSON array with format: [{"index": 1, "text": "scene text", "startChar": 0, "endChar": 150}]

Text to segment:
"${text}"

Segmented scenes:`

    try {
      const response = await withRetry(
        () =>
          this.circuitBreaker.execute(() =>
            this.client.generateText(systemPrompt, {
              temperature: 0.3,
              maxOutputTokens: 4000,
            })
          ),
        DEFAULT_RETRY_CONFIG
      )

      // Parse JSON response
      const scenes = JSON.parse(response.trim())
      return Array.isArray(scenes)
        ? scenes
        : this.fallbackSegmentation(text, targetSceneLength)
    } catch (error) {
      console.warn('LLM segmentation failed, using rule-based fallback:', error)
      return this.fallbackSegmentation(text, targetSceneLength)
    }
  }

  /**
   * Check service health and availability
   */
  async healthCheck(): Promise<{
    available: boolean
    rateLimits: Record<string, { remaining: number; resetTime: number }>
    circuitBreakerState: { state: string; failures: number }
    concurrencyStatus: { active: number; queued: number }
  }> {
    const available = await this.client.checkAvailability()

    const rateLimits = {
      text: this.client.getRateLimitStatus('TEXT'),
      image: this.client.getRateLimitStatus('IMAGE'),
      tts: this.client.getRateLimitStatus('TTS'),
    }

    return {
      available,
      rateLimits,
      circuitBreakerState: this.circuitBreaker.getState(),
      concurrencyStatus: this.concurrencyController.getStatus(),
    }
  }

  /**
   * Fallback prompt generation for failed cases
   */
  private getFallbackPrompt(sceneText: string): string {
    // Extract key nouns and adjectives for basic visual prompt
    const words = sceneText.toLowerCase().split(/\s+/)
    const visualWords = words.filter(
      word =>
        word.length > 3 &&
        ![
          'the',
          'and',
          'but',
          'for',
          'are',
          'was',
          'were',
          'been',
          'have',
          'has',
          'had',
        ].includes(word)
    )

    const prompt = visualWords.slice(0, 5).join(' ')
    return `cinematic scene with ${prompt}, professional lighting, high quality`
  }

  /**
   * Fallback image URL for failed generations
   */
  private getFallbackImageUrl(aspectRatio: AspectRatio): string {
    const dimensions = {
      '9:16': '1080x1920',
      '16:9': '1920x1080',
      '1:1': '1080x1080',
    }

    // Return a placeholder image service URL
    return `https://via.placeholder.com/${dimensions[aspectRatio]}/7C3AED/FFFFFF?text=Scene+Image`
  }

  /**
   * Rule-based text segmentation fallback
   */
  private fallbackSegmentation(
    text: string,
    targetLength: number
  ): Array<{
    index: number
    text: string
    startChar: number
    endChar: number
  }> {
    const scenes: Array<{
      index: number
      text: string
      startChar: number
      endChar: number
    }> = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    let currentScene = ''
    let sceneStartChar = 0
    let currentChar = 0
    let sceneIndex = 1

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) continue

      const sentenceWithPunctuation = trimmedSentence + '.'

      if (
        currentScene.length + sentenceWithPunctuation.length > targetLength &&
        currentScene.length > 0
      ) {
        // Finish current scene
        scenes.push({
          index: sceneIndex++,
          text: currentScene.trim(),
          startChar: sceneStartChar,
          endChar: currentChar,
        })

        // Start new scene
        currentScene = sentenceWithPunctuation + ' '
        sceneStartChar = currentChar
      } else {
        currentScene += sentenceWithPunctuation + ' '
      }

      currentChar += sentenceWithPunctuation.length + 1
    }

    // Add final scene if any content remains
    if (currentScene.trim().length > 0) {
      scenes.push({
        index: sceneIndex,
        text: currentScene.trim(),
        startChar: sceneStartChar,
        endChar: currentChar,
      })
    }

    return scenes
  }
}
