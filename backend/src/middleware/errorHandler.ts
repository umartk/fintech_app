import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }

  static fromZodError(zodError: ZodError): ValidationError {
    const errors: ValidationErrorDetail[] = zodError.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
    return new ValidationError('Validation failed', errors);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  retryAfter: number;

  constructor(message: string = 'Too many requests', retryAfter: number = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = ValidationError.fromZodError(err);
    return res.status(400).json({
      status: 'error',
      code: validationError.code,
      message: validationError.message,
      errors: validationError.errors,
    });
  }

  // Handle ValidationError
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      errors: err.errors,
    });
  }

  // Handle RateLimitError
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', err.retryAfter.toString());
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      retryAfter: err.retryAfter,
    });
  }

  // Handle other AppErrors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
};
