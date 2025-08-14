import { FileUploadService } from '../file-upload-service'

// Mock the storage service
jest.mock('../storage-service', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue('r2://test-bucket/test-key'),
    uploadTextFile: jest.fn().mockResolvedValue('r2://test-bucket/text-key'),
    uploadJsonFile: jest.fn().mockResolvedValue('r2://test-bucket/json-key'),
    generateFileKey: jest.fn().mockReturnValue('test-key'),
    generateContentKey: jest.fn().mockReturnValue('content-key'),
  })),
}))

describe('FileUploadService', () => {
  let service: FileUploadService

  beforeEach(() => {
    service = new FileUploadService()
  })

  describe('parseTextContent', () => {
    it('should parse and count words correctly', () => {
      const text = 'Hello world! This is a test.'
      const result = service.parseTextContent(text)

      expect(result.text).toBe(text)
      expect(result.word_count).toBe(6)
    })

    it('should handle Chinese text correctly', () => {
      const text = '你好世界！這是一個測試。'
      const result = service.parseTextContent(text)

      expect(result.text).toBe(text)
      expect(result.word_count).toBe(10) // Chinese characters count as individual words
    })

    it('should handle mixed Chinese and English text', () => {
      const text = 'Hello 你好 world 世界!'
      const result = service.parseTextContent(text)

      expect(result.text).toBe(text)
      // 2 English words (Hello, world) + 2 Chinese characters (你, 好, 世, 界) = 6 total
      expect(result.word_count).toBe(6)
    })
  })

  describe('cleanAndNormalizeText', () => {
    it('should remove excessive whitespace', () => {
      const text = 'Hello    world!\n\n\n\nThis   is   a   test.'
      const result = service.cleanAndNormalizeText(text)

      expect(result).toBe('Hello world!\n\nThis is a test.')
    })

    it('should remove markdown formatting', () => {
      const text = '# Header\n**Bold text** and *italic text*\n```code block```\n[Link](http://example.com)'
      const result = service.cleanAndNormalizeText(text)

      expect(result).not.toContain('#')
      expect(result).not.toContain('**')
      expect(result).not.toContain('*')
      expect(result).not.toContain('```')
      expect(result).not.toContain('[')
      expect(result).not.toContain('](')
    })

    it('should normalize line breaks', () => {
      const text = 'Line 1\r\nLine 2\rLine 3\nLine 4'
      const result = service.cleanAndNormalizeText(text)

      expect(result).toBe('Line 1\nLine 2\nLine 3\nLine 4')
    })
  })

  describe('ruleBasedSegmentation', () => {
    it('should segment text into appropriate scenes', async () => {
      // Create longer paragraphs to ensure they get split
      const text = 'This is the first paragraph. It contains some content that is long enough to be considered a proper scene. This should be sufficient content for the first scene.\n\nThis is the second paragraph. It has different content that is also long enough to warrant its own scene. This content should also be substantial.\n\nThis is the third paragraph with more text that should also be long enough to create its own scene. This ensures proper segmentation.'
      const options = { auto_segment: true, use_llm_segment: false }
      
      const scenes = await service.segmentText(text, options)

      expect(scenes.length).toBeGreaterThanOrEqual(1)
      expect(scenes[0].index).toBe(0)
      if (scenes.length > 1) {
        expect(scenes[1].index).toBe(1)
      }
    })

    it('should handle very short text', async () => {
      const text = 'Short text.'
      const options = { auto_segment: true, use_llm_segment: false }
      
      const scenes = await service.segmentText(text, options)

      expect(scenes).toHaveLength(1)
      expect(scenes[0].text).toBe(text)
      expect(scenes[0].index).toBe(0)
    })

    it('should split long paragraphs appropriately', async () => {
      // Create text with sentences that can be split properly
      const longText = 'This is a very long sentence that contains a lot of content. '.repeat(10) // Creates a long text with proper sentence endings
      const options = { auto_segment: true, use_llm_segment: false }
      
      const scenes = await service.segmentText(longText, options)

      expect(scenes.length).toBeGreaterThan(0)
      scenes.forEach(scene => {
        expect(scene.text.length).toBeLessThanOrEqual(280) // MAX_SCENE_LENGTH
      })
    })
  })

  describe('file validation', () => {
    it('should validate file types correctly', () => {
      expect(service.isValidFileType('document.txt')).toBe(true)
      expect(service.isValidFileType('document.md')).toBe(true)
      expect(service.isValidFileType('document.docx')).toBe(true)
      expect(service.isValidFileType('document.pdf')).toBe(true)
      expect(service.isValidFileType('document.jpg')).toBe(false)
      expect(service.isValidFileType('document.exe')).toBe(false)
    })

    it('should validate file sizes correctly', () => {
      const maxSize = 5 * 1024 * 1024 // 5MB
      expect(service.isValidFileSize(1024, maxSize)).toBe(true)
      expect(service.isValidFileSize(maxSize, maxSize)).toBe(true)
      expect(service.isValidFileSize(maxSize + 1, maxSize)).toBe(false)
    })

    it('should validate content length correctly', () => {
      const maxLength = 50000
      expect(service.isValidContentLength('short text', maxLength)).toBe(true)
      expect(service.isValidContentLength('a'.repeat(maxLength), maxLength)).toBe(true)
      expect(service.isValidContentLength('a'.repeat(maxLength + 1), maxLength)).toBe(false)
    })
  })

  describe('storage integration', () => {
    it('should store uploaded file', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const userId = 'user-123'
      const projectId = 'project-456'

      const result = await service.storeUploadedFile(userId, projectId, mockFile)

      expect(result).toBe('r2://test-bucket/test-key')
    })

    it('should store processed content', async () => {
      const userId = 'user-123'
      const projectId = 'project-456'
      const data = { scenes: [{ index: 0, text: 'test' }] }

      const result = await service.storeProcessedContent(userId, projectId, 'scenes', data)

      expect(result).toBe('r2://test-bucket/json-key')
    })

    it('should store cleaned text', async () => {
      const userId = 'user-123'
      const projectId = 'project-456'
      const cleanedText = 'This is cleaned text.'

      const result = await service.storeCleanedText(userId, projectId, cleanedText, 'original.txt')

      expect(result).toBe('r2://test-bucket/text-key')
    })
  })
})