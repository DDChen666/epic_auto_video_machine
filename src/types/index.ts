// Database types based on Prisma schema
import type {
  User,
  Account,
  Session,
  VerificationToken,
  Project,
  Job,
  Scene,
  Asset,
  Preset,
  ProjectStatus,
  JobStatus,
  AssetType,
  UserRole,
} from '@prisma/client'

export type {
  User,
  Account,
  Session,
  VerificationToken,
  Project,
  Job,
  Scene,
  Asset,
  Preset,
  ProjectStatus,
  JobStatus,
  AssetType,
  UserRole,
}

// Configuration types from design document
export interface ProjectConfig {
  aspect_ratio: '9:16' | '16:9' | '1:1'
  template: TemplateConfig
  voice: VoiceConfig
  generation: GenerationConfig
  safety: SafetyConfig
}

export interface TemplateConfig {
  name: 'classic' | 'dark' | 'vivid'
  transitions: 'none' | 'fade' | 'zoom'
  transition_duration: number // milliseconds
  background_music: boolean
  bgm_volume: number // LUFS
}

export interface VoiceConfig {
  type: 'male' | 'female' | 'natural'
  speed: number // 0.9-1.1
  language: 'zh-TW' | 'en'
  accent: 'taiwan' | 'mainland' | 'hongkong'
}

export interface GenerationConfig {
  images_per_scene: 1 | 2 | 3
  image_quality: 'standard' | 'high'
  retry_attempts: number
  timeout_seconds: number
  smart_crop: boolean
}

export interface SafetyConfig {
  content_policy: 'strict' | 'standard'
  blocked_words: string[]
  error_strategy: 'skip' | 'mask' | 'fail'
  adult_content: 'block' | 'warn' | 'allow'
  violence_filter: boolean
}

// Cost tracking types
export interface CostEstimate {
  llm_cost: number
  image_cost: number
  tts_cost: number
  render_cost: number
  total_min: number
  total_max: number
  currency: 'USD' | 'TWD'
}

export interface CostActual {
  llm_cost: number
  image_cost: number
  tts_cost: number
  render_cost: number
  total: number
  currency: 'USD' | 'TWD'
  breakdown: CostBreakdown[]
}

export interface CostBreakdown {
  service: string
  operation: string
  quantity: number
  unit_cost: number
  total_cost: number
  timestamp: string
}

// Resolution mapping
export interface ResolutionMapping {
  '9:16': { width: 1080; height: 1920; name: '直式短片' }
  '16:9': { width: 1920; height: 1080; name: '橫式影片' }
  '1:1': { width: 1080; height: 1080; name: '方形貼文' }
}

// API request/response types
export interface CreateProjectRequest {
  title: string
  description?: string
  config: ProjectConfig
}

export interface CreateProjectResponse {
  id: string
  title: string
  status: ProjectStatus
  created_at: string
  config: ProjectConfig
}

export interface UploadRequest {
  file: File | string
  options: {
    auto_segment: boolean
    use_llm_segment: boolean
  }
}

export interface UploadResponse {
  project_id: string
  parsed_content: {
    text: string
    word_count: number
    estimated_scenes: number
  }
  scenes: SceneData[]
}

export interface SceneData {
  id: string
  index: number
  text: string
  prompt?: string
  imageAssetId?: string
}

export interface RunJobRequest {
  config: {
    aspect_ratio: '9:16' | '16:9' | '1:1'
    template: 'classic' | 'dark' | 'vivid'
    voice: 'male' | 'female' | 'natural'
    images_per_scene: 1 | 2 | 3
    transitions: 'none' | 'fade' | 'zoom'
  }
  scenes: SceneData[]
}

export interface RunJobResponse {
  job_id: string
  estimated_cost: CostEstimate
  estimated_duration: number // seconds
  status: 'queued'
}

export interface JobStatusResponse {
  id: string
  project_id: string
  status: JobStatus
  progress: JobProgress
  cost: {
    estimated: CostEstimate
    actual: CostActual
  }
  assets: Asset[]
  error?: ErrorDetail
}

export interface JobProgress {
  current_step: string
  completed_steps: string[]
  total_steps: number
  percentage: number
  estimated_remaining_time?: number
}

export interface ErrorDetail {
  code: string
  message: string
  details?: any
  timestamp: string
  retryable: boolean
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Authentication and Authorization Types
export interface AuthUser {
  id: string
  email: string
  name?: string
  image?: string
  role: UserRole
  settings?: UserSettings
}

export interface UserSettings {
  language: string
  timezone: string
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    discord: boolean
    webhook: boolean
  }
  privacy: {
    analytics: boolean
    error_reporting: boolean
  }
  generation: {
    default_aspect_ratio: '9:16' | '16:9' | '1:1'
    default_template: 'classic' | 'dark' | 'vivid'
    default_voice: 'male' | 'female' | 'natural'
    images_per_scene: 1 | 2 | 3
    auto_segment: boolean
    use_llm_segment: boolean
  }
  safety: {
    content_policy: 'strict' | 'standard'
    blocked_words: string[]
    error_strategy: 'skip' | 'mask' | 'fail'
  }
}

export interface BYOApiKeys {
  gemini_api_key?: string
  openai_api_key?: string
  anthropic_api_key?: string
  created_at: string
  last_used_at?: string
}

export interface UserUsageStats {
  projects_today: number
  total_projects: number
  total_assets: number
  active_jobs: number
  last_activity?: Date
}

export interface AuthContext {
  userId: string
  userRole: UserRole
  email: string
}

// Permission Types
export type Permission = 
  | 'project:create'
  | 'project:read:own'
  | 'project:read:all'
  | 'project:update:own'
  | 'project:update:all'
  | 'project:delete:own'
  | 'project:delete:all'
  | 'job:create'
  | 'job:read:own'
  | 'job:read:all'
  | 'job:cancel:own'
  | 'job:cancel:all'
  | 'asset:read:own'
  | 'asset:read:all'
  | 'asset:delete:own'
  | 'asset:delete:all'
  | 'user:manage'
  | 'system:monitor'
  | 'settings:manage'
  | 'byo:api_key'
  | 'queue:priority'
  | 'templates:advanced'

// Default configuration
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  aspect_ratio: '9:16',
  template: {
    name: 'classic',
    transitions: 'fade',
    transition_duration: 500,
    background_music: true,
    bgm_volume: -18,
  },
  voice: {
    type: 'natural',
    speed: 1.0,
    language: 'zh-TW',
    accent: 'taiwan',
  },
  generation: {
    images_per_scene: 1,
    image_quality: 'standard',
    retry_attempts: 3,
    timeout_seconds: 300,
    smart_crop: true,
  },
  safety: {
    content_policy: 'standard',
    blocked_words: [],
    error_strategy: 'skip',
    adult_content: 'block',
    violence_filter: true,
  },
}

// Resolution constants
export const RESOLUTION_MAPPING: ResolutionMapping = {
  '9:16': { width: 1080, height: 1920, name: '直式短片' },
  '16:9': { width: 1920, height: 1080, name: '橫式影片' },
  '1:1': { width: 1080, height: 1080, name: '方形貼文' },
}