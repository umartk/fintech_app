import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { AddPaymentMethodInput } from '../validation/schemas';
import { PaymentMethodType } from '@prisma/client';
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

export interface PaymentMethodResponse {
  id: string;
  type: PaymentMethodType;
  provider: string;
  maskedAccountNumber: string;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export class PaymentMethodService {
  /**
   * Encrypt sensitive payment data
   * Validates: Requirements 7.1
   */
  encryptData(data: string): string {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return iv:authTag:encrypted format
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt sensitive payment data
   */
  decryptData(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Mask account number for display
   * Validates: Requirements 7.4
   */
  maskAccountNumber(accountNumber: string): string {
    // For short account numbers (4 or fewer digits), show last 4 or all if shorter
    if (accountNumber.length <= 4) {
      return accountNumber; // Show full number if 4 or fewer digits
    }
    const lastFour = accountNumber.slice(-4);
    const maskedPart = '*'.repeat(accountNumber.length - 4);
    return maskedPart + lastFour;
  }


  /**
   * Validate payment method format
   * Validates: Requirements 7.2
   */
  validatePaymentMethod(input: AddPaymentMethodInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate based on type
    if (input.type === 'BANK_ACCOUNT') {
      if (!input.routingNumber) {
        errors.push('Routing number is required for bank accounts');
      } else if (!/^\d{9}$/.test(input.routingNumber)) {
        errors.push('Routing number must be 9 digits');
      }
      if (!/^\d{4,17}$/.test(input.accountNumber)) {
        errors.push('Bank account number must be 4-17 digits');
      }
    } else if (input.type === 'DEBIT_CARD' || input.type === 'CREDIT_CARD') {
      // Validate card number (basic Luhn check)
      if (!/^\d{13,19}$/.test(input.accountNumber)) {
        errors.push('Card number must be 13-19 digits');
      } else if (!this.isValidLuhn(input.accountNumber)) {
        errors.push('Invalid card number');
      }
      if (!input.expiryDate) {
        errors.push('Expiry date is required for cards');
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(input.expiryDate)) {
        errors.push('Expiry date must be in MM/YY format');
      } else {
        // Check if card is expired
        const [month, year] = input.expiryDate.split('/');
        const expiry = new Date(2000 + parseInt(year), parseInt(month), 0);
        if (expiry < new Date()) {
          errors.push('Card has expired');
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Luhn algorithm for card validation
   */
  private isValidLuhn(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Mock verification for payment methods
   * Validates: Requirements 7.2, 7.5
   */
  async mockVerifyPaymentMethod(paymentMethodId: string): Promise<boolean> {
    // In production, this would call external payment provider APIs
    // For development, we simulate verification with a delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock: 95% success rate for verification
    const isVerified = Math.random() > 0.05;
    
    if (isVerified) {
      await prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isVerified: true },
      });
    }
    
    return isVerified;
  }

  /**
   * Add a new payment method
   * Validates: Requirements 7.1, 7.2
   */
  async addPaymentMethod(
    userId: string,
    input: AddPaymentMethodInput
  ): Promise<PaymentMethodResponse> {
    // Validate payment method format
    const validation = this.validatePaymentMethod(input);
    if (!validation.isValid) {
      throw new ValidationError(
        'Payment method validation failed',
        validation.errors.map((msg, idx) => ({
          field: `paymentMethod.${idx}`,
          message: msg,
          code: 'INVALID_PAYMENT_METHOD',
        }))
      );
    }

    // Encrypt sensitive data
    const sensitiveData = JSON.stringify({
      accountNumber: input.accountNumber,
      routingNumber: input.routingNumber,
      expiryDate: input.expiryDate,
    });
    const encryptedData = this.encryptData(sensitiveData);

    // Mask account number for display
    const maskedAccountNumber = this.maskAccountNumber(input.accountNumber);

    // Check if this is the first payment method (make it default)
    const existingMethods = await prisma.paymentMethod.count({
      where: { userId, isActive: true },
    });
    const isDefault = existingMethods === 0;

    // Create payment method
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId,
        type: input.type as PaymentMethodType,
        provider: input.provider,
        maskedAccountNumber,
        encryptedData,
        isDefault,
        isVerified: false,
        isActive: true,
      },
    });

    // Trigger mock verification (fire and forget in production)
    // Note: In tests, this may complete after cleanup, which is expected
    if (process.env.NODE_ENV !== 'test') {
      this.mockVerifyPaymentMethod(paymentMethod.id).catch(() => {
        // Log verification failure but don't block
      });
    }

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      provider: paymentMethod.provider,
      maskedAccountNumber: paymentMethod.maskedAccountNumber,
      isVerified: paymentMethod.isVerified,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt,
    };
  }


  /**
   * List payment methods for a user with masked data
   * Validates: Requirements 7.4
   */
  async listPaymentMethods(userId: string): Promise<PaymentMethodResponse[]> {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return paymentMethods.map(pm => ({
      id: pm.id,
      type: pm.type,
      provider: pm.provider,
      maskedAccountNumber: pm.maskedAccountNumber,
      isVerified: pm.isVerified,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt,
    }));
  }

  /**
   * Get a single payment method by ID
   */
  async getPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethodResponse> {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!paymentMethod) {
      throw new NotFoundError('Payment method not found');
    }

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      provider: paymentMethod.provider,
      maskedAccountNumber: paymentMethod.maskedAccountNumber,
      isVerified: paymentMethod.isVerified,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt,
    };
  }

  /**
   * Remove (deactivate) a payment method while preserving history
   * Validates: Requirements 7.3
   */
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!paymentMethod) {
      throw new NotFoundError('Payment method not found');
    }

    // Deactivate instead of delete to preserve transaction history
    await prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isActive: false, isDefault: false },
    });

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const nextDefault = await prisma.paymentMethod.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (nextDefault) {
        await prisma.paymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }
  }

  /**
   * Set a payment method as default
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethodResponse> {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!paymentMethod) {
      throw new NotFoundError('Payment method not found');
    }

    // Remove default from all other payment methods
    await prisma.paymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    const updated = await prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });

    return {
      id: updated.id,
      type: updated.type,
      provider: updated.provider,
      maskedAccountNumber: updated.maskedAccountNumber,
      isVerified: updated.isVerified,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
    };
  }
}

export const paymentMethodService = new PaymentMethodService();
export default paymentMethodService;
