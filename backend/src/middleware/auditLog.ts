import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'LOGOUT_ALL_DEVICES'
  | 'SIGNUP'
  | 'OTP_VERIFICATION'
  | 'OTP_VERIFICATION_FAILURE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_CHANGE_FAILURE'
  | 'TOKEN_REFRESH'
  | 'TOKEN_REFRESH_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_FAILURE'
  | 'PAYMENT_METHOD_ADDED'
  | 'PAYMENT_METHOD_REMOVED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_FAILED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PROFILE_UPDATE'
  | 'SECURITY_SETTINGS_CHANGE';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: SecurityEventType;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details?: Record<string, unknown>;
  success: boolean;
  correlationId?: string;
}

export interface AuditLogRequest extends Request {
  auditContext?: {
    correlationId: string;
    startTime: number;
  };
}

// In-memory audit log storage (in production, use a database or log aggregation service)
const auditLogs: AuditLogEntry[] = [];
const MAX_LOGS = 10000; // Keep last 10000 logs in memory

/**
 * Get client IP address from request
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Get user ID from authenticated request
 */
const getUserId = (req: Request): string | undefined => {
  const user = (req as Request & { user?: { userId: string } }).user;
  return user?.userId;
};

/**
 * Log a security event
 */
export const logSecurityEvent = (
  eventType: SecurityEventType,
  req: Request,
  options: {
    userId?: string;
    success?: boolean;
    details?: Record<string, unknown>;
    resource?: string;
    action?: string;
  } = {}
): AuditLogEntry => {
  const auditReq = req as AuditLogRequest;
  
  const entry: AuditLogEntry = {
    id: uuidv4(),
    timestamp: new Date(),
    eventType,
    userId: options.userId || getUserId(req),
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    resource: options.resource || req.originalUrl,
    action: options.action || req.method,
    details: options.details,
    success: options.success ?? true,
    correlationId: auditReq.auditContext?.correlationId,
  };

  // Add to in-memory storage
  auditLogs.push(entry);
  
  // Trim old logs if exceeding max
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_LOGS);
  }

  // Log to console in structured format
  const logLevel = entry.success ? 'info' : 'warn';
  const logMessage = {
    level: logLevel,
    type: 'SECURITY_AUDIT',
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };
  
  if (entry.success) {
    console.log(JSON.stringify(logMessage));
  } else {
    console.warn(JSON.stringify(logMessage));
  }

  return entry;
};

/**
 * Middleware to add correlation ID and audit context to requests
 */
export const auditContext = (
  req: AuditLogRequest,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  
  req.auditContext = {
    correlationId,
    startTime: Date.now(),
  };
  
  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

/**
 * Middleware to log security events for specific routes
 */
export const auditSecurityEvent = (eventType: SecurityEventType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store the original end function
    const originalEnd = res.end.bind(res);
    
    // Override end to capture response
    res.end = function(
      this: Response,
      chunk?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void
    ): Response {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      const auditReq = req as AuditLogRequest;
      
      logSecurityEvent(eventType, req, {
        success,
        details: {
          statusCode: res.statusCode,
          responseTime: auditReq.auditContext 
            ? Date.now() - auditReq.auditContext.startTime 
            : undefined,
        },
      });
      
      // Handle different overload signatures
      if (typeof encodingOrCb === 'function') {
        return originalEnd(chunk, encodingOrCb);
      }
      if (encodingOrCb) {
        return originalEnd(chunk, encodingOrCb, cb);
      }
      return originalEnd(chunk, cb);
    } as Response['end'];
    
    next();
  };
};

/**
 * Get audit logs with optional filtering
 */
export const getAuditLogs = (options: {
  userId?: string;
  eventType?: SecurityEventType;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
} = {}): { logs: AuditLogEntry[]; total: number } => {
  let filtered = [...auditLogs];
  
  if (options.userId) {
    filtered = filtered.filter((log) => log.userId === options.userId);
  }
  
  if (options.eventType) {
    filtered = filtered.filter((log) => log.eventType === options.eventType);
  }
  
  if (options.startDate) {
    filtered = filtered.filter((log) => log.timestamp >= options.startDate!);
  }
  
  if (options.endDate) {
    filtered = filtered.filter((log) => log.timestamp <= options.endDate!);
  }
  
  if (options.success !== undefined) {
    filtered = filtered.filter((log) => log.success === options.success);
  }
  
  // Sort by timestamp descending (most recent first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  const total = filtered.length;
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  
  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  };
};

/**
 * Clear audit logs (for testing purposes)
 */
export const clearAuditLogs = (): void => {
  auditLogs.length = 0;
};

/**
 * Get audit log count by event type
 */
export const getAuditLogStats = (): Record<SecurityEventType, { total: number; success: number; failure: number }> => {
  const stats: Record<string, { total: number; success: number; failure: number }> = {};
  
  for (const log of auditLogs) {
    if (!stats[log.eventType]) {
      stats[log.eventType] = { total: 0, success: 0, failure: 0 };
    }
    stats[log.eventType].total++;
    if (log.success) {
      stats[log.eventType].success++;
    } else {
      stats[log.eventType].failure++;
    }
  }
  
  return stats as Record<SecurityEventType, { total: number; success: number; failure: number }>;
};

export default {
  logSecurityEvent,
  auditContext,
  auditSecurityEvent,
  getAuditLogs,
  clearAuditLogs,
  getAuditLogStats,
};
