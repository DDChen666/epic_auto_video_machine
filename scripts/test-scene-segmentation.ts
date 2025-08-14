#!/usr/bin/env tsx

/**
 * Integration test script for scene segmentation functionality
 * This script tests the scene segmentation service directly
 */

import { SceneSegmentationService } from '../src/lib/scene-segmentation-service'
import type { AuthContext } from '../src/types'

async function testSceneSegmentation() {
  console.log('🧪 Testing Scene Segmentation Service...\n')

  const mockAuthContext: AuthContext = {
    userId: 'test-user',
    userRole: 'USER',
    email: 'test@example.com',
  }

  const service = new SceneSegmentationService(mockAuthContext)

  // Test 1: Basic rule-based segmentation
  console.log('📝 Test 1: Basic rule-based segmentation')
  const testText1 = `
這是一個測試故事的開始。主角是一個年輕的程式設計師，他正在開發一個自動影片生成系統。

他每天都在思考如何讓系統更加智慧，能夠理解文字的語義並切分成適合的場景。這個挑戰讓他感到既興奮又緊張。

經過無數個日夜的努力，他終於完成了第一個版本。系統能夠自動將長文字切分成多個場景，每個場景都有適當的長度。

最後，他成功地展示了這個系統，獲得了大家的讚賞。這個故事告訴我們，堅持不懈的努力終會有回報。
  `.trim()

  try {
    const result1 = await service.segmentText(testText1)
    console.log(`✅ Segmented into ${result1.scenes.length} scenes`)
    console.log(`📊 Method: ${result1.metadata.segmentation_method}`)
    console.log(`⏱️  Processing time: ${result1.metadata.processing_time}ms`)
    console.log(
      `📏 Average scene length: ${result1.metadata.average_scene_length} characters\n`
    )

    result1.scenes.forEach((scene, index) => {
      console.log(
        `Scene ${index + 1} (${scene.text.length} chars): ${scene.text.substring(0, 50)}...`
      )
    })
    console.log()
  } catch (error) {
    console.error('❌ Test 1 failed:', error)
  }

  // Test 2: Text normalization
  console.log('🔤 Test 2: Text normalization')
  const testText2 = '這是測試１２３ＡＢＣ，包含全形字符！你覺得怎麼樣？'

  try {
    const result2 = await service.segmentText(testText2)
    console.log(`✅ Original: ${testText2}`)
    console.log(`✅ Normalized: ${result2.scenes[0].text}\n`)
  } catch (error) {
    console.error('❌ Test 2 failed:', error)
  }

  // Test 3: Scene editing operations
  console.log('✂️  Test 3: Scene editing operations')
  const testScenes = [
    { id: 'scene_0', index: 0, text: '第一個場景的內容。' },
    { id: 'scene_1', index: 1, text: '第二個場景的內容。' },
    { id: 'scene_2', index: 2, text: '第三個場景的內容。' },
  ]

  try {
    // Test merge
    const mergedScenes = await service.editScenes(testScenes, {
      type: 'merge',
      scene_ids: ['scene_0', 'scene_1'],
    })
    console.log(
      `✅ Merge: ${testScenes.length} → ${mergedScenes.length} scenes`
    )

    // Test split
    const splitScenes = await service.editScenes(testScenes, {
      type: 'split',
      scene_ids: ['scene_0'],
      split_position: 5,
    })
    console.log(`✅ Split: ${testScenes.length} → ${splitScenes.length} scenes`)

    // Test reorder
    const reorderedScenes = await service.editScenes(testScenes, {
      type: 'reorder',
      scene_ids: ['scene_2'],
      new_index: 0,
    })
    console.log(`✅ Reorder: Scene moved to position 0`)
    console.log(
      `   New order: ${reorderedScenes.map(s => s.text.substring(0, 10)).join(' | ')}\n`
    )
  } catch (error) {
    console.error('❌ Test 3 failed:', error)
  }

  // Test 4: Scene validation
  console.log('✅ Test 4: Scene validation')
  const invalidScenes = [
    { id: 'scene_0', index: 0, text: '短' }, // Too short
    {
      id: 'scene_1',
      index: 1,
      text: '適當長度的場景內容，符合最小長度要求。'.repeat(3),
    }, // Good
    { id: 'scene_2', index: 2, text: '' }, // Empty
  ]

  try {
    const validation = service.validateScenes(invalidScenes)
    console.log(`✅ Validation result: ${validation.valid ? 'PASS' : 'FAIL'}`)
    console.log(`⚠️  Errors: ${validation.errors.length}`)
    console.log(`⚠️  Warnings: ${validation.warnings.length}`)

    if (validation.errors.length > 0) {
      validation.errors.forEach(error => console.log(`   Error: ${error}`))
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning =>
        console.log(`   Warning: ${warning}`)
      )
    }
    console.log()
  } catch (error) {
    console.error('❌ Test 4 failed:', error)
  }

  // Test 5: Custom configuration
  console.log('⚙️  Test 5: Custom configuration')
  const customService = new SceneSegmentationService(mockAuthContext, {
    min_length: 50,
    max_length: 150,
    preserve_paragraphs: false,
  })

  try {
    const result5 = await customService.segmentText(testText1)
    console.log(`✅ Custom config: ${result5.scenes.length} scenes`)
    console.log(
      `📏 Scene lengths: ${result5.scenes.map(s => s.text.length).join(', ')}`
    )

    const allWithinLimits = result5.scenes.every(
      scene => scene.text.length >= 50 && scene.text.length <= 150
    )
    console.log(`✅ All scenes within limits: ${allWithinLimits}\n`)
  } catch (error) {
    console.error('❌ Test 5 failed:', error)
  }

  console.log('🎉 Scene segmentation tests completed!')
}

// Run the tests
if (require.main === module) {
  testSceneSegmentation().catch(console.error)
}

export { testSceneSegmentation }
