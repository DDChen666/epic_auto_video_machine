import crypto from 'crypto'

/**
 * Encryption utilities for securing sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  
  // If key is hex-encoded, decode it
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  
  // Otherwise, hash the key to get consistent 32-byte key
  return crypto.createHash('sha256').update(key).digest()
}

/**
 * Generate a random encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Encrypt sensitive data using AES-256-CBC (simpler approach for testing)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16) // 16 bytes for AES-256-CBC
    const cipher = crypto.createCipher('aes-256-cbc', key)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Combine iv + encrypted data
    const combined = iv.toString('hex') + ':' + encrypted
    
    return Buffer.from(combined).toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64').toString()
    
    // Extract iv and encrypted data
    const [ivHex, encrypted] = combined.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    
    const decipher = crypto.createDecipher('aes-256-cbc', key)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hash(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512')
  return `${actualSalt}:${hash.toString('hex')}`
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const [salt, originalHash] = hashedData.split(':')
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512')
    return hash.toString('hex') === originalHash
  } catch (error) {
    return false
  }
}

/**
 * Encrypt API keys for storage
 */
export function encryptApiKey(apiKey: string): string {
  return encrypt(apiKey)
}

/**
 * Decrypt API keys from storage
 */
export function decryptApiKey(encryptedApiKey: string): string {
  return decrypt(encryptedApiKey)
}

/**
 * Encrypt user settings
 */
export function encryptUserSettings(settings: object): string {
  return encrypt(JSON.stringify(settings))
}

/**
 * Decrypt user settings
 */
export function decryptUserSettings(encryptedSettings: string): object {
  const decrypted = decrypt(encryptedSettings)
  return JSON.parse(decrypted)
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate API key with specific format
 */
export function generateApiKey(prefix: string = 'eavm'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return `${prefix}_${randomPart}`
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length)
  }
  
  const start = data.substring(0, visibleChars)
  const end = data.substring(data.length - visibleChars)
  const middle = '*'.repeat(data.length - visibleChars * 2)
  
  return `${start}${middle}${end}`
}

/**
 * Secure comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, expectedToken: string): boolean {
  return secureCompare(token, expectedToken)
}