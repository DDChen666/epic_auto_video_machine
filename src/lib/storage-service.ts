import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Storage service for Cloudflare R2 integration
 */
export class StorageService {
  private s3Client: S3Client
  private bucketName: string
  private endpoint: string

  constructor() {
    // Validate required environment variables
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT

    if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
      throw new Error('Missing required Cloudflare R2 environment variables')
    }

    this.bucketName = bucketName
    this.endpoint = endpoint

    // Initialize S3 client for Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto', // Cloudflare R2 uses 'auto' region
      endpoint: endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  /**
   * Upload file to R2 storage
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      })

      await this.s3Client.send(command)
      
      // Return the storage URI
      return `r2://${this.bucketName}/${key}`
    } catch (error) {
      console.error('Error uploading file to R2:', error)
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload text content as file
   */
  async uploadTextFile(
    key: string,
    content: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const buffer = Buffer.from(content, 'utf-8')
    return this.uploadFile(key, buffer, 'text/plain', metadata)
  }

  /**
   * Upload JSON content as file
   */
  async uploadJsonFile(
    key: string,
    data: any,
    metadata?: Record<string, string>
  ): Promise<string> {
    const content = JSON.stringify(data, null, 2)
    const buffer = Buffer.from(content, 'utf-8')
    return this.uploadFile(key, buffer, 'application/json', metadata)
  }

  /**
   * Generate signed URL for file access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })

      return await getSignedUrl(this.s3Client, command, { expiresIn })
    } catch (error) {
      console.error('Error generating signed URL:', error)
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })

      await this.s3Client.send(command)
    } catch (error) {
      console.error('Error deleting file from R2:', error)
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate storage key for uploaded files
   */
  generateFileKey(userId: string, projectId: string, filename: string, type: 'original' | 'processed' = 'original'): string {
    const timestamp = Date.now()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `uploads/${userId}/${projectId}/${type}/${timestamp}_${sanitizedFilename}`
  }

  /**
   * Generate storage key for processed content
   */
  generateContentKey(userId: string, projectId: string, contentType: 'scenes' | 'prompts' | 'metadata'): string {
    const timestamp = Date.now()
    return `content/${userId}/${projectId}/${contentType}/${timestamp}.json`
  }

  /**
   * Extract key from storage URI
   */
  extractKeyFromUri(uri: string): string {
    if (uri.startsWith('r2://')) {
      const parts = uri.split('/')
      return parts.slice(2).join('/') // Remove 'r2://' and bucket name
    }
    return uri
  }

  /**
   * Check if storage is properly configured
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to list objects in the bucket (with limit 1)
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      console.error('Storage health check failed:', error)
      return false
    }
  }
}