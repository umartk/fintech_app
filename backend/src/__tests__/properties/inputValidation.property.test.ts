import * as fc from 'fast-check';
import { z, ZodError } from 'zod';
import {
  emailSchema,
  passwordSchema,
  positiveAmountSchema,
  uuidSchema,
  signupSchema,
  loginSchema,
  createTransferSchema,
  paginationSchema,
} from '../../validation/schemas';
import { ValidationError } from '../../middleware/errorHandler';
import { propertyConfig } from './helpers';

/**
 * **Feature: fintech-mobile-app, Property 17: Input validation consistency**
 * **Validates: Requirements 11.1**
 * 
 * For any invalid input submitted to API endpoints, the system should validate
 * the input and return specific error messages with appropriate HTTP status codes.
 */
describe('Property 17: Input validation consistency', () => {
  describe('Email validation', () => {
    // Generate valid emails that conform to our stricter validation
    const validEmailArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 10 }),
        fc.constantFrom('com', 'org', 'net', 'io')
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    it('should accept all valid email formats', () => {
      fc.assert(
        fc.property(validEmailArb, (email) => {
          const result = emailSchema.safeParse(email);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject all strings without @ symbol', () => {
      const invalidEmailArb = fc.string({ minLength: 1 }).filter((s) => !s.includes('@'));
      
      fc.assert(
        fc.property(invalidEmailArb, (invalidEmail) => {
          const result = emailSchema.safeParse(invalidEmail);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject empty strings', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Password validation', () => {
    // Arbitrary for valid passwords (8+ chars, uppercase, lowercase, digit)
    // Ensure minimum 8 characters by using appropriate minLength values
    const validPasswordArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
        fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
      )
      .map(([upper, lower, digits]) => upper + lower + digits);

    it('should accept all valid passwords meeting requirements', () => {
      fc.assert(
        fc.property(validPasswordArb, (password) => {
          const result = passwordSchema.safeParse(password);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject all passwords shorter than 8 characters', () => {
      const shortPasswordArb = fc.string({ minLength: 1, maxLength: 7 });
      
      fc.assert(
        fc.property(shortPasswordArb, (shortPassword) => {
          const result = passwordSchema.safeParse(shortPassword);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject passwords without uppercase letters', () => {
      const noUpperArb = fc.stringOf(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'),
        { minLength: 8, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(noUpperArb, (password) => {
          const result = passwordSchema.safeParse(password);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject passwords without lowercase letters', () => {
      const noLowerArb = fc.stringOf(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
        { minLength: 8, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(noLowerArb, (password) => {
          const result = passwordSchema.safeParse(password);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject passwords without digits', () => {
      const noDigitArb = fc.stringOf(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
        { minLength: 8, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(noDigitArb, (password) => {
          const result = passwordSchema.safeParse(password);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  describe('UUID validation', () => {
    it('should accept all valid UUIDs', () => {
      fc.assert(
        fc.property(fc.uuid(), (uuid) => {
          const result = uuidSchema.safeParse(uuid);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject all non-UUID strings', () => {
      const nonUuidArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
        // Filter out strings that happen to be valid UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return !uuidRegex.test(s);
      });
      
      fc.assert(
        fc.property(nonUuidArb, (nonUuid) => {
          const result = uuidSchema.safeParse(nonUuid);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  describe('Amount validation', () => {
    // Arbitrary for valid amounts (positive, max 2 decimal places)
    const validAmountArb = fc
      .integer({ min: 1, max: 100000000000 }) // cents
      .map((cents) => cents / 100);

    it('should accept all valid positive amounts with up to 2 decimal places', () => {
      fc.assert(
        fc.property(validAmountArb, (amount) => {
          const result = positiveAmountSchema.safeParse(amount);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject all negative amounts', () => {
      const negativeAmountArb = fc.double({ min: -1000000, max: -0.01, noNaN: true });
      
      fc.assert(
        fc.property(negativeAmountArb, (amount) => {
          const result = positiveAmountSchema.safeParse(amount);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject zero amount', () => {
      const result = positiveAmountSchema.safeParse(0);
      expect(result.success).toBe(false);
    });
  });

  describe('Signup schema validation', () => {
    // Generate valid emails that conform to our stricter validation
    const validEmailForSignupArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 10 }),
        fc.constantFrom('com', 'org', 'net', 'io')
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    // Generate valid passwords (8+ chars with uppercase, lowercase, digit)
    const validPasswordForSignupArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
        fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
      )
      .map(([upper, lower, digits]) => upper + lower + digits);

    const validSignupArb = fc.record({
      email: validEmailForSignupArb,
      password: validPasswordForSignupArb,
    });

    it('should accept all valid signup inputs', () => {
      fc.assert(
        fc.property(validSignupArb, (input) => {
          const result = signupSchema.safeParse(input);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with invalid email', () => {
      const invalidEmailSignupArb = fc.record({
        email: fc.string({ minLength: 1 }).filter((s) => !s.includes('@')),
        password: fc.constant('ValidPass1'),
      });
      
      fc.assert(
        fc.property(invalidEmailSignupArb, (input) => {
          const result = signupSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with invalid password', () => {
      const invalidPasswordSignupArb = fc.record({
        email: fc.emailAddress(),
        password: fc.string({ minLength: 1, maxLength: 7 }), // Too short
      });
      
      fc.assert(
        fc.property(invalidPasswordSignupArb, (input) => {
          const result = signupSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  describe('Transfer schema validation', () => {
    const validTransferArb = fc.record({
      toUserId: fc.uuid(),
      amount: fc.integer({ min: 1, max: 100000000 }).map((cents) => cents / 100),
      description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
      idempotencyKey: fc.option(fc.uuid(), { nil: undefined }),
    });

    it('should accept all valid transfer inputs', () => {
      fc.assert(
        fc.property(validTransferArb, (input) => {
          const result = createTransferSchema.safeParse(input);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject transfers with invalid recipient UUID', () => {
      const invalidRecipientArb = fc.record({
        toUserId: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return !uuidRegex.test(s);
        }),
        amount: fc.constant(100),
      });
      
      fc.assert(
        fc.property(invalidRecipientArb, (input) => {
          const result = createTransferSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject transfers with negative amounts', () => {
      const negativeAmountArb = fc.record({
        toUserId: fc.uuid(),
        amount: fc.double({ min: -1000, max: -0.01, noNaN: true }),
      });
      
      fc.assert(
        fc.property(negativeAmountArb, (input) => {
          const result = createTransferSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  describe('Pagination schema validation', () => {
    const validPaginationArb = fc.record({
      page: fc.integer({ min: 1, max: 10000 }),
      limit: fc.integer({ min: 1, max: 100 }),
    });

    it('should accept all valid pagination inputs', () => {
      fc.assert(
        fc.property(validPaginationArb, (input) => {
          const result = paginationSchema.safeParse(input);
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject pagination with non-positive page numbers', () => {
      const invalidPageArb = fc.record({
        page: fc.integer({ min: -100, max: 0 }),
        limit: fc.constant(20),
      });
      
      fc.assert(
        fc.property(invalidPageArb, (input) => {
          const result = paginationSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject pagination with limit exceeding maximum', () => {
      const invalidLimitArb = fc.record({
        page: fc.constant(1),
        limit: fc.integer({ min: 101, max: 1000 }),
      });
      
      fc.assert(
        fc.property(invalidLimitArb, (input) => {
          const result = paginationSchema.safeParse(input);
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  describe('ValidationError creation', () => {
    it('should create ValidationError with correct status code for any ZodError', () => {
      const invalidInputArb = fc.record({
        email: fc.string({ minLength: 1 }).filter((s) => !s.includes('@')),
        password: fc.string({ minLength: 1, maxLength: 5 }),
      });
      
      fc.assert(
        fc.property(invalidInputArb, (input) => {
          const result = signupSchema.safeParse(input);
          if (!result.success) {
            const validationError = ValidationError.fromZodError(result.error);
            return (
              validationError.statusCode === 400 &&
              validationError.code === 'VALIDATION_ERROR' &&
              validationError.errors.length > 0 &&
              validationError.errors.every(
                (e) => typeof e.field === 'string' && typeof e.message === 'string'
              )
            );
          }
          return true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });
});
