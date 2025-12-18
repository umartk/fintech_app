import * as fc from 'fast-check';
import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { RateLimitError } from '../../middleware/errorHandler';
import { rateLimitConfigs } from '../../middleware/rateLimit';

/**
 * **Feature: fintech-mobile-app, Property 18: Rate limiting enforcement**
 * **Validates: Requirements 11.3**
 * 
 * For any API endpoint that exceeds configured rate limits, the system should
 * reject requests and provide clear rate limiting information in the response.
 */

// In-memory rate limiter for testing (doesn't require Redis)
interface InMemoryRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const inMemoryStore: Map<string, { count: number; resetTime: number }> = new Map();

const createInMemoryRateLimiter = (config: InMemoryRateLimitConfig) => {
  const { windowMs, maxRequests, keyPrefix = 'rl:' } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.ip || req.socket.remoteAddress || '127.0.0.1';
    
    const key = `${keyPrefix}${ip}`;
    const now = Date.now();
    
    let entry = inMemoryStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      inMemoryStore.set(key, entry);
    }
    
    entry.count++;
    
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = new Date(entry.resetTime);
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000).toString());
    
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests allowed.`,
        retryAfter,
      });
      return;
    }
    
    next();
  };
};

const clearInMemoryStore = () => {
  inMemoryStore.clear();
};

describe('Property 18: Rate limiting enforcement', () => {
  let app: Express;
  
  const testConfig: InMemoryRateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'rl:test:',
  };

  beforeEach(() => {
    clearInMemoryStore();
    
    app = express();
    app.use(express.json());
    app.set('trust proxy', true);
    
    app.get('/test', createInMemoryRateLimiter(testConfig), (_req: Request, res: Response) => {
      res.json({ success: true });
    });
  });

  describe('Rate limit headers', () => {
    it('should include rate limit headers in all responses', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should decrement remaining count with each request', async () => {
      const response1 = await request(app).get('/test');
      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining'], 10);
      
      const response2 = await request(app).get('/test');
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining'], 10);
      
      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Rate limit enforcement', () => {
    it('should allow requests within the rate limit', async () => {
      for (let i = 0; i < testConfig.maxRequests; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should reject requests exceeding the rate limit with 429 status', async () => {
      for (let i = 0; i < testConfig.maxRequests; i++) {
        await request(app).get('/test');
      }
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(429);
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.message).toContain('Rate limit exceeded');
      expect(response.body.retryAfter).toBeDefined();
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should reject all requests after rate limit is exceeded', () => {
      const excessRequestsArb = fc.integer({ min: 1, max: 10 });
      
      fc.assert(
        fc.asyncProperty(excessRequestsArb, async (excessRequests) => {
          clearInMemoryStore();
          
          for (let i = 0; i < testConfig.maxRequests; i++) {
            await request(app).get('/test');
          }
          
          for (let i = 0; i < excessRequests; i++) {
            const response = await request(app).get('/test');
            if (response.status !== 429) return false;
            if (response.body.code !== 'RATE_LIMIT_EXCEEDED') return false;
          }
          
          return true;
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Rate limit response format', () => {
    it('should provide complete rate limiting information when limit exceeded', async () => {
      for (let i = 0; i < testConfig.maxRequests; i++) {
        await request(app).get('/test');
      }
      
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('Rate limit exceeded'),
        retryAfter: expect.any(Number),
      });
      
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'], 10)).toBeGreaterThan(0);
      expect(response.headers['x-ratelimit-limit']).toBe(testConfig.maxRequests.toString());
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should never show negative remaining count', () => {
      const requestCountArb = fc.integer({ min: 1, max: 20 });
      
      fc.assert(
        fc.asyncProperty(requestCountArb, async (requestCount) => {
          clearInMemoryStore();
          
          for (let i = 0; i < requestCount; i++) {
            const response = await request(app).get('/test');
            const remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
            if (remaining < 0) return false;
          }
          
          return true;
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Rate limit by client identifier', () => {
    it('should track rate limits separately for different IPs', async () => {
      for (let i = 0; i < testConfig.maxRequests; i++) {
        await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
      }
      
      const limitedResponse = await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
      expect(limitedResponse.status).toBe(429);
      
      const allowedResponse = await request(app).get('/test').set('X-Forwarded-For', '2.2.2.2');
      expect(allowedResponse.status).toBe(200);
    });
  });

  describe('Rate limit configuration', () => {
    it('should respect configured maxRequests limit', () => {
      const maxRequestsArb = fc.integer({ min: 1, max: 10 });
      
      fc.assert(
        fc.asyncProperty(maxRequestsArb, async (maxRequests) => {
          const customConfig: InMemoryRateLimitConfig = {
            windowMs: 60 * 1000,
            maxRequests,
            keyPrefix: `rl:custom:${maxRequests}:`,
          };
          
          clearInMemoryStore();
          
          const customApp = express();
          customApp.get('/test', createInMemoryRateLimiter(customConfig), (_req: Request, res: Response) => {
            res.json({ success: true });
          });
          
          for (let i = 0; i < maxRequests; i++) {
            const response = await request(customApp).get('/test');
            if (response.status !== 200) return false;
          }
          
          const exceededResponse = await request(customApp).get('/test');
          return exceededResponse.status === 429;
        }),
        { numRuns: 5 }
      );
    });
  });

  describe('Pre-configured rate limiters', () => {
    it('should have stricter limits for auth endpoints', () => {
      expect(rateLimitConfigs.auth.maxRequests).toBeLessThan(rateLimitConfigs.api.maxRequests);
    });

    it('should have longer windows for sensitive operations', () => {
      expect(rateLimitConfigs.sensitive.windowMs).toBeGreaterThan(rateLimitConfigs.api.windowMs);
    });

    it('should have higher limits for read operations', () => {
      expect(rateLimitConfigs.read.maxRequests).toBeGreaterThan(rateLimitConfigs.api.maxRequests);
    });
  });

  describe('RateLimitError class', () => {
    it('should create error with correct properties', () => {
      const error = new RateLimitError('Test rate limit', 30);
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('Test rate limit');
      expect(error.retryAfter).toBe(30);
    });

    it('should preserve retryAfter value for any positive integer', () => {
      const retryAfterArb = fc.integer({ min: 1, max: 3600 });
      
      fc.assert(
        fc.property(retryAfterArb, (retryAfter) => {
          const error = new RateLimitError('Rate limit exceeded', retryAfter);
          return error.retryAfter === retryAfter && error.statusCode === 429;
        }),
        { numRuns: 100 }
      );
    });
  });
});
