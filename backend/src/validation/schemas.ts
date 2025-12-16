import { z } from 'zod';

// Common field validators
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email must be less than 255 characters');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const positiveAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(1000000000, 'Amount exceeds maximum limit')
  .refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) / 100 === val,
    'Amount must have at most 2 decimal places'
  );

export const currencySchema = z.enum(['USD', 'EUR', 'GBP'], {
  errorMap: () => ({ message: 'Invalid currency. Supported: USD, EUR, GBP' }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Auth schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const otpVerificationSchema = z.object({
  userId: uuidSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only digits'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Transaction schemas
export const createTransferSchema = z.object({
  toUserId: uuidSchema,
  amount: positiveAmountSchema,
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const transactionIdParamSchema = z.object({
  transactionId: uuidSchema,
});

// User schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  dateOfBirth: z.string().datetime().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// Payment method schemas
export const addPaymentMethodSchema = z.object({
  type: z.enum(['BANK_ACCOUNT', 'DEBIT_CARD', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Invalid payment method type' }),
  }),
  provider: z.string().min(1, 'Provider is required').max(100),
  accountNumber: z.string().min(4, 'Account number is required').max(20),
  routingNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
