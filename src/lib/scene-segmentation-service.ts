import { GeminiClient } from './gemini-client'
import type { SceneData, AuthContext } from '@/types'

// Scene segmentation configuration
export interface SegmentationConfig {
  min_length: number // Minimum characters per scene
  max_length: number // Maximum characters per scene
  use_llm: boolean // Whether to use LLM for semantic segmentation
  preserve_paragraphs: boolean // Try to keep paragraphs intact
  smart_split: boolean // Use punctuation and natural breaks
}

export interface SegmentationOptions {
  config?: Partial<SegmentationConfig>
  user_id?: string // For BYO API key support
}

export interface SegmentationResult {
  scenes: SceneData[]
  metadata: {
    original_length: number
    scene_count: number
    average_scene_length: number
    segmentation_method: 'rule_based' | 'llm_assisted'
    processing_time: number
  }
}

export interface SceneEditOperation {
  type: 'merge' | 'split' | 'reorder' | 'update'
  scene_ids: string[]
  new_text?: string
  new_index?: number
  split_position?: number
}

// Default configuration following requirements (100-280 characters)
const DEFAULT_CONFIG: SegmentationConfig = {
  min_length: 100,
  max_length: 280,
  use_llm: false,
  preserve_paragraphs: true,
  smart_split: true,
}

/**
 * Scene Segmentation Service
 * Handles text segmentation into scenes with rule-based and LLM-assisted methods
 */
export class SceneSegmentationService {
  private geminiClient?: GeminiClient
  private config: SegmentationConfig

  constructor(
    authContext?: AuthContext,
    config: Partial<SegmentationConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // Initialize Gemini client if LLM segmentation is enabled
    if (this.config.use_llm && authContext) {
      this.initializeGeminiClient(authContext.userId)
    }
  }

  /**
   * Initialize Gemini client with BYO key support
   */
  private async initializeGeminiClient(userId: string): Promise<void> {
    try {
      this.geminiClient = await GeminiClient.createWithBYOKey(userId)
    } catch (error) {
      console.warn('Failed to initialize Gemini client, falling back to rule-based segmentation:', error)
      this.config.use_llm = false
    }
  }

  /**
   * Segment text into scenes
   */
  async segmentText(
    text: string,
    options: SegmentationOptions = {}
  ): Promise<SegmentationResult> {
    const startTime = Date.now()
    
    // Merge configuration
    const config = { ...this.config, ...options.config }
    
    // Initialize Gemini client if needed and not already initialized
    if (config.use_llm && !this.geminiClient && options.user_id) {
      await this.initializeGeminiClient(options.user_id)
    }

    // Normalize Chinese text
    const normalizedText = this.normalizeChineseText(text)
    
    let scenes: SceneData[]
    let method: 'rule_based' | 'llm_assisted'

    if (config.use_llm && this.geminiClient) {
      try {
        scenes = await this.llmAssistedSegmentation(normalizedText, config)
        method = 'llm_assisted'
      } catch (error) {
        console.warn('LLM segmentation failed, falling back to rule-based:', error)
        scenes = this.ruleBasedSegmentation(normalizedText, config)
        method = 'rule_based'
      }
    } else {
      scenes = this.ruleBasedSegmentation(normalizedText, config)
      method = 'rule_based'
    }

    const processingTime = Math.max(1, Date.now() - startTime)

    return {
      scenes,
      metadata: {
        original_length: text.length,
        scene_count: scenes.length,
        average_scene_length: Math.round(
          scenes.reduce((sum, scene) => sum + scene.text.length, 0) / scenes.length
        ),
        segmentation_method: method,
        processing_time: processingTime,
      },
    }
  }

  /**
   * Rule-based segmentation algorithm
   */
  private ruleBasedSegmentation(
    text: string,
    config: SegmentationConfig
  ): SceneData[] {
    const scenes: SceneData[] = []
    
    // Split by paragraphs first if preserve_paragraphs is enabled
    const paragraphs = config.preserve_paragraphs 
      ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      : [text]

    let sceneIndex = 0

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim()
      if (trimmedParagraph.length === 0) continue
      
      const paragraphScenes = this.segmentParagraph(trimmedParagraph, config)
      
      for (const sceneText of paragraphScenes) {
        const trimmedSceneText = sceneText.trim()
        if (trimmedSceneText.length > 0) {
          scenes.push({
            id: `scene_${sceneIndex}`,
            index: sceneIndex,
            text: trimmedSceneText,
          })
          sceneIndex++
        }
      }
    }

    // If no scenes were created (e.g., text too short), create one scene
    if (scenes.length === 0 && text.trim().length > 0) {
      scenes.push({
        id: 'scene_0',
        index: 0,
        text: text.trim(),
      })
    }

    return scenes
  }

  /**
   * Segment a single paragraph into scenes
   */
  private segmentParagraph(
    paragraph: string,
    config: SegmentationConfig
  ): string[] {
    // If paragraph is short enough, return as single scene
    if (paragraph.length <= config.max_length) {
      return [paragraph]
    }

    const scenes: string[] = []
    let currentScene = ''
    
    // Split by sentences using Chinese punctuation
    const sentences = this.splitIntoSentences(paragraph)
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) continue
      
      const potentialScene = currentScene + (currentScene ? ' ' : '') + trimmedSentence
      
      if (potentialScene.length <= config.max_length) {
        currentScene = potentialScene
      } else {
        // Current scene would be too long
        if (currentScene.length >= config.min_length) {
          // Current scene is long enough, save it and start new one
          scenes.push(currentScene)
          currentScene = trimmedSentence
        } else if (trimmedSentence.length > config.max_length) {
          // Sentence itself is too long, need to split it
          const splitSentence = this.splitLongSentence(trimmedSentence, config.max_length)
          if (currentScene) {
            scenes.push(currentScene + ' ' + splitSentence[0])
          } else {
            scenes.push(splitSentence[0])
          }
          
          // Add remaining parts as separate scenes
          for (let i = 1; i < splitSentence.length; i++) {
            scenes.push(splitSentence[i])
          }
          currentScene = ''
        } else {
          // Force the scene even if it's shorter than min_length
          currentScene = potentialScene
        }
      }
    }
    
    // Add the last scene if it exists
    if (currentScene.trim().length > 0) {
      scenes.push(currentScene)
    }

    // If no scenes were created, return the original paragraph
    if (scenes.length === 0) {
      return [paragraph]
    }

    return scenes
  }

  /**
   * Split text into sentences using Chinese punctuation
   */
  private splitIntoSentences(text: string): string[] {
    // Chinese sentence endings: 。！？；
    const sentencePattern = /([^。！？；]*[。！？；])/g
    const sentences = text.match(sentencePattern) || []
    
    // Handle remaining text that doesn't end with punctuation
    const lastIndex = sentences.join('').length
    if (lastIndex < text.length) {
      sentences.push(text.substring(lastIndex))
    }
    
    return sentences.filter(s => s.trim().length > 0)
  }

  /**
   * Split a long sentence into smaller parts
   */
  private splitLongSentence(sentence: string, maxLength: number): string[] {
    const parts: string[] = []
    
    // Try to split by commas first
    const commaParts = sentence.split(/[，,]/)
    let currentPart = ''
    
    for (const part of commaParts) {
      const potentialPart = currentPart + (currentPart ? '，' : '') + part
      
      if (potentialPart.length <= maxLength) {
        currentPart = potentialPart
      } else {
        if (currentPart) {
          parts.push(currentPart)
        }
        
        // If single part is still too long, split by length
        if (part.length > maxLength) {
          const lengthParts = this.splitByLength(part, maxLength)
          parts.push(...lengthParts)
          currentPart = ''
        } else {
          currentPart = part
        }
      }
    }
    
    if (currentPart) {
      parts.push(currentPart)
    }
    
    return parts
  }

  /**
   * Split text by length while trying to preserve word boundaries
   */
  private splitByLength(text: string, maxLength: number): string[] {
    const parts: string[] = []
    let currentPos = 0
    
    while (currentPos < text.length) {
      let endPos = Math.min(currentPos + maxLength, text.length)
      
      // Try to find a good break point (space, punctuation)
      if (endPos < text.length) {
        const breakChars = /[\s，。！？；、]/
        for (let i = endPos; i > currentPos + maxLength * 0.8; i--) {
          if (breakChars.test(text[i])) {
            endPos = i + 1
            break
          }
        }
      }
      
      parts.push(text.substring(currentPos, endPos).trim())
      currentPos = endPos
    }
    
    return parts.filter(part => part.length > 0)
  }

  /**
   * LLM-assisted segmentation using Gemini
   */
  private async llmAssistedSegmentation(
    text: string,
    config: SegmentationConfig
  ): Promise<SceneData[]> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized')
    }

    const prompt = this.buildSegmentationPrompt(text, config)
    
    try {
      const response = await this.geminiClient.generateText(prompt, {
        temperature: 0.3, // Lower temperature for more consistent results
        maxOutputTokens: 4096,
      })

      return this.parseSegmentationResponse(response)
    } catch (error) {
      console.error('LLM segmentation failed:', error)
      throw error
    }
  }

  /**
   * Build prompt for LLM segmentation
   */
  private buildSegmentationPrompt(
    text: string,
    config: SegmentationConfig
  ): string {
    return `請將以下文字切分成適合製作短影片的場景。每個場景應該：

1. 長度在 ${config.min_length}-${config.max_length} 個字元之間
2. 保持語義完整性和連貫性
3. 適合單一視覺畫面表現
4. 在自然的語言斷點處分割

請以 JSON 格式回應，包含場景陣列，每個場景有 index 和 text 欄位。

文字內容：
${text}

回應格式：
{
  "scenes": [
    {"index": 0, "text": "第一個場景的文字內容"},
    {"index": 1, "text": "第二個場景的文字內容"}
  ]
}`
  }

  /**
   * Parse LLM segmentation response
   */
  private parseSegmentationResponse(response: string): SceneData[] {
    try {
      // Clean up response - remove markdown code blocks if present
      const cleanResponse = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()

      const parsed = JSON.parse(cleanResponse)
      
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        throw new Error('Invalid response format: missing scenes array')
      }

      return parsed.scenes.map((scene: any, index: number) => ({
        id: `scene_${index}`,
        index: scene.index ?? index,
        text: scene.text?.trim() || '',
      })).filter((scene: SceneData) => scene.text.length > 0)
    } catch (error) {
      console.error('Failed to parse LLM segmentation response:', error)
      throw new Error('Failed to parse segmentation response')
    }
  }

  /**
   * Normalize Chinese text (full-width/half-width, punctuation)
   */
  private normalizeChineseText(text: string): string {
    return text
      // Convert full-width numbers and letters to half-width
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/[Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      
      // Normalize punctuation
      .replace(/，/g, '，') // Ensure Chinese comma
      .replace(/。/g, '。') // Ensure Chinese period
      .replace(/！/g, '！') // Ensure Chinese exclamation
      .replace(/？/g, '？') // Ensure Chinese question mark
      .replace(/；/g, '；') // Ensure Chinese semicolon
      .replace(/：/g, '：') // Ensure Chinese colon
      
      // Normalize quotes
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  }

  /**
   * Edit scenes (merge, split, reorder, update)
   */
  async editScenes(
    scenes: SceneData[],
    operation: SceneEditOperation
  ): Promise<SceneData[]> {
    const updatedScenes = [...scenes]

    switch (operation.type) {
      case 'merge':
        return this.mergeScenes(updatedScenes, operation.scene_ids)
      
      case 'split':
        return this.splitScene(
          updatedScenes,
          operation.scene_ids[0],
          operation.split_position || 0
        )
      
      case 'reorder':
        return this.reorderScenes(
          updatedScenes,
          operation.scene_ids[0],
          operation.new_index || 0
        )
      
      case 'update':
        return this.updateScene(
          updatedScenes,
          operation.scene_ids[0],
          operation.new_text || ''
        )
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`)
    }
  }

  /**
   * Merge multiple scenes into one
   */
  private mergeScenes(scenes: SceneData[], sceneIds: string[]): SceneData[] {
    if (sceneIds.length < 2) {
      throw new Error('At least 2 scenes required for merge operation')
    }

    // Find scenes to merge
    const scenesToMerge = scenes.filter(scene => sceneIds.includes(scene.id))
    if (scenesToMerge.length !== sceneIds.length) {
      throw new Error('Some scenes not found')
    }

    // Sort by index
    scenesToMerge.sort((a, b) => a.index - b.index)
    
    // Create merged scene
    const mergedText = scenesToMerge.map(scene => scene.text).join(' ')
    const firstScene = scenesToMerge[0]
    
    // Create new scenes array with merged scene in correct position
    const result: SceneData[] = []
    let mergedSceneAdded = false
    
    for (const scene of scenes) {
      if (sceneIds.includes(scene.id)) {
        // Skip scenes that are being merged, but add merged scene at first occurrence
        if (!mergedSceneAdded) {
          result.push({
            id: `merged_${Date.now()}`,
            index: firstScene.index,
            text: mergedText,
          })
          mergedSceneAdded = true
        }
      } else {
        result.push(scene)
      }
    }

    // Reindex scenes
    return this.reindexScenes(result)
  }

  /**
   * Split a scene into two at the specified position
   */
  private splitScene(
    scenes: SceneData[],
    sceneId: string,
    splitPosition: number
  ): SceneData[] {
    const sceneIndex = scenes.findIndex(scene => scene.id === sceneId)
    if (sceneIndex === -1) {
      throw new Error('Scene not found')
    }

    const scene = scenes[sceneIndex]
    if (splitPosition <= 0 || splitPosition >= scene.text.length) {
      throw new Error('Invalid split position')
    }

    // Split the text
    const firstPart = scene.text.substring(0, splitPosition).trim()
    const secondPart = scene.text.substring(splitPosition).trim()

    if (!firstPart || !secondPart) {
      throw new Error('Split would result in empty scene')
    }

    // Replace original scene with two new scenes
    const updatedScenes = [...scenes]
    updatedScenes[sceneIndex] = {
      id: `${scene.id}_part1`,
      index: scene.index,
      text: firstPart,
    }

    updatedScenes.splice(sceneIndex + 1, 0, {
      id: `${scene.id}_part2`,
      index: scene.index + 1,
      text: secondPart,
    })

    return this.reindexScenes(updatedScenes)
  }

  /**
   * Reorder a scene to a new position
   */
  private reorderScenes(
    scenes: SceneData[],
    sceneId: string,
    newIndex: number
  ): SceneData[] {
    const sceneIndex = scenes.findIndex(scene => scene.id === sceneId)
    if (sceneIndex === -1) {
      throw new Error('Scene not found')
    }

    if (newIndex < 0 || newIndex >= scenes.length) {
      throw new Error('Invalid new index')
    }

    // Move scene to new position
    const updatedScenes = [...scenes]
    const [movedScene] = updatedScenes.splice(sceneIndex, 1)
    updatedScenes.splice(newIndex, 0, movedScene)

    return this.reindexScenes(updatedScenes)
  }

  /**
   * Update scene text
   */
  private updateScene(
    scenes: SceneData[],
    sceneId: string,
    newText: string
  ): SceneData[] {
    const sceneIndex = scenes.findIndex(scene => scene.id === sceneId)
    if (sceneIndex === -1) {
      throw new Error('Scene not found')
    }

    const updatedScenes = [...scenes]
    updatedScenes[sceneIndex] = {
      ...updatedScenes[sceneIndex],
      text: newText.trim(),
    }

    return updatedScenes
  }

  /**
   * Reindex scenes to ensure sequential indices
   */
  private reindexScenes(scenes: SceneData[]): SceneData[] {
    return scenes.map((scene, index) => ({
      ...scene,
      index,
    }))
  }

  /**
   * Validate scenes meet length requirements
   */
  validateScenes(scenes: SceneData[], config?: Partial<SegmentationConfig>): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const validationConfig = { ...this.config, ...config }
    const errors: string[] = []
    const warnings: string[] = []

    for (const scene of scenes) {
      if (scene.text.length < validationConfig.min_length) {
        warnings.push(`Scene ${scene.index} is too short (${scene.text.length} < ${validationConfig.min_length})`)
      }
      
      if (scene.text.length > validationConfig.max_length) {
        errors.push(`Scene ${scene.index} is too long (${scene.text.length} > ${validationConfig.max_length})`)
      }
      
      if (!scene.text.trim()) {
        errors.push(`Scene ${scene.index} is empty`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}