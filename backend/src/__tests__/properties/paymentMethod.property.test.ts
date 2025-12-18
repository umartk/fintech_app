import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { PaymentMethodService } from '../../services/paymentMethod.service';
import { AuthService } from '../../services/auth.service';

let prisma: PrismaClient;
let paymentMethodService: PaymentMethodService;
let authService: AuthService;
let isDatabaseAvailable = false;

// Helper to clean up test data
async function cleanupTestUser(email: string) {
  if (!isDatabaseAvailable) return;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Generate valid passwords
const validPasswordArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
    fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
  )
  .map(([upper, lower, digits]) => upper + lower + digits);

// Generate valid bank account numbers (4-17 digits)
const bankAccountNumberArbitrary = fc.stringOf(
  fc.constantFrom(...'0123456789'),
  { minLength: 4, maxLength: 17 }
);

// Generate valid routing numbers (9 digits)
const routingNumberArbitrary = fc.stringOf(
  fc.constantFrom(...'0123456789'),
  { minLength: 9, maxLength: 9 }
);


// Generate valid card numbers using Luhn algorithm
function generateLuhnValidNumber(prefix: string, length: number): string {
  const partialNumber = prefix + Array(length - prefix.length - 1)
    .fill(0)
    .map(() => Math.floor(Math.random() * 10))
    .join('');
  
  // Calculate Luhn check digit
  let sum = 0;
  let isEven = true;
  for (let i = partialNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(partialNumber[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partialNumber + checkDigit;
}

// Generate valid card numbers (Luhn-valid)
const cardNumberArbitrary = fc
  .constantFrom('4', '5', '37', '6011')
  .map(prefix => generateLuhnValidNumber(prefix, prefix === '37' ? 15 : 16));

// Generate valid expiry dates (future dates)
const expiryDateArbitrary = fc
  .tuple(
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 25, max: 35 }) // Years 2025-2035
  )
  .map(([month, year]) => `${month.toString().padStart(2, '0')}/${year}`);

// Generate provider names
const providerArbitrary = fc.constantFrom('Chase', 'Bank of America', 'Wells Fargo', 'Visa', 'Mastercard');

describe('Payment Method Property Tests', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    paymentMethodService = new PaymentMethodService();
    authService = new AuthService();
    
    try {
      await prisma.$connect();
      isDatabaseAvailable = true;
    } catch {
      isDatabaseAvailable = false;
      console.warn('Database not available - skipping database-dependent tests');
    }
  });

  afterAll(async () => {
    if (isDatabaseAvailable) {
      await prisma.$disconnect();
    }
  });

  /**
   * **Feature: fintech-mobile-app, Property 13: Payment method security**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * For any payment method added to the system, sensitive data should be 
   * encrypted in storage and only masked versions should be displayed to users.
   */
  describe('Property 13: Payment method security', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should encrypt sensitive data and mask account numbers for bank accounts', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          validPasswordArbitrary,
          bankAccountNumberArbitrary,
          routingNumberArbitrary,
          providerArbitrary,
          async (password, accountNumber, routingNumber, provider) => {
            // Generate unique email for each iteration
            const email = `test_pm_bank_${Date.now()}_${Math.random().toString(36).slice(2)}@testdomain.com`;
            testEmails.push(email);
            
            try {
              // Create and activate user
              const signupResult = await authService.signup(email, password);
              const otpRecord = await prisma.otpCode.findFirst({
                where: { userId: signupResult.userId, verified: false },
              });
              await authService.verifyOTP(signupResult.userId, otpRecord!.code);
              
              // Add payment method
              const paymentMethod = await paymentMethodService.addPaymentMethod(
                signupResult.userId,
                {
                  type: 'BANK_ACCOUNT',
                  provider,
                  accountNumber,
                  routingNumber,
                }
              );
              
              // Verify masked account number is returned (not the original)
              expect(paymentMethod.maskedAccountNumber).not.toBe(accountNumber);
              
              // Verify masking shows only last 4 digits
              const lastFour = accountNumber.slice(-4);
              expect(paymentMethod.maskedAccountNumber.endsWith(lastFour)).toBe(true);
              expect(paymentMethod.maskedAccountNumber.slice(0, -4)).toMatch(/^\*+$/);
              
              // Verify encrypted data in database is not plain text
              const dbRecord = await prisma.paymentMethod.findUnique({
                where: { id: paymentMethod.id },
              });
              expect(dbRecord).not.toBeNull();
              expect(dbRecord!.encryptedData).not.toContain(accountNumber);
              expect(dbRecord!.encryptedData).not.toContain(routingNumber);
              
              // Verify encrypted data can be decrypted back to original
              const decrypted = paymentMethodService.decryptData(dbRecord!.encryptedData);
              const decryptedData = JSON.parse(decrypted);
              expect(decryptedData.accountNumber).toBe(accountNumber);
              expect(decryptedData.routingNumber).toBe(routingNumber);
              
              return true;
            } finally {
              // Always cleanup
              await cleanupTestUser(email);
            }
          }
        ),
        { numRuns: 5 }
      );
    });


    it('should encrypt sensitive data and mask card numbers for cards', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          validPasswordArbitrary,
          cardNumberArbitrary,
          expiryDateArbitrary,
          providerArbitrary,
          async (password, cardNumber, expiryDate, provider) => {
            // Generate unique email for each iteration
            const email = `test_pm_card_${Date.now()}_${Math.random().toString(36).slice(2)}@testdomain.com`;
            testEmails.push(email);
            
            try {
              // Create and activate user
              const signupResult = await authService.signup(email, password);
              const otpRecord = await prisma.otpCode.findFirst({
                where: { userId: signupResult.userId, verified: false },
              });
              await authService.verifyOTP(signupResult.userId, otpRecord!.code);
              
              // Add payment method (card)
              const paymentMethod = await paymentMethodService.addPaymentMethod(
                signupResult.userId,
                {
                  type: 'DEBIT_CARD',
                  provider,
                  accountNumber: cardNumber,
                  expiryDate,
                }
              );
              
              // Verify masked card number is returned (not the original)
              expect(paymentMethod.maskedAccountNumber).not.toBe(cardNumber);
              
              // Verify masking shows only last 4 digits
              const lastFour = cardNumber.slice(-4);
              expect(paymentMethod.maskedAccountNumber.endsWith(lastFour)).toBe(true);
              expect(paymentMethod.maskedAccountNumber.slice(0, -4)).toMatch(/^\*+$/);
              
              // Verify encrypted data in database is not plain text
              const dbRecord = await prisma.paymentMethod.findUnique({
                where: { id: paymentMethod.id },
              });
              expect(dbRecord).not.toBeNull();
              expect(dbRecord!.encryptedData).not.toContain(cardNumber);
              expect(dbRecord!.encryptedData).not.toContain(expiryDate);
              
              // Verify encrypted data can be decrypted back to original
              const decrypted = paymentMethodService.decryptData(dbRecord!.encryptedData);
              const decryptedData = JSON.parse(decrypted);
              expect(decryptedData.accountNumber).toBe(cardNumber);
              expect(decryptedData.expiryDate).toBe(expiryDate);
              
              return true;
            } finally {
              // Always cleanup
              await cleanupTestUser(email);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should mask account numbers correctly for any length', () => {
      // Test masking without database
      fc.assert(
        fc.property(
          // Use minLength: 5 to ensure we have something to mask
          fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 5, maxLength: 20 }),
          (accountNumber) => {
            const masked = paymentMethodService.maskAccountNumber(accountNumber);
            
            // Masked should be same length as original
            expect(masked.length).toBe(accountNumber.length);
            
            // Last 4 digits should be visible
            expect(masked.slice(-4)).toBe(accountNumber.slice(-4));
            
            // Rest should be asterisks
            expect(masked.slice(0, -4)).toMatch(/^\*+$/);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encrypt and decrypt data correctly for any input', () => {
      // Test encryption round-trip without database
      fc.assert(
        fc.property(
          fc.json(),
          (data) => {
            const jsonString = JSON.stringify(data);
            const encrypted = paymentMethodService.encryptData(jsonString);
            
            // Encrypted should be different from original
            expect(encrypted).not.toBe(jsonString);
            
            // Encrypted should have expected format (iv:authTag:data)
            expect(encrypted.split(':').length).toBe(3);
            
            // Decrypted should match original
            const decrypted = paymentMethodService.decryptData(encrypted);
            expect(decrypted).toBe(jsonString);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should list payment methods with masked data only', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      const email = `list_pm_test_${Date.now()}@testdomain.com`;
      testEmails.push(email);
      
      // Create and activate user
      const signupResult = await authService.signup(email, 'ValidPass123');
      const otpRecord = await prisma.otpCode.findFirst({
        where: { userId: signupResult.userId, verified: false },
      });
      await authService.verifyOTP(signupResult.userId, otpRecord!.code);
      
      // Add multiple payment methods
      const accountNumbers = ['1234567890123456', '9876543210987654'];
      for (const accountNumber of accountNumbers) {
        await paymentMethodService.addPaymentMethod(signupResult.userId, {
          type: 'BANK_ACCOUNT',
          provider: 'Test Bank',
          accountNumber,
          routingNumber: '123456789',
        });
      }
      
      // List payment methods
      const methods = await paymentMethodService.listPaymentMethods(signupResult.userId);
      
      // Verify all returned data is masked
      for (const method of methods) {
        // Should not contain full account numbers
        for (const accountNumber of accountNumbers) {
          expect(method.maskedAccountNumber).not.toBe(accountNumber);
        }
        // Should only show last 4 digits
        expect(method.maskedAccountNumber.slice(0, -4)).toMatch(/^\*+$/);
      }
    });
  });
});
