import { z } from 'zod'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { StorageService } from './storage-service'

// Types for file processing
interface ParsedContent {
  text: string
  word_count: number
}

interface SceneSegment {
  id?: string
  index: number
  text: string
  prompt?: string
}

interface SegmentOptions {
  auto_segment: boolean
  use_llm_segment: boolean
}

/**
 * Service for handling file uploads, parsing, and text processing
 */
export class FileUploadService {
  private readonly MIN_SCENE_LENGTH = 100 // characters
  private readonly MAX_SCENE_LENGTH = 280 // characters
  private readonly IDEAL_SCENE_LENGTH = 180 // characters
  private storageService: StorageService

  constructor() {
    this.storageService = new StorageService()
  }

  /**
   * Parse uploaded file based on its type
   */
  async parseFile(file: File): Promise<ParsedContent> {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    try {
      switch (fileExtension) {
        case '.txt':
        case '.md':
          return await this.parseTextFile(file)
        case '.docx':
          return await this.parseDocxFile(file)
        case '.pdf':
          return await this.parsePdfFile(file)
        default:
          throw new Error(`File type ${fileExtension} is not supported`)
      }
    } catch (error) {
      console.error('File parsing error:', error)
      throw new Error(`File parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse plain text content
   */
  parseTextContent(text: string): ParsedContent {
    const cleanedText = this.cleanAndNormalizeText(text)
    return {
      text: cleanedText,
      word_count: this.countWords(cleanedText),
    }
  }

  /**
   * Parse plain text or markdown files
   */
  private async parseTextFile(file: File): Promise<ParsedContent> {
    const text = await file.text()
    return this.parseTextContent(text)
  }

  /**
   * Parse DOCX files using mammoth library
   */
  private async parseDocxFile(file: File): Promise<ParsedContent> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      
      if (result.messages.length > 0) {
        console.warn('DOCX parsing warnings:', result.messages)
      }
      
      return this.parseTextContent(result.value)
    } catch (error) {
      console.error('DOCX parsing error:', error)
      throw new Error(`Failed to parse DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse PDF files using pdf-parse library
   */
  private async parsePdfFile(file: File): Promise<ParsedContent> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const data = await pdfParse(buffer)
      
      return this.parseTextContent(data.text)
    } catch (error) {
      console.error('PDF parsing error:', error)
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean and normalize text content
   */
  cleanAndNormalizeText(text: string): string {
    // First normalize line breaks
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    
    // Remove markdown formatting for plain text processing
    cleaned = this.removeMarkdownFormatting(cleaned)
    
    // Remove excessive line breaks (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    
    // Remove excessive whitespace within lines, but preserve line breaks
    cleaned = cleaned.replace(/[ \t]+/g, ' ')
    
    // Normalize Chinese punctuation (full-width to half-width where appropriate)
    const punctuationMap: Record<string, string> = {
      '，': ',',
      '。': '.',
      '！': '!',
      '？': '?',
      '：': ':',
      '；': ';',
      '（': '(',
      '）': ')',
      '「': '"',
      '」': '"',
      '『': '"',
      '』': '"',
      '【': '[',
      '】': ']',
    }

    // Apply punctuation normalization (optional - keep Chinese punctuation for better TTS)
    // for (const [fullWidth, halfWidth] of Object.entries(punctuationMap)) {
    //   cleaned = cleaned.replace(new RegExp(fullWidth, 'g'), halfWidth)
    // }

    // Trim final result
    return cleaned.trim()
  }

  /**
   * Remove basic markdown formatting
   */
  private removeMarkdownFormatting(text: string): string {
    return text
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
  }

  /**
   * Count words in text (handles both English and Chinese)
   */
  private countWords(text: string): number {
    // For Chinese text, count characters as words
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || []
    
    // For English text, count actual words (remove Chinese chars first)
    const textWithoutChinese = text.replace(/[\u4e00-\u9fff]/g, ' ')
    const englishWords = textWithoutChinese.match(/\b[a-zA-Z]+\b/g) || []
    
    return chineseChars.length + englishWords.length
  }

  /**
   * Segment text into scenes
   */
  async segmentText(text: string, options: SegmentOptions): Promise<SceneSegment[]> {
    if (options.use_llm_segment) {
      // TODO: Implement LLM-based segmentation using Gemini API
      // For now, fall back to rule-based segmentation
      console.warn('LLM segmentation not yet implemented, using rule-based segmentation')
    }

    return this.ruleBasedSegmentation(text)
  }

  /**
   * Rule-based text segmentation
   */
  private ruleBasedSegmentation(text: string): SceneSegment[] {
    const scenes: SceneSegment[] = []
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    let currentScene = ''
    let sceneIndex = 0

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim()
      
      // If adding this paragraph would exceed max length, finalize current scene
      if (currentScene.length > 0 && 
          (currentScene.length + trimmedParagraph.length + 2) > this.MAX_SCENE_LENGTH) {
        
        // Only create scene if it meets minimum length
        if (currentScene.length >= this.MIN_SCENE_LENGTH) {
          scenes.push({
            index: sceneIndex++,
            text: currentScene.trim(),
          })
        }
        currentScene = trimmedParagraph
      } else {
        // Add paragraph to current scene
        if (currentScene.length > 0) {
          currentScene += '\n\n' + trimmedParagraph
        } else {
          currentScene = trimmedParagraph
        }
      }

      // If current scene is at ideal length and ends with sentence punctuation, finalize it
      if (currentScene.length >= this.IDEAL_SCENE_LENGTH && 
          /[.!?。！？]$/.test(currentScene.trim())) {
        scenes.push({
          index: sceneIndex++,
          text: currentScene.trim(),
        })
        currentScene = ''
      }
    }

    // Add remaining content as final scene
    if (currentScene.trim().length >= this.MIN_SCENE_LENGTH) {
      scenes.push({
        index: sceneIndex++,
        text: currentScene.trim(),
      })
    } else if (currentScene.trim().length > 0) {
      // If remaining content is too short but exists, add it to the last scene or create a new one
      if (scenes.length > 0) {
        scenes[scenes.length - 1].text += '\n\n' + currentScene.trim()
      } else {
        scenes.push({
          index: sceneIndex++,
          text: currentScene.trim(),
        })
      }
    }

    // If no scenes were created (text too short), create one scene with all content
    if (scenes.length === 0 && text.trim().length > 0) {
      scenes.push({
        index: 0,
        text: text.trim(),
      })
    }

    // Handle very long single scenes by splitting them
    const finalScenes: SceneSegment[] = []
    for (const scene of scenes) {
      if (scene.text.length <= this.MAX_SCENE_LENGTH) {
        finalScenes.push(scene)
      } else {
        // Split long scene by sentences
        const sentences = scene.text.split(/([.!?。！？]\s*)/)
        let currentSplit = ''
        let splitIndex = scene.index

        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i] + (sentences[i + 1] || '')
          
          if (currentSplit.length + sentence.length > this.MAX_SCENE_LENGTH && currentSplit.length > 0) {
            finalScenes.push({
              index: splitIndex++,
              text: currentSplit.trim(),
            })
            currentSplit = sentence
          } else {
            currentSplit += sentence
          }
        }

        if (currentSplit.trim().length > 0) {
          finalScenes.push({
            index: splitIndex,
            text: currentSplit.trim(),
          })
        }
      }
    }

    // Re-index scenes
    return finalScenes.map((scene, index) => ({
      ...scene,
      index,
    }))
  }

  /**
   * Validate file type
   */
  isValidFileType(filename: string): boolean {
    const allowedExtensions = ['.txt', '.md', '.docx', '.pdf']
    const extension = '.' + filename.split('.').pop()?.toLowerCase()
    return allowedExtensions.includes(extension)
  }

  /**
   * Validate file size
   */
  isValidFileSize(size: number, maxSize: number = 5 * 1024 * 1024): boolean {
    return size <= maxSize
  }

  /**
   * Validate content length
   */
  isValidContentLength(text: string, maxLength: number = 50000): boolean {
    return text.length <= maxLength
  }

  /**
   * Store uploaded file in R2 storage
   */
  async storeUploadedFile(
    userId: string,
    projectId: string,
    file: File
  ): Promise<string> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const key = this.storageService.generateFileKey(userId, projectId, file.name, 'original')
      
      const metadata = {
        originalName: file.name,
        size: file.size.toString(),
        type: file.type,
        uploadedAt: new Date().toISOString(),
      }

      return await this.storageService.uploadFile(key, buffer, file.type, metadata)
    } catch (error) {
      console.error('Error storing uploaded file:', error)
      throw new Error(`Failed to store uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Store processed content (scenes, prompts, etc.)
   */
  async storeProcessedContent(
    userId: string,
    projectId: string,
    contentType: 'scenes' | 'prompts' | 'metadata',
    data: any
  ): Promise<string> {
    try {
      const key = this.storageService.generateContentKey(userId, projectId, contentType)
      return await this.storageService.uploadJsonFile(key, data, {
        contentType,
        projectId,
        userId,
        processedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error storing processed content:', error)
      throw new Error(`Failed to store processed content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Store cleaned text content
   */
  async storeCleanedText(
    userId: string,
    projectId: string,
    cleanedText: string,
    originalFilename?: string
  ): Promise<string> {
    try {
      const filename = originalFilename ? 
        `cleaned_${originalFilename.replace(/\.[^/.]+$/, '.txt')}` : 
        'cleaned_content.txt'
      
      const key = this.storageService.generateFileKey(userId, projectId, filename, 'processed')
      
      return await this.storageService.uploadTextFile(key, cleanedText, {
        originalFilename: originalFilename || 'direct_input',
        processedAt: new Date().toISOString(),
        wordCount: this.countWords(cleanedText).toString(),
      })
    } catch (error) {
      console.error('Error storing cleaned text:', error)
      throw new Error(`Failed to store cleaned text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}