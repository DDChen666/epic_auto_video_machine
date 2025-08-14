import { GeminiClient } from './gemini-client'
import { withRetry, DEFAULT_RETRY_CONFIG } from './gemini-retry'
import type { ProjectConfig, SceneData } from '../types'

// Visual elements extraction interface
export interface VisualElements {
  subject: string[] // 主體：人物、物品、動物等
  environment: string[] // 環境：室內、戶外、場所等
  camera: string[] // 鏡頭：角度、距離、運動等
  lighting: string[] // 光影：時間、氣氛、光源等
  mood: string[] // 情緒：氛圍、感覺、色調等
}

// Prompt generation result
export interface PromptResult {
  sceneIndex: number
  originalText: string
  visualPrompt: string
  visualElements: VisualElements
  safetyStatus: 'safe' | 'filtered' | 'replaced'
  alternativePrompts?: string[]
  success: boolean
  error?: string
}

// Content safety filter result
export interface SafetyFilterResult {
  isSafe: boolean
  violations: string[]
  filteredPrompt?: string
  alternatives?: string[]
}

// Template-based prompt system
export interface PromptTemplate {
  name: string
  basePrompt: string
  styleModifiers: string[]
  safeWords: string[]
  avoidWords: string[]
}

/**
 * Prompt Generation Service
 * Implements requirements 4.1-4.5 for visual prompt generation
 */
export class PromptGenerationService {
  private client: GeminiClient
  private templates: Map<string, PromptTemplate>
  private blockedWords: Set<string>

  constructor(client: GeminiClient) {
    this.client = client
    this.templates = new Map()
    this.blockedWords = new Set()
    this.initializeTemplates()
    this.initializeBlockedWords()
  }

  /**
   * Create service instance with BYO key support
   */
  static async create(userId?: string): Promise<PromptGenerationService> {
    const client = userId
      ? await GeminiClient.createWithBYOKey(userId)
      : new GeminiClient()

    return new PromptGenerationService(client)
  }

  /**
   * Generate visual prompts for multiple scenes
   * Requirement 4.1: 使用 Gemini 為每個場景生成英文化的視覺提示詞
   */
  async generateScenePrompts(
    scenes: SceneData[],
    config: ProjectConfig
  ): Promise<PromptResult[]> {
    const results: PromptResult[] = []

    for (const scene of scenes) {
      try {
        const result = await this.generateSingleScenePrompt(scene, config)
        results.push(result)
      } catch (error) {
        results.push({
          sceneIndex: scene.index,
          originalText: scene.text,
          visualPrompt: this.getFallbackPrompt(scene.text, config),
          visualElements: this.extractBasicElements(scene.text),
          safetyStatus: 'safe',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * Generate single scene visual prompt with safety filtering
   * Requirement 4.2: 實作英文化和視覺要素提取（主體/環境/鏡頭/光影/情緒）
   * Requirement 4.5: 提示詞包含違規內容時自動過濾並提供替代方案
   */
  private async generateSingleScenePrompt(
    scene: SceneData,
    config: ProjectConfig
  ): Promise<PromptResult> {
    // Step 1: Extract visual elements from Chinese text
    const visualElements = await this.extractVisualElements(scene.text)

    // Step 2: Generate English visual prompt
    const rawPrompt = await this.generateEnglishPrompt(
      scene.text,
      visualElements,
      config
    )

    // Step 3: Apply safety filtering
    const safetyResult = await this.applySafetyFilter(rawPrompt, config.safety)

    // Step 4: Apply template-based enhancements
    const finalPrompt = this.applyTemplate(
      safetyResult.filteredPrompt || rawPrompt,
      config
    )

    return {
      sceneIndex: scene.index,
      originalText: scene.text,
      visualPrompt: finalPrompt,
      visualElements,
      safetyStatus: safetyResult.isSafe
        ? 'safe'
        : safetyResult.filteredPrompt
          ? 'filtered'
          : 'replaced',
      alternativePrompts: safetyResult.alternatives,
      success: true,
    }
  }

  /**
   * Extract visual elements from Chinese text
   * Requirement 4.2: 視覺要素提取（主體/環境/鏡頭/光影/情緒）
   */
  private async extractVisualElements(text: string): Promise<VisualElements> {
    const systemPrompt = `你是視覺要素分析專家。分析以下中文場景文字，提取視覺要素。

請以JSON格式回傳，包含以下類別：
- subject: 主體（人物、物品、動物等）
- environment: 環境（室內、戶外、場所等）
- camera: 鏡頭（角度、距離、運動等）
- lighting: 光影（時間、氣氛、光源等）
- mood: 情緒（氛圍、感覺、色調等）

場景文字：「${text}」

視覺要素分析：`

    try {
      const response = await withRetry(
        () =>
          this.client.generateText(systemPrompt, {
            temperature: 0.3,
            maxOutputTokens: 500,
          }),
        DEFAULT_RETRY_CONFIG
      )

      const parsed = JSON.parse(response.trim())
      return {
        subject: Array.isArray(parsed.subject) ? parsed.subject : [],
        environment: Array.isArray(parsed.environment)
          ? parsed.environment
          : [],
        camera: Array.isArray(parsed.camera) ? parsed.camera : [],
        lighting: Array.isArray(parsed.lighting) ? parsed.lighting : [],
        mood: Array.isArray(parsed.mood) ? parsed.mood : [],
      }
    } catch (error) {
      console.warn('Visual elements extraction failed, using fallback:', error)
      return this.extractBasicElements(text)
    }
  }

  /**
   * Generate English visual prompt from Chinese text and visual elements
   * Requirement 4.1: 生成英文化的視覺提示詞
   */
  private async generateEnglishPrompt(
    chineseText: string,
    visualElements: VisualElements,
    config: ProjectConfig
  ): Promise<string> {
    const aspectRatio = config.aspect_ratio
    const template = config.template.name

    const systemPrompt = `You are a professional visual prompt generator for AI image generation.

Convert this Chinese scene into a detailed English visual prompt suitable for ${aspectRatio} aspect ratio.

Visual Elements Extracted:
- Subjects: ${visualElements.subject.join(', ')}
- Environment: ${visualElements.environment.join(', ')}
- Camera: ${visualElements.camera.join(', ')}
- Lighting: ${visualElements.lighting.join(', ')}
- Mood: ${visualElements.mood.join(', ')}

Requirements:
- Aspect ratio: ${aspectRatio}
- Template style: ${template}
- Use professional photography/cinematography terms
- Focus on visual composition and aesthetics
- Avoid text, logos, or copyrighted content
- Keep concise but descriptive (max 200 characters)
- Ensure content is appropriate and safe

Chinese scene: "${chineseText}"

English visual prompt:`

    return await withRetry(
      () =>
        this.client.generateText(systemPrompt, {
          temperature: 0.7,
          maxOutputTokens: 200,
        }),
      DEFAULT_RETRY_CONFIG
    )
  }

  /**
   * Apply content safety filtering
   * Requirement 4.5: 自動過濾違規內容並提供替代方案
   */
  private async applySafetyFilter(
    prompt: string,
    safetyConfig: ProjectConfig['safety']
  ): Promise<SafetyFilterResult> {
    // Check for blocked words
    const violations: string[] = []
    const lowerPrompt = prompt.toLowerCase()

    // Check custom blocked words
    for (const blockedWord of safetyConfig.blocked_words) {
      if (lowerPrompt.includes(blockedWord.toLowerCase())) {
        violations.push(`Blocked word: ${blockedWord}`)
      }
    }

    // Check built-in blocked words
    Array.from(this.blockedWords).forEach(blockedWord => {
      if (lowerPrompt.includes(blockedWord)) {
        violations.push(`Inappropriate content: ${blockedWord}`)
      }
    })

    if (violations.length === 0) {
      return { isSafe: true, violations: [] }
    }

    // Generate filtered version and alternatives
    const filteredPrompt = await this.generateSafeAlternative(
      prompt,
      violations
    )
    const alternatives = await this.generateAlternativePrompts(prompt, 3)

    return {
      isSafe: false,
      violations,
      filteredPrompt,
      alternatives,
    }
  }

  /**
   * Generate safe alternative prompt
   */
  private async generateSafeAlternative(
    originalPrompt: string,
    violations: string[]
  ): Promise<string> {
    const systemPrompt = `You are a content safety expert. Rewrite this visual prompt to remove inappropriate content while maintaining the visual intent.

Original prompt: "${originalPrompt}"
Violations found: ${violations.join(', ')}

Requirements:
- Remove all inappropriate content
- Maintain visual composition and style
- Keep the same artistic intent
- Use safe, professional language
- Maximum 200 characters

Safe alternative prompt:`

    try {
      return await withRetry(
        () =>
          this.client.generateText(systemPrompt, {
            temperature: 0.5,
            maxOutputTokens: 200,
          }),
        DEFAULT_RETRY_CONFIG
      )
    } catch (error) {
      // Fallback to basic safe prompt
      return 'professional cinematic scene, high quality, appropriate content'
    }
  }

  /**
   * Generate multiple alternative prompts
   */
  private async generateAlternativePrompts(
    originalPrompt: string,
    count: number
  ): Promise<string[]> {
    const systemPrompt = `Generate ${count} alternative visual prompts based on this original prompt. Each should have the same visual intent but different wording.

Original: "${originalPrompt}"

Alternative prompts (one per line):`

    try {
      const response = await withRetry(
        () =>
          this.client.generateText(systemPrompt, {
            temperature: 0.8,
            maxOutputTokens: 300,
          }),
        DEFAULT_RETRY_CONFIG
      )

      return response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, count)
    } catch (error) {
      return []
    }
  }

  /**
   * Apply template-based prompt enhancement
   * Requirement 4.4: 建立模板化提示詞系統避免違規詞
   */
  private applyTemplate(prompt: string, config: ProjectConfig): string {
    const templateName = config.template.name
    const template = this.templates.get(templateName)

    if (!template) {
      return prompt
    }

    // Apply template base prompt and style modifiers
    const enhancedPrompt = `${prompt}, ${template.basePrompt}, ${template.styleModifiers.join(', ')}`

    // Ensure safe words are included
    const safeWordsToAdd = template.safeWords.filter(
      word => !enhancedPrompt.toLowerCase().includes(word.toLowerCase())
    )

    if (safeWordsToAdd.length > 0) {
      return `${enhancedPrompt}, ${safeWordsToAdd.join(', ')}`
    }

    return enhancedPrompt
  }

  /**
   * Get preview summary of prompt
   * Requirement 4.2: 顯示每個場景的提示詞預覽（一行摘要）
   */
  generatePromptPreview(prompt: string): string {
    // Extract key visual elements for preview
    const words = prompt.split(/[,\s]+/)
    const keyWords = words
      .filter(word => word.length > 3)
      .filter(
        word =>
          !['with', 'and', 'the', 'for', 'are', 'was', 'were'].includes(
            word.toLowerCase()
          )
      )
      .slice(0, 5)

    return keyWords.join(' • ')
  }

  /**
   * Validate and edit prompt
   * Requirement 4.4: 允許編輯個別場景的提示詞
   */
  async validateAndEditPrompt(
    originalPrompt: string,
    editedPrompt: string,
    config: ProjectConfig
  ): Promise<{
    isValid: boolean
    safetyResult: SafetyFilterResult
    suggestions?: string[]
  }> {
    // Apply safety filtering to edited prompt
    const safetyResult = await this.applySafetyFilter(
      editedPrompt,
      config.safety
    )

    // Generate suggestions if needed
    let suggestions: string[] = []
    if (!safetyResult.isSafe) {
      suggestions = await this.generateAlternativePrompts(originalPrompt, 3)
    }

    return {
      isValid: safetyResult.isSafe,
      safetyResult,
      suggestions,
    }
  }

  /**
   * Initialize prompt templates
   */
  private initializeTemplates(): void {
    // Classic Clean template
    this.templates.set('classic', {
      name: 'classic',
      basePrompt: 'clean composition, soft lighting, professional photography',
      styleModifiers: ['minimal', 'elegant', 'high quality', 'sharp focus'],
      safeWords: ['professional', 'clean', 'appropriate'],
      avoidWords: ['dark', 'violent', 'explicit'],
    })

    // Dark Glass template
    this.templates.set('dark', {
      name: 'dark',
      basePrompt: 'dark aesthetic, glass morphism, moody atmosphere',
      styleModifiers: ['cinematic', 'dramatic lighting', 'modern', 'sleek'],
      safeWords: ['artistic', 'professional', 'tasteful'],
      avoidWords: ['violent', 'disturbing', 'explicit'],
    })

    // Vivid Gradient template
    this.templates.set('vivid', {
      name: 'vivid',
      basePrompt: 'vibrant colors, gradient backgrounds, energetic mood',
      styleModifiers: ['colorful', 'dynamic', 'bright', 'cheerful'],
      safeWords: ['positive', 'uplifting', 'family-friendly'],
      avoidWords: ['dark', 'violent', 'inappropriate'],
    })
  }

  /**
   * Initialize blocked words list
   */
  private initializeBlockedWords(): void {
    const blockedWords = [
      // Violence and weapons
      'violence',
      'weapon',
      'gun',
      'knife',
      'blood',
      'death',
      'kill',
      // Adult content
      'nude',
      'naked',
      'sexual',
      'explicit',
      'adult',
      // Hate speech
      'hate',
      'discrimination',
      'racist',
      'offensive',
      // Copyrighted content
      'disney',
      'marvel',
      'pokemon',
      'nintendo',
      'sony',
      // Inappropriate content
      'disturbing',
      'scary',
      'horror',
      'nightmare',
    ]

    this.blockedWords = new Set(blockedWords)
  }

  /**
   * Basic visual elements extraction fallback
   */
  private extractBasicElements(text: string): VisualElements {
    const words = text.toLowerCase().split(/\s+/)

    // Simple keyword matching for fallback
    const subjectKeywords = ['人', '男', '女', '孩', '老', '動物', '貓', '狗']
    const environmentKeywords = ['室內', '戶外', '家', '公園', '街道', '辦公室']
    const lightingKeywords = ['陽光', '夜晚', '燈光', '明亮', '昏暗']
    const moodKeywords = ['快樂', '悲傷', '平靜', '緊張', '溫暖', '冷']

    return {
      subject: subjectKeywords.filter(keyword => text.includes(keyword)),
      environment: environmentKeywords.filter(keyword =>
        text.includes(keyword)
      ),
      camera: ['medium shot'], // default
      lighting: lightingKeywords.filter(keyword => text.includes(keyword)),
      mood: moodKeywords.filter(keyword => text.includes(keyword)),
    }
  }

  /**
   * Fallback prompt generation
   */
  private getFallbackPrompt(text: string, config: ProjectConfig): string {
    const template = this.templates.get(config.template.name)
    const basePrompt = template?.basePrompt || 'professional photography'

    // Extract key nouns for basic visual prompt
    const words = text.split(/\s+/)
    const visualWords = words
      .filter(word => word.length > 1)
      .slice(0, 3)
      .join(' ')

    return `${visualWords}, ${basePrompt}, high quality, appropriate content`
  }
}
