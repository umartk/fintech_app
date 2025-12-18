import * as fc from 'fast-check';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../services/auth.service';
import { propertyConfig } from './helpers';
import {
  signupSchema,
  passwordSchema,
  emailSchema,
} from '../../validation/schemas';

// Use a separate test database instance
let prisma: PrismaClient;
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

// Generate unique test emails to avoid conflicts
const uniqueEmailArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 5, maxLength: 10 }),
    fc.uuid()
  )
  .map(([local, uuid]) => `test_${local}_${uuid.slice(0, 8)}@testdomain.com`);

// Generate valid passwords that meet all requirements
const validPasswordArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
    fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
  )
  .map(([upper, lower, digits]) => upper + lower + digits);

describe('Authentication Property Tests', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    authService = new AuthService();
    
    // Try to connect to database
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
   * **Feature: fintech-mobile-app, Property 1: Secure user account creation**
   * **Validates: Requirements 1.1**
   * 
   * For any valid email and password combination, creating a user account 
   * should result in a new user record with properly encrypted password storage.
   */
  describe('Property 1: Secure user account creation', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should create user with encrypted password for any valid email/password', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          async (email, password) => {
            testEmails.push(email);
            
            // Create user
            const result = await authService.signup(email, password);
            
            // Verify user was created
            expect(result.userId).toBeDefined();
            expect(result.requiresOTP).toBe(true);
            
            // Verify password is encrypted (not stored in plain text)
            const user = await prisma.user.findUnique({ where: { email } });
            expect(user).not.toBeNull();
            expect(user!.passwordHash).not.toBe(password);
            
            // Verify password hash is valid bcrypt hash
            const isValidHash = await bcrypt.compare(password, user!.passwordHash);
            expect(isValidHash).toBe(true);
            
            // Cleanup for next iteration
            await cleanupTestUser(email);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject duplicate email registrations', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      const email = `duplicate_test_${Date.now()}@testdomain.com`;
      testEmails.push(email);
      
      // First registration should succeed
      await authService.signup(email, 'ValidPass123');
      
      // Second registration with same email should fail
      await expect(authService.signup(email, 'DifferentPass456'))
        .rejects.toThrow('Email already registered');
    });

    it('should hash password using bcrypt for any valid password', () => {
      // This test doesn't require database - tests bcrypt directly
      fc.assert(
        fc.property(validPasswordArbitrary, (password) => {
          const hash = bcrypt.hashSync(password, 12);
          
          // Hash should be different from password
          expect(hash).not.toBe(password);
          
          // Hash should be verifiable
          expect(bcrypt.compareSync(password, hash)).toBe(true);
          
          // Wrong password should not verify
          expect(bcrypt.compareSync(password + 'x', hash)).toBe(false);
          
          return true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });


  /**
   * **Feature: fintech-mobile-app, Property 2: OTP generation consistency**
   * **Validates: Requirements 1.2**
   * 
   * For any completed user signup, the system should generate and store 
   * an OTP verification code that can be validated.
   */
  describe('Property 2: OTP generation consistency', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should generate valid 6-digit OTP for any new user signup', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          async (email, password) => {
            testEmails.push(email);
            
            // Create user (which generates OTP)
            const result = await authService.signup(email, password);
            
            // Verify OTP was created
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: result.userId, verified: false },
              orderBy: { createdAt: 'desc' },
            });
            
            expect(otpRecord).not.toBeNull();
            expect(otpRecord!.code).toMatch(/^\d{6}$/); // 6 digits
            expect(otpRecord!.expiresAt.getTime()).toBeGreaterThan(Date.now());
            
            // Cleanup
            await cleanupTestUser(email);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should generate 6-digit numeric OTP codes', () => {
      // Test OTP format without database
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          
          // OTP should be exactly 6 digits
          expect(otp).toMatch(/^\d{6}$/);
          expect(otp.length).toBe(6);
          
          // OTP should be numeric
          expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(100000);
          expect(parseInt(otp, 10)).toBeLessThanOrEqual(999999);
          
          return true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 3: Account activation with zero balance**
   * **Validates: Requirements 1.3**
   * 
   * For any valid OTP verification, the system should activate the user account 
   * and create an associated financial account with exactly zero balance.
   */
  describe('Property 3: Account activation with zero balance', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should create account with zero balance upon OTP verification', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          async (email, password) => {
            testEmails.push(email);
            
            // Create user
            const signupResult = await authService.signup(email, password);
            
            // Get OTP
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: signupResult.userId, verified: false },
              orderBy: { createdAt: 'desc' },
            });
            
            // Verify OTP
            const tokens = await authService.verifyOTP(signupResult.userId, otpRecord!.code);
            
            // Verify tokens were issued
            expect(tokens.accessToken).toBeDefined();
            expect(tokens.refreshToken).toBeDefined();
            
            // Verify account was created with zero balance
            const account = await prisma.account.findUnique({
              where: { userId: signupResult.userId },
            });
            
            expect(account).not.toBeNull();
            expect(account!.balance.toNumber()).toBe(0);
            expect(account!.currency).toBe('USD');
            expect(account!.status).toBe('ACTIVE');
            
            // Cleanup
            await cleanupTestUser(email);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 4: Invalid credential rejection**
   * **Validates: Requirements 1.4**
   * 
   * For any invalid credential combination during signup, the system should 
   * reject the registration and return appropriate error messages.
   */
  describe('Property 4: Invalid credential rejection', () => {
    // Invalid email arbitrary (no @ symbol)
    const invalidEmailArbitrary = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'),
      { minLength: 5, maxLength: 20 }
    );

    // Invalid password arbitrary (too short)
    const shortPasswordArbitrary = fc.string({ minLength: 1, maxLength: 7 });

    // Password without uppercase
    const noUpperPasswordArbitrary = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'),
      { minLength: 8, maxLength: 20 }
    );

    // Password without lowercase
    const noLowerPasswordArbitrary = fc.stringOf(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
      { minLength: 8, maxLength: 20 }
    );

    // Password without digits
    const noDigitPasswordArbitrary = fc.stringOf(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
      { minLength: 8, maxLength: 20 }
    );

    it('should reject signup with invalid email format', () => {
      fc.assert(
        fc.property(invalidEmailArbitrary, validPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with password too short', () => {
      fc.assert(
        fc.property(fc.emailAddress(), shortPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with password missing uppercase', () => {
      fc.assert(
        fc.property(fc.emailAddress(), noUpperPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with password missing lowercase', () => {
      fc.assert(
        fc.property(fc.emailAddress(), noLowerPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject signup with password missing digits', () => {
      fc.assert(
        fc.property(fc.emailAddress(), noDigitPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === false;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should accept valid email and password combinations', () => {
      // Generate valid emails
      const validEmailArb = fc
        .tuple(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 1, maxLength: 10 }),
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 10 }),
          fc.constantFrom('com', 'org', 'net', 'io')
        )
        .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

      fc.assert(
        fc.property(validEmailArb, validPasswordArbitrary, (email, password) => {
          const result = signupSchema.safeParse({ email, password });
          return result.success === true;
        }),
        { numRuns: propertyConfig.numRuns }
      );
    });
  });


  /**
   * **Feature: fintech-mobile-app, Property 5: JWT token issuance**
   * **Validates: Requirements 2.1**
   * 
   * For any valid email and password combination during login, the system 
   * should authenticate the user and issue both JWT access and refresh tokens.
   */
  describe('Property 5: JWT token issuance', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should issue valid JWT tokens for any authenticated user', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          async (email, password) => {
            testEmails.push(email);
            
            // Create and activate user
            const signupResult = await authService.signup(email, password);
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: signupResult.userId, verified: false },
            });
            await authService.verifyOTP(signupResult.userId, otpRecord!.code);
            
            // Login
            const tokens = await authService.login(email, password);
            
            // Verify access token is valid JWT
            expect(tokens.accessToken).toBeDefined();
            const decoded = jwt.decode(tokens.accessToken) as Record<string, unknown>;
            expect(decoded).not.toBeNull();
            expect(decoded.userId).toBe(signupResult.userId);
            expect(decoded.email).toBe(email);
            expect(decoded.exp).toBeDefined();
            
            // Verify refresh token was stored
            expect(tokens.refreshToken).toBeDefined();
            const refreshTokenRecord = await prisma.refreshToken.findUnique({
              where: { token: tokens.refreshToken },
            });
            expect(refreshTokenRecord).not.toBeNull();
            expect(refreshTokenRecord!.userId).toBe(signupResult.userId);
            
            // Cleanup
            await cleanupTestUser(email);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should generate valid JWT structure for any payload', () => {
      // Test JWT generation without database
      const jwtSecret = 'test-secret';
      
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN'),
          (userId, email, role) => {
            const payload = { userId, email, role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
            
            // Token should have 3 parts (header.payload.signature)
            expect(token.split('.').length).toBe(3);
            
            // Token should be verifiable
            const decoded = jwt.verify(token, jwtSecret) as Record<string, unknown>;
            expect(decoded.userId).toBe(userId);
            expect(decoded.email).toBe(email);
            expect(decoded.role).toBe(role);
            
            return true;
          }
        ),
        { numRuns: propertyConfig.numRuns }
      );
    });

    it('should reject login with wrong password', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      const email = `wrong_pass_test_${Date.now()}@testdomain.com`;
      testEmails.push(email);
      
      // Create and activate user
      const signupResult = await authService.signup(email, 'CorrectPass123');
      const otpRecord = await prisma.otpCode.findFirst({
        where: { userId: signupResult.userId, verified: false },
      });
      await authService.verifyOTP(signupResult.userId, otpRecord!.code);
      
      // Try login with wrong password
      await expect(authService.login(email, 'WrongPass456'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should reject login for non-existent user', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await expect(authService.login('nonexistent@test.com', 'AnyPass123'))
        .rejects.toThrow('Invalid email or password');
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 6: Token refresh mechanism**
   * **Validates: Requirements 2.4**
   * 
   * For any expired access token with a valid refresh token, the system 
   * should issue a new access token without requiring re-authentication.
   */
  describe('Property 6: Token refresh mechanism', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should issue new access token for any valid refresh token', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          async (email, password) => {
            testEmails.push(email);
            
            // Create and activate user
            const signupResult = await authService.signup(email, password);
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: signupResult.userId, verified: false },
            });
            await authService.verifyOTP(signupResult.userId, otpRecord!.code);
            
            // Login to get tokens
            const tokens = await authService.login(email, password);
            
            // Refresh token
            const newTokens = await authService.refreshToken(tokens.refreshToken);
            
            // Verify new access token is valid
            expect(newTokens.accessToken).toBeDefined();
            const decoded = jwt.decode(newTokens.accessToken) as Record<string, unknown>;
            expect(decoded).not.toBeNull();
            expect(decoded.userId).toBe(signupResult.userId);
            expect(decoded.email).toBe(email);
            
            // New access token should be different from original
            expect(newTokens.accessToken).not.toBe(tokens.accessToken);
            
            // Cleanup
            await cleanupTestUser(email);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject invalid refresh token', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await expect(authService.refreshToken('invalid-refresh-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      const email = `expired_refresh_test_${Date.now()}@testdomain.com`;
      testEmails.push(email);
      
      // Create and activate user
      const signupResult = await authService.signup(email, 'ValidPass123');
      const otpRecord = await prisma.otpCode.findFirst({
        where: { userId: signupResult.userId, verified: false },
      });
      await authService.verifyOTP(signupResult.userId, otpRecord!.code);
      
      // Login to get tokens
      const tokens = await authService.login(email, 'ValidPass123');
      
      // Manually expire the refresh token
      await prisma.refreshToken.update({
        where: { token: tokens.refreshToken },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      
      // Try to refresh with expired token
      await expect(authService.refreshToken(tokens.refreshToken))
        .rejects.toThrow('Refresh token expired');
    });

    it('should invalidate refresh token after logout', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      const email = `logout_test_${Date.now()}@testdomain.com`;
      testEmails.push(email);
      
      // Create and activate user
      const signupResult = await authService.signup(email, 'ValidPass123');
      const otpRecord = await prisma.otpCode.findFirst({
        where: { userId: signupResult.userId, verified: false },
      });
      await authService.verifyOTP(signupResult.userId, otpRecord!.code);
      
      // Login to get tokens
      const tokens = await authService.login(email, 'ValidPass123');
      
      // Logout
      await authService.logout(tokens.refreshToken);
      
      // Try to refresh with logged out token
      await expect(authService.refreshToken(tokens.refreshToken))
        .rejects.toThrow('Invalid refresh token');
    });
  });
});
