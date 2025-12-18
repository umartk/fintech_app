import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import { RateLimitError } from './errorHandler';

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyPrefix?: string;    // Redis key prefix
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'rl:auth:',
  },
  // Standard rate limiting for API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'rl:api:',
  },
  // Relaxed rate limiting for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyPrefix: 'rl:read:',
  },
  // Very strict rate limiting for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyPrefix: 'rl:sensitive:',
  },
};

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP
 */
const getClientIdentifier = (req: Request): string => {
  // Check for authenticated user
  const user = (req as Request & { user?: { userId: string } }).user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  
  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.ip || req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
};

/**
 * Redis-based rate limiting middleware factory
 * 
 * @param config - Rate limit configuration
 * @returns Express middleware function
 */
export const rateLimit = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rl:',
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = getClientIdentifier(req);
      const key = `${keyPrefix}${clientId}`;
      
      // Use Redis MULTI for atomic operations
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      
      if (!results) {
        // Redis error - allow request but log warning
        console.warn('Rate limit check failed - Redis unavailable');
        return next();
      }
      
      const [[incrErr, currentCount], [ttlErr, ttl]] = results as [[Error | null, number], [Error | null, number]];
      
      if (incrErr || ttlErr) {
        console.warn('Rate limit Redis error:', incrErr || ttlErr);
        return next();
      }
      
      // Set expiry if this is the first request in the window
      if (ttl === -1) {
        await redis.expire(key, windowSeconds);
      }
      
      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowMs));
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000).toString());
      
      // Check if rate limit exceeded
      if (currentCount > maxRequests) {
        const retryAfter = ttl > 0 ? ttl : windowSeconds;
        throw new RateLimitError(
          `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds allowed.`,
          retryAfter
        );
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return next(error);
      }
      // Log error but don't block request on Redis failures
      console.error('Rate limit middleware error:', error);
      next();
    }
  };
};

/**
 * Get current rate limit info for a client
 */
export const getRateLimitInfo = async (
  req: Request,
  config: RateLimitConfig
): Promise<RateLimitInfo | null> => {
  try {
    const clientId = getClientIdentifier(req);
    const key = `${config.keyPrefix || 'rl:'}${clientId}`;
    
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    
    const results = await pipeline.exec();
    
    if (!results) {
      return null;
    }
    
    const [[, countStr], [, ttl]] = results as [[Error | null, string | null], [Error | null, number]];
    const current = countStr ? parseInt(countStr, 10) : 0;
    const windowMs = config.windowMs;
    
    return {
      limit: config.maxRequests,
      current,
      remaining: Math.max(0, config.maxRequests - current),
      resetTime: new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowMs)),
    };
  } catch (error) {
    console.error('Error getting rate limit info:', error);
    return null;
  }
};

/**
 * Reset rate limit for a specific client (useful for testing or admin actions)
 */
export const resetRateLimit = async (
  clientId: string,
  keyPrefix: string = 'rl:'
): Promise<boolean> => {
  try {
    const key = `${keyPrefix}${clientId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
};

/**
 * Pre-configured rate limiters for common use cases
 */
export const authRateLimiter = rateLimit(rateLimitConfigs.auth);
export const apiRateLimiter = rateLimit(rateLimitConfigs.api);
export const readRateLimiter = rateLimit(rateLimitConfigs.read);
export const sensitiveRateLimiter = rateLimit(rateLimitConfigs.sensitive);

export default rateLimit;
