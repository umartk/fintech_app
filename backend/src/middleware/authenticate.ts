import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticationError, AuthorizationError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to authenticate requests using JWT access token
 */
export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyAccessToken(token);
    
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new AuthenticationError('Not authenticated'));
  }
  
  if (req.user.role !== 'ADMIN') {
    return next(new AuthorizationError('Admin access required'));
  }
  
  next();
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = authService.verifyAccessToken(token);
      
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }
    
    next();
  } catch {
    // Ignore authentication errors for optional auth
    next();
  }
};

export default authenticate;
