import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, ValidationErrorDetail } from './errorHandler';

export type ValidationTarget = 'body' | 'query' | 'params';

export interface ValidateOptions {
  target?: ValidationTarget;
  stripUnknown?: boolean;
}

/**
 * Middleware factory for validating request data against a Zod schema.
 * Returns specific error messages with appropriate HTTP status codes.
 * 
 * @param schema - Zod schema to validate against
 * @param options - Validation options (target: body, query, or params)
 */
export const validateInput = <T>(
  schema: ZodSchema<T>,
  options: ValidateOptions = {}
) => {
  const { target = 'body', stripUnknown = true } = options;

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      
      const parseOptions = stripUnknown ? { strict: false } : { strict: true };
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace the request data with validated/transformed data
      req[target] = validated as typeof req[typeof target];
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationErrorDetail[] = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validates multiple targets (body, query, params) with different schemas
 */
export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const allErrors: ValidationErrorDetail[] = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (schema) {
        try {
          const validationTarget = target as ValidationTarget;
          const dataToValidate = req[validationTarget];
          const validated = await schema.parseAsync(dataToValidate);
          (req as unknown as Record<string, unknown>)[validationTarget] = validated;
        } catch (error) {
          if (error instanceof ZodError) {
            const errors = error.errors.map((err) => ({
              field: `${target}.${err.path.join('.')}`,
              message: err.message,
              code: err.code,
            }));
            allErrors.push(...errors);
          } else {
            return next(error);
          }
        }
      }
    }

    if (allErrors.length > 0) {
      return next(new ValidationError('Validation failed', allErrors));
    }

    next();
  };
};

export default validateInput;
