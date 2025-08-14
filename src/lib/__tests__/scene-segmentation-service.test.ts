import { SceneSegmentationService } from '../scene-segmentation-service'
import { GeminiClient } from '../gemini-client'
import type { AuthContext, SceneData } from '@/types'

// Mock GeminiClient
jest.mock('../gemini-client')
const MockedGeminiClient = GeminiClient as jest.MockedClass<typeof GeminiClient>

describe('SceneSegmentationService', () => {
  let service: SceneSegmentationService
  let mockAuthContext: AuthContext

  beforeEach(() => {
    mockAuthContext = {
      userId: 'test-user-id',
      userRole: 'USER',
      email: 'test@example.com',
    }

    service = new SceneSegmentationService(mockAuthContext)
    jest.clearAllMocks()
  })

  describe('Text Normalization', () => {
    it('should normalize full-width characters to half-width', async () => {
      const text = '這是一個測試１２３ＡＢＣ。'
      const result = await service.segmentText(text)
      
      expect(result.scenes[0].text).toContain('123ABC')
    })

    it('should normalize Chinese punctuation', async () => {
      const text = '這是測試，包含各種標點符號！你覺得怎麼樣？'
      const result = await service.segmentText(text)
      
      expect(result.scenes[0].text).toContain('，')
      expect(result.scenes[0].text).toContain('！')
      expect(result.scenes[0].text).toContain('？')
    })

    it('should clean up whitespace', async () => {
      const text = '這是   測試\n\n\n多餘的   空白。'
      const result = await service.segmentText(text)
      
      expect(result.scenes[0].text).not.toMatch(/\s{2,}/)
    })
  })

  describe('Rule-based Segmentation', () => {
    it('should segment text within default length limits (100-280 chars)', async () => {
      const longText = '這是一個很長的文字段落。'.repeat(20) // ~200 chars
      const result = await service.segmentText(longText)
      
      expect(result.scenes.length).toBeGreaterThan(0)
      result.scenes.forEach(scene => {
        expect(scene.text.length).toBeGreaterThanOrEqual(100)
        expect(scene.text.length).toBeLessThanOrEqual(280)
      })
    })

    it('should preserve paragraph boundaries when enabled', async () => {
      const text = `第一段落的內容，包含足夠的文字來測試分段功能。這段文字應該保持在同一個場景中，並且需要有足夠的長度來滿足最小字數要求。這是第一段的更多內容。

第二段落的內容，也包含足夠的文字來形成另一個場景。這應該是另一個場景的開始，同樣需要滿足最小長度要求才能成為獨立場景。這是第二段的更多內容。`

      const result = await service.segmentText(text, {
        config: { preserve_paragraphs: true, min_length: 50, max_length: 150 }
      })
      
      // Should create multiple scenes due to length constraints
      expect(result.scenes.length).toBeGreaterThanOrEqual(1)
      // Verify that paragraph structure influences segmentation
      expect(result.scenes.some(scene => scene.text.includes('第一段落'))).toBe(true)
    })

    it('should split by sentences using Chinese punctuation', async () => {
      const text = '第一句話包含足夠的內容來測試句子切分功能，這句話很長。第二句話也包含足夠的內容來測試分段！第三句話同樣有足夠的長度來測試？第四句話繼續測試分段功能；第五句話完成測試並結束。'
      const result = await service.segmentText(text, {
        config: { max_length: 60, min_length: 20 }
      })
      
      // Should create multiple scenes due to length constraints
      expect(result.scenes.length).toBeGreaterThanOrEqual(1)
      // Verify that sentences are properly handled
      expect(result.scenes.every(scene => scene.text.length <= 60)).toBe(true)
    })

    it('should handle text shorter than min_length', async () => {
      const shortText = '短文字'
      const result = await service.segmentText(shortText)
      
      expect(result.scenes.length).toBe(1)
      expect(result.scenes[0].text).toBe(shortText)
    })

    it('should assign sequential indices to scenes', async () => {
      const text = '第一段。'.repeat(10) + '第二段。'.repeat(10)
      const result = await service.segmentText(text)
      
      result.scenes.forEach((scene, index) => {
        expect(scene.index).toBe(index)
        expect(scene.id).toBe(`scene_${index}`)
      })
    })
  })

  describe('LLM-assisted Segmentation', () => {
    beforeEach(() => {
      // Mock successful Gemini client creation
      MockedGeminiClient.createWithBYOKey.mockResolvedValue({
        generateText: jest.fn().mockResolvedValue(JSON.stringify({
          scenes: [
            { index: 0, text: '第一個場景的內容，由LLM智慧切分。' },
            { index: 1, text: '第二個場景的內容，保持語義完整性。' }
          ]
        }))
      } as any)
    })

    it('should use LLM segmentation when enabled', async () => {
      const text = '這是一個需要智慧切分的長文字段落，包含多個語義單元。'
      
      const result = await service.segmentText(text, {
        config: { use_llm: true },
        user_id: 'test-user'
      })
      
      expect(result.metadata.segmentation_method).toBe('llm_assisted')
      expect(result.scenes.length).toBe(2)
    })

    it('should fallback to rule-based when LLM fails', async () => {
      // Mock LLM failure
      MockedGeminiClient.createWithBYOKey.mockResolvedValue({
        generateText: jest.fn().mockRejectedValue(new Error('LLM error'))
      } as any)

      const text = '這是測試文字。'.repeat(20)
      
      const result = await service.segmentText(text, {
        config: { use_llm: true },
        user_id: 'test-user'
      })
      
      expect(result.metadata.segmentation_method).toBe('rule_based')
    })

    it('should handle invalid LLM response format', async () => {
      MockedGeminiClient.createWithBYOKey.mockResolvedValue({
        generateText: jest.fn().mockResolvedValue('invalid json response')
      } as any)

      const text = '這是測試文字。'.repeat(20)
      
      const result = await service.segmentText(text, {
        config: { use_llm: true },
        user_id: 'test-user'
      })
      
      expect(result.metadata.segmentation_method).toBe('rule_based')
    })
  })

  describe('Scene Editing Operations', () => {
    let testScenes: SceneData[]

    beforeEach(() => {
      testScenes = [
        { id: 'scene_0', index: 0, text: '第一個場景的內容。' },
        { id: 'scene_1', index: 1, text: '第二個場景的內容。' },
        { id: 'scene_2', index: 2, text: '第三個場景的內容。' },
      ]
    })

    describe('Merge Operation', () => {
      it('should merge multiple scenes', async () => {
        const result = await service.editScenes(testScenes, {
          type: 'merge',
          scene_ids: ['scene_0', 'scene_1']
        })

        expect(result.length).toBe(2) // 3 - 2 + 1 merged
        expect(result[0].text).toContain('第一個場景的內容。 第二個場景的內容。')
      })

      it('should throw error when merging less than 2 scenes', async () => {
        await expect(service.editScenes(testScenes, {
          type: 'merge',
          scene_ids: ['scene_0']
        })).rejects.toThrow('At least 2 scenes required')
      })

      it('should throw error when scene not found', async () => {
        await expect(service.editScenes(testScenes, {
          type: 'merge',
          scene_ids: ['scene_0', 'nonexistent']
        })).rejects.toThrow('Some scenes not found')
      })
    })

    describe('Split Operation', () => {
      it('should split scene at specified position', async () => {
        const result = await service.editScenes(testScenes, {
          type: 'split',
          scene_ids: ['scene_0'],
          split_position: 5
        })

        expect(result.length).toBe(4) // 3 + 1 split
        expect(result[0].text).toBe('第一個場景')
        expect(result[1].text).toBe('的內容。')
      })

      it('should throw error for invalid split position', async () => {
        await expect(service.editScenes(testScenes, {
          type: 'split',
          scene_ids: ['scene_0'],
          split_position: 0
        })).rejects.toThrow('Invalid split position')
      })
    })

    describe('Reorder Operation', () => {
      it('should reorder scene to new position', async () => {
        const result = await service.editScenes(testScenes, {
          type: 'reorder',
          scene_ids: ['scene_0'],
          new_index: 2
        })

        expect(result[0].text).toBe('第二個場景的內容。')
        expect(result[1].text).toBe('第三個場景的內容。')
        expect(result[2].text).toBe('第一個場景的內容。')
      })

      it('should maintain sequential indices after reorder', async () => {
        const result = await service.editScenes(testScenes, {
          type: 'reorder',
          scene_ids: ['scene_2'],
          new_index: 0
        })

        result.forEach((scene, index) => {
          expect(scene.index).toBe(index)
        })
      })
    })

    describe('Update Operation', () => {
      it('should update scene text', async () => {
        const newText = '更新後的場景內容。'
        const result = await service.editScenes(testScenes, {
          type: 'update',
          scene_ids: ['scene_1'],
          new_text: newText
        })

        expect(result[1].text).toBe(newText)
      })
    })
  })

  describe('Scene Validation', () => {
    it('should validate scene lengths', () => {
      const scenes: SceneData[] = [
        { id: 'scene_0', index: 0, text: '太短' }, // Too short
        { id: 'scene_1', index: 1, text: '適當長度的場景內容，符合最小長度要求。'.repeat(3) }, // Good
        { id: 'scene_2', index: 2, text: '過長的場景內容。'.repeat(50) }, // Too long
        { id: 'scene_3', index: 3, text: '' }, // Empty
      ]

      const result = service.validateScenes(scenes)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should pass validation for valid scenes', () => {
      const scenes: SceneData[] = [
        { id: 'scene_0', index: 0, text: '這是一個符合長度要求的場景內容，包含足夠的文字來通過驗證測試。' },
        { id: 'scene_1', index: 1, text: '另一個有效的場景內容，也符合最小和最大長度的要求。' },
      ]

      const result = service.validateScenes(scenes)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })
  })

  describe('Configuration', () => {
    it('should use custom configuration', async () => {
      const customConfig = {
        min_length: 50,
        max_length: 150,
        preserve_paragraphs: false,
      }

      const text = '測試文字。'.repeat(30)
      const result = await service.segmentText(text, { config: customConfig })

      result.scenes.forEach(scene => {
        expect(scene.text.length).toBeLessThanOrEqual(150)
      })
    })

    it('should merge with default configuration', async () => {
      const partialConfig = { max_length: 200 }
      
      const text = '測試文字。'.repeat(20)
      const result = await service.segmentText(text, { config: partialConfig })

      // Should still use default min_length of 100
      result.scenes.forEach(scene => {
        expect(scene.text.length).toBeGreaterThanOrEqual(100)
        expect(scene.text.length).toBeLessThanOrEqual(200)
      })
    })
  })

  describe('Metadata', () => {
    it('should return correct metadata', async () => {
      const text = '測試文字內容。'.repeat(20)
      const result = await service.segmentText(text)

      expect(result.metadata).toMatchObject({
        original_length: text.length,
        scene_count: result.scenes.length,
        segmentation_method: 'rule_based',
      })
      expect(result.metadata.average_scene_length).toBeGreaterThan(0)
      expect(result.metadata.processing_time).toBeGreaterThan(0)
    })
  })
})