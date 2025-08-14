/**
 * Integration test for file upload functionality
 * This test verifies the complete flow from file upload to scene creation
 */

import { FileUploadService } from '@/lib/file-upload-service'

// Mock storage service for integration tests
jest.mock('@/lib/storage-service', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue('r2://test-bucket/test-file'),
    uploadTextFile: jest.fn().mockResolvedValue('r2://test-bucket/test-text'),
    uploadJsonFile: jest.fn().mockResolvedValue('r2://test-bucket/test-json'),
    generateFileKey: jest.fn().mockReturnValue('test-file-key'),
    generateContentKey: jest.fn().mockReturnValue('test-content-key'),
  })),
}))

describe('File Upload Integration', () => {
  let service: FileUploadService

  beforeEach(() => {
    service = new FileUploadService()
  })

  describe('Complete file processing workflow', () => {
    it('should process a text file from upload to scenes', async () => {
      // Simulate a text file upload
      const textContent = `
        This is the first paragraph of a story. It contains some interesting content that should be processed into a scene.

        This is the second paragraph with different content. It should become another scene in the video generation process.

        The third paragraph concludes the story. It provides a satisfying ending to the narrative.
      `.trim()

      // Step 1: Parse text content
      const parsedContent = service.parseTextContent(textContent)
      expect(parsedContent.text).toBeDefined()
      expect(parsedContent.word_count).toBeGreaterThan(0)

      // Step 2: Clean and normalize text
      const cleanedText = service.cleanAndNormalizeText(parsedContent.text)
      expect(cleanedText).toBeDefined()
      expect(cleanedText.length).toBeGreaterThan(0)

      // Step 3: Segment into scenes
      const options = { auto_segment: true, use_llm_segment: false }
      const scenes = await service.segmentText(cleanedText, options)

      expect(scenes).toBeDefined()
      expect(scenes.length).toBeGreaterThan(0)

      // Verify scene structure
      scenes.forEach((scene, index) => {
        expect(scene.index).toBe(index)
        expect(scene.text).toBeDefined()
        expect(scene.text.length).toBeGreaterThan(0)
        expect(scene.text.length).toBeLessThanOrEqual(280) // MAX_SCENE_LENGTH
      })

      // Step 4: Store processed content
      const userId = 'test-user'
      const projectId = 'test-project'

      const cleanedTextUri = await service.storeCleanedText(
        userId,
        projectId,
        cleanedText,
        'test.txt'
      )
      expect(cleanedTextUri).toBe('r2://test-bucket/test-text')

      const scenesUri = await service.storeProcessedContent(
        userId,
        projectId,
        'scenes',
        scenes
      )
      expect(scenesUri).toBe('r2://test-bucket/test-json')
    })

    it('should handle Chinese text correctly', async () => {
      const chineseText = `
        這是第一段中文內容。它包含了一些有趣的故事情節，應該被處理成一個場景。

        第二段有不同的內容。它應該成為影片生成過程中的另一個場景。

        第三段結束了這個故事。它為敘述提供了一個令人滿意的結局。
      `.trim()

      const parsedContent = service.parseTextContent(chineseText)
      const cleanedText = service.cleanAndNormalizeText(parsedContent.text)
      const scenes = await service.segmentText(cleanedText, {
        auto_segment: true,
        use_llm_segment: false,
      })

      expect(scenes.length).toBeGreaterThan(0)
      scenes.forEach(scene => {
        expect(scene.text).toMatch(/[\u4e00-\u9fff]/) // Contains Chinese characters
      })
    })

    it('should handle mixed content types', async () => {
      const mixedContent = `
        # Story Title

        This is an **English paragraph** with some *formatting*.

        這是一段中文內容，包含了不同的語言。

        - List item 1
        - List item 2

        Final paragraph with [a link](http://example.com) and \`code\`.
      `.trim()

      const parsedContent = service.parseTextContent(mixedContent)
      const cleanedText = service.cleanAndNormalizeText(parsedContent.text)

      // Verify markdown formatting is removed
      expect(cleanedText).not.toContain('#')
      expect(cleanedText).not.toContain('**')
      expect(cleanedText).not.toContain('*')
      expect(cleanedText).not.toContain('[')
      expect(cleanedText).not.toContain('](')
      expect(cleanedText).not.toContain('`')

      const scenes = await service.segmentText(cleanedText, {
        auto_segment: true,
        use_llm_segment: false,
      })
      expect(scenes.length).toBeGreaterThan(0)
    })

    it('should validate file constraints', () => {
      // Test file type validation
      expect(service.isValidFileType('document.txt')).toBe(true)
      expect(service.isValidFileType('document.md')).toBe(true)
      expect(service.isValidFileType('document.docx')).toBe(true)
      expect(service.isValidFileType('document.pdf')).toBe(true)
      expect(service.isValidFileType('image.jpg')).toBe(false)

      // Test file size validation
      const maxSize = 5 * 1024 * 1024 // 5MB
      expect(service.isValidFileSize(1024, maxSize)).toBe(true)
      expect(service.isValidFileSize(maxSize + 1, maxSize)).toBe(false)

      // Test content length validation
      const maxLength = 50000
      expect(service.isValidContentLength('short text', maxLength)).toBe(true)
      expect(
        service.isValidContentLength('x'.repeat(maxLength + 1), maxLength)
      ).toBe(false)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle very short content', async () => {
      const shortText = 'Short.'
      const scenes = await service.segmentText(shortText, {
        auto_segment: true,
        use_llm_segment: false,
      })

      expect(scenes).toHaveLength(1)
      expect(scenes[0].text).toBe(shortText)
    })

    it('should handle empty content gracefully', async () => {
      const emptyText = ''
      const scenes = await service.segmentText(emptyText, {
        auto_segment: true,
        use_llm_segment: false,
      })

      expect(scenes).toHaveLength(0)
    })

    it('should handle content with only whitespace', () => {
      const whitespaceText = '   \n\n\t   '
      const cleaned = service.cleanAndNormalizeText(whitespaceText)

      expect(cleaned).toBe('')
    })

    it('should preserve important punctuation', () => {
      const textWithPunctuation = '你好！這是測試。真的嗎？'
      const cleaned = service.cleanAndNormalizeText(textWithPunctuation)

      // Should preserve Chinese punctuation for better TTS
      expect(cleaned).toContain('！')
      expect(cleaned).toContain('。')
      expect(cleaned).toContain('？')
    })
  })
})
