# Prompt Generation Service Implementation

## Overview

This document describes the implementation of Task 9: "實作提示詞生成服務" (Implement Prompt Generation Service) from the Epic Auto Video Machine project. The implementation covers all requirements from 4.1 to 4.5 for visual prompt generation.

## Features Implemented

### ✅ Core Requirements Fulfilled

1. **Requirement 4.1**: 使用 Gemini 為每個場景生成英文化的視覺提示詞
   - ✅ Scene-to-visual prompt conversion logic
   - ✅ Chinese text to English visual prompt translation
   - ✅ Gemini API integration for prompt generation

2. **Requirement 4.2**: 實作英文化和視覺要素提取（主體/環境/鏡頭/光影/情緒）
   - ✅ Visual elements extraction (subject/environment/camera/lighting/mood)
   - ✅ Structured analysis of Chinese scene text
   - ✅ One-line prompt preview generation

3. **Requirement 4.3**: 建立內容安全過濾和替代方案生成
   - ✅ Content safety filtering system
   - ✅ Blocked words detection (built-in + custom)
   - ✅ Safe alternative prompt generation

4. **Requirement 4.4**: 實作提示詞預覽和編輯功能
   - ✅ Prompt preview generation
   - ✅ Individual scene prompt editing
   - ✅ Prompt validation for edited content

5. **Requirement 4.5**: 建立模板化提示詞系統避免違規詞
   - ✅ Template-based prompt system (Classic, Dark, Vivid)
   - ✅ Safe word enforcement
   - ✅ Violation prevention through templates

## Architecture

### Service Layer

```
PromptGenerationService
├── generateScenePrompts()     # Main prompt generation
├── validateAndEditPrompt()    # Prompt editing validation
├── generatePromptPreview()    # Preview generation
├── extractVisualElements()    # Visual analysis
├── applySafetyFilter()        # Content filtering
└── applyTemplate()           # Template application
```

### API Layer

```
/api/v1/projects/[id]/prompts
├── POST   # Generate prompts for scenes
├── PUT    # Validate edited prompts
└── GET    # Get prompt previews
```

## Implementation Details

### 1. Visual Elements Extraction

The service extracts five key visual elements from Chinese text:

```typescript
interface VisualElements {
  subject: string[] // 主體：人物、物品、動物等
  environment: string[] // 環境：室內、戶外、場所等
  camera: string[] // 鏡頭：角度、距離、運動等
  lighting: string[] // 光影：時間、氣氛、光源等
  mood: string[] // 情緒：氛圍、感覺、色調等
}
```

**Process:**

1. Send Chinese scene text to Gemini with structured prompt
2. Parse JSON response with visual elements
3. Fallback to keyword matching if LLM fails

### 2. English Prompt Generation

Converts Chinese scenes to English visual prompts:

**Input:** `一個美麗的女孩在公園裡散步，陽光灿爛，心情愉快。`

**Output:** `beautiful girl walking in park, bright sunlight, cheerful mood, professional photography, high quality`

**Process:**

1. Use extracted visual elements as context
2. Generate English prompt with Gemini
3. Apply aspect ratio and template constraints
4. Ensure photography/cinematography terminology

### 3. Safety Filtering System

Multi-layer content safety approach:

```typescript
interface SafetyFilterResult {
  isSafe: boolean
  violations: string[]
  filteredPrompt?: string
  alternatives?: string[]
}
```

**Built-in Blocked Words:**

- Violence: violence, weapon, gun, knife, blood, death, kill
- Adult content: nude, naked, sexual, explicit, adult
- Hate speech: hate, discrimination, racist, offensive
- Copyrighted: disney, marvel, pokemon, nintendo, sony
- Inappropriate: disturbing, scary, horror, nightmare

**Process:**

1. Check custom blocked words from user config
2. Check built-in blocked words list
3. Generate safe alternatives if violations found
4. Provide multiple alternative suggestions

### 4. Template System

Three predefined templates with different aesthetics:

#### Classic Clean Template

```typescript
{
  basePrompt: 'clean composition, soft lighting, professional photography',
  styleModifiers: ['minimal', 'elegant', 'high quality', 'sharp focus'],
  safeWords: ['professional', 'clean', 'appropriate'],
  avoidWords: ['dark', 'violent', 'explicit']
}
```

#### Dark Glass Template

```typescript
{
  basePrompt: 'dark aesthetic, glass morphism, moody atmosphere',
  styleModifiers: ['cinematic', 'dramatic lighting', 'modern', 'sleek'],
  safeWords: ['artistic', 'professional', 'tasteful'],
  avoidWords: ['violent', 'disturbing', 'explicit']
}
```

#### Vivid Gradient Template

```typescript
{
  basePrompt: 'vibrant colors, gradient backgrounds, energetic mood',
  styleModifiers: ['colorful', 'dynamic', 'bright', 'cheerful'],
  safeWords: ['positive', 'uplifting', 'family-friendly'],
  avoidWords: ['dark', 'violent', 'inappropriate']
}
```

### 5. Prompt Preview Generation

Creates concise previews for UI display:

**Input:** `beautiful girl walking in park, bright sunlight, cheerful mood, professional photography, high quality`

**Output:** `beautiful • girl • walking • park • bright`

**Algorithm:**

1. Split prompt into words
2. Filter out common words (the, and, with, etc.)
3. Take first 5 meaningful words
4. Join with bullet separator

## API Endpoints

### POST /api/v1/projects/[id]/prompts

Generate visual prompts for project scenes.

**Request:**

```json
{
  "scenes": [
    {
      "id": "scene-1",
      "index": 1,
      "text": "一個美麗的女孩在公園裡散步"
    }
  ],
  "config": {
    "aspect_ratio": "9:16",
    "template": "classic",
    "safety": {
      "content_policy": "standard",
      "blocked_words": ["custom_word"]
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "sceneIndex": 1,
      "originalText": "一個美麗的女孩在公園裡散步",
      "visualPrompt": "beautiful girl walking in park, professional photography",
      "visualElements": {
        "subject": ["女孩"],
        "environment": ["公園"],
        "camera": ["medium shot"],
        "lighting": ["陽光"],
        "mood": ["愉快"]
      },
      "safetyStatus": "safe",
      "success": true
    }
  ],
  "message": "Generated prompts for 1 scenes"
}
```

### PUT /api/v1/projects/[id]/prompts

Validate edited prompt for safety and appropriateness.

**Request:**

```json
{
  "originalPrompt": "original scene description",
  "editedPrompt": "edited scene with improvements"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isValid": true,
    "safetyViolations": [],
    "suggestions": [],
    "filteredPrompt": null
  }
}
```

### GET /api/v1/projects/[id]/prompts/preview

Get prompt previews for all project scenes.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "sceneIndex": 1,
      "preview": "beautiful • girl • walking • park • professional",
      "fullPrompt": "beautiful girl walking in park, professional photography",
      "safetyStatus": "safe"
    }
  ]
}
```

## Error Handling

### Graceful Degradation

1. **LLM API Failures**: Fallback to rule-based extraction and basic prompts
2. **Safety Filter Failures**: Default to safe, generic prompts
3. **Template Failures**: Use basic professional photography prompt

### Error Types

```typescript
enum PromptErrorType {
  LLM_API_ERROR = 'llm_api_error',
  SAFETY_VIOLATION = 'safety_violation',
  TEMPLATE_ERROR = 'template_error',
  VALIDATION_ERROR = 'validation_error',
}
```

## Testing

### Unit Tests

- ✅ Visual elements extraction
- ✅ English prompt generation
- ✅ Safety filtering
- ✅ Template application
- ✅ Prompt preview generation
- ✅ Error handling and fallbacks

### Integration Tests

- ✅ End-to-end prompt generation flow
- ✅ API endpoint functionality
- ✅ Authentication and authorization
- ✅ Project ownership validation

### Test Scripts

```bash
# Run unit tests
npm test src/lib/__tests__/prompt-generation-service.test.ts

# Run API tests
npm test src/app/api/v1/projects/__tests__/prompts.test.ts

# Run integration test
npx tsx scripts/test-prompt-generation.ts
```

## Performance Considerations

### Concurrency Control

- Maximum 3 concurrent Gemini API calls
- Circuit breaker pattern for API failures
- Exponential backoff for rate limiting

### Caching Strategy

- Template configurations cached in memory
- Blocked words list cached as Set for O(1) lookup
- Visual elements extraction results could be cached

### Rate Limiting

- Respects Gemini API rate limits
- Implements request queuing for high load
- Provides user feedback for rate limit delays

## Security Features

### Content Safety

1. **Multi-layer filtering**: Custom + built-in blocked words
2. **Safe alternatives**: Automatic generation of appropriate content
3. **Template enforcement**: Safe words required, avoid words blocked
4. **User control**: Custom blocked words per project

### Data Protection

1. **Input sanitization**: All user inputs validated
2. **Output filtering**: Generated prompts checked before storage
3. **Audit logging**: All safety violations logged
4. **User isolation**: Prompts scoped to user/project

## Future Enhancements

### Planned Features

1. **Advanced Templates**: More template options and customization
2. **Style Transfer**: Apply artistic styles to prompts
3. **Batch Processing**: Optimize for large scene counts
4. **A/B Testing**: Compare different prompt strategies
5. **Analytics**: Track prompt effectiveness and user preferences

### Performance Optimizations

1. **Prompt Caching**: Cache similar prompts to reduce API calls
2. **Batch API Calls**: Group multiple scenes in single request
3. **Streaming Responses**: Real-time prompt generation updates
4. **Edge Computing**: Deploy prompt generation closer to users

## Monitoring and Metrics

### Key Metrics

- Prompt generation success rate
- Average generation time per scene
- Safety filter activation rate
- User edit frequency
- Template usage distribution

### Alerts

- High API error rate (>5%)
- Safety violations spike
- Generation time exceeding SLA
- Rate limit approaching

## Conclusion

The Prompt Generation Service successfully implements all requirements from task 9, providing a robust, safe, and user-friendly system for converting Chinese scene text into high-quality English visual prompts. The implementation includes comprehensive error handling, safety filtering, and template-based customization while maintaining good performance and security practices.

The service is ready for production use and provides a solid foundation for the image generation pipeline in the Epic Auto Video Machine project.
