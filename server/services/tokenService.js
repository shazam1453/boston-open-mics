const crypto = require('crypto')

// In-memory token storage (in production, use Redis or DynamoDB)
const resetTokens = new Map()

class TokenService {
  // Generate a secure reset token
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  // Store reset token with expiration (1 hour)
  storeResetToken(email, token) {
    const expiresAt = Date.now() + (60 * 60 * 1000) // 1 hour
    resetTokens.set(token, {
      email,
      expiresAt,
      used: false
    })
    
    // Clean up expired tokens
    this.cleanupExpiredTokens()
    
    return token
  }

  // Validate and consume reset token
  validateResetToken(token) {
    const tokenData = resetTokens.get(token)
    
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' }
    }
    
    if (tokenData.used) {
      return { valid: false, error: 'Token already used' }
    }
    
    if (Date.now() > tokenData.expiresAt) {
      resetTokens.delete(token)
      return { valid: false, error: 'Token expired' }
    }
    
    // Mark token as used
    tokenData.used = true
    
    return { 
      valid: true, 
      email: tokenData.email 
    }
  }

  // Clean up expired tokens
  cleanupExpiredTokens() {
    const now = Date.now()
    for (const [token, data] of resetTokens.entries()) {
      if (now > data.expiresAt) {
        resetTokens.delete(token)
      }
    }
  }

  // Get token info (for testing)
  getTokenInfo(token) {
    return resetTokens.get(token)
  }

  // Clear all tokens (for testing)
  clearAllTokens() {
    resetTokens.clear()
  }
}

module.exports = new TokenService()