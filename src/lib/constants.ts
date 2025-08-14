// Database and application constants

// Database configuration
export const DATABASE_CONFIG = {
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  QUERY_TIMEOUT: 30000, // 30 seconds
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT: 60000, // 1 minute
} as const

// Asset lifecycle configuration
export const ASSET_CONFIG = {
  DEFAULT_EXPIRY_DAYS: 30,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FILE_TYPES: ['.txt', '.md', '.docx', '.pdf'] as const,
  CLEANUP_INTERVAL_HOURS: 24,
} as const

// Job configuration
export const JOB_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_TIMEOUT_SECONDS: 300, // 5 minutes
  QUEUE_BATCH_SIZE: 10,
  PROGRESS_UPDATE_INTERVAL: 5000, // 5 seconds
} as const

// Cost calculation constants (in USD)
export const PRICING = {
  // Gemini API pricing (as of 2025-08)
  TEXT_PER_TOKEN: 0.000001, // $0.000001 per token
  IMAGE_PER_GENERATION: 0.04, // $0.04 per image (Imagen 4)
  TTS_PER_CHARACTER: 0.000016, // $0.000016 per character
  
  // Rendering costs (estimated)
  RENDER_PER_SECOND: 0.01, // $0.01 per second of video
  
  // Resolution multipliers
  RESOLUTION_MULTIPLIERS: {
    '9:16': 1.0,
    '16:9': 1.2,
    '1:1': 0.8,
  },
} as const

// Free tier limits (per day)
export const FREE_TIER_LIMITS = {
  PROJECTS_PER_DAY: 3,
  SCENES_PER_PROJECT: 20,
  TOTAL_CHARACTERS_PER_DAY: 10000,
  IMAGES_PER_DAY: 50,
  TTS_MINUTES_PER_DAY: 10,
} as const

// Premium tier limits (per day)
export const PREMIUM_TIER_LIMITS = {
  PROJECTS_PER_DAY: 50,
  SCENES_PER_PROJECT: 100,
  TOTAL_CHARACTERS_PER_DAY: 100000,
  IMAGES_PER_DAY: 500,
  TTS_MINUTES_PER_DAY: 120,
} as const

// Scene processing constants
export const SCENE_CONFIG = {
  MIN_CHARACTERS: 50,
  MAX_CHARACTERS: 280,
  DEFAULT_CHARACTERS: 150,
  OVERLAP_CHARACTERS: 20, // For context preservation
} as const

// Template configurations
export const TEMPLATE_CONFIGS = {
  classic: {
    name: 'Classic Clean',
    description: '白底細陰影 + 輕轉場',
    background_color: '#ffffff',
    text_color: '#1f2937',
    shadow_opacity: 0.1,
    default_transition: 'fade',
  },
  dark: {
    name: 'Dark Glass',
    description: '深色玻璃擬態風格',
    background_color: '#0f172a',
    text_color: '#f8fafc',
    glass_opacity: 0.2,
    default_transition: 'zoom',
  },
  vivid: {
    name: 'Vivid Gradient',
    description: '鮮豔漸層背景',
    background_gradient: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
    text_color: '#ffffff',
    default_transition: 'fade',
  },
} as const

// Voice mapping for Gemini TTS
export const VOICE_MAPPING = {
  male: 'Kore',
  female: 'Puck',
  natural: 'Kore', // Default to Kore for natural voice
} as const

// Error codes and messages
export const ERROR_CODES = {
  // Database errors
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  
  // Authentication errors
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_FILE_TOO_LARGE: 'VALIDATION_FILE_TOO_LARGE',
  VALIDATION_UNSUPPORTED_FORMAT: 'VALIDATION_UNSUPPORTED_FORMAT',
  
  // API errors
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_SERVICE_UNAVAILABLE: 'API_SERVICE_UNAVAILABLE',
  API_CONTENT_POLICY_VIOLATION: 'API_CONTENT_POLICY_VIOLATION',
  
  // Job errors
  JOB_TIMEOUT: 'JOB_TIMEOUT',
  JOB_CANCELLED: 'JOB_CANCELLED',
  JOB_RESOURCE_EXHAUSTED: 'JOB_RESOURCE_EXHAUSTED',
} as const

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const

// Monitoring and observability
export const MONITORING_CONFIG = {
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  METRICS_COLLECTION_INTERVAL: 60000, // 1 minute
  LOG_RETENTION_DAYS: 30,
  TRACE_SAMPLING_RATE: 0.1, // 10%
} as const

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 300, // 5 minutes
  USER_SESSION_TTL: 86400, // 24 hours
  PROJECT_METADATA_TTL: 3600, // 1 hour
  COST_ESTIMATE_TTL: 900, // 15 minutes
  ASSET_METADATA_TTL: 1800, // 30 minutes
} as const

// Workflow step names
export const WORKFLOW_STEPS = {
  INGEST: 'ingest',
  SEGMENT: 'segment',
  PROMPT: 'prompt',
  IMAGE_GEN: 'image_generation',
  TTS: 'text_to_speech',
  RENDER: 'video_render',
  PUBLISH: 'publish',
} as const

// Default user settings
export const DEFAULT_USER_SETTINGS = {
  language: 'zh-TW',
  timezone: 'Asia/Taipei',
  theme: 'system',
  notifications: {
    email: true,
    discord: false,
    webhook: false,
  },
  privacy: {
    analytics: true,
    error_reporting: true,
  },
} as const