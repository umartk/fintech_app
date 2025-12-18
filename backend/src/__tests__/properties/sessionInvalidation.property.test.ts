import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { propertyConfig } from './helpers';

// Use a separate test database instance
let prisma: PrismaClient;
let authService: AuthService;
let userService: UserService;
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
  .map(([local, uuid]) => `test_session_${local}_${uuid.slice(0, 8)}@testdomain.com`);

// Generate valid passwords that meet all requirements
const validPasswordArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
    fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
  )
  .map(([upper, lower, digits]) => upper + lower + digits);

// Generate a different valid password for password change tests
const newPasswordArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 4 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 6 }),
    fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 2, maxLength: 3 })
  )
  .map(([upper, lower, digits]) => 'New' + upper + lower + digits);


describe('Session Invalidation Property Tests', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    authService = new AuthService();
    userService = new UserService();

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
   * **Feature: fintech-mobile-app, Property 14: Session invalidation**
   * **Validates: Requirements 9.2, 9.4**
   *
   * For any user password change or logout-all-devices action, all existing
   * refresh tokens for that user should be invalidated.
   */
  describe('Property 14: Session invalidation', () => {
    const testEmails: string[] = [];

    afterAll(async () => {
      for (const email of testEmails) {
        await cleanupTestUser(email);
      }
    });

    it('should invalidate all refresh tokens when password is changed', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          newPasswordArbitrary,
          async (email, originalPassword, newPassword) => {
            testEmails.push(email);

            // Create and activate user
            const signupResult = await authService.signup(email, originalPassword);
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: signupResult.userId, verified: false },
            });
            await authService.verifyOTP(signupResult.userId, otpRecord!.code);

            // Create multiple sessions (login multiple times to create multiple refresh tokens)
            const tokens1 = await authService.login(email, originalPassword);
            const tokens2 = await authService.login(email, originalPassword);
            const tokens3 = await authService.login(email, originalPassword);

            // Verify all refresh tokens exist
            const tokensBefore = await prisma.refreshToken.findMany({
              where: { userId: signupResult.userId },
            });
            expect(tokensBefore.length).toBeGreaterThanOrEqual(3);

            // Change password
            await userService.changePassword(signupResult.userId, originalPassword, newPassword);

            // Verify all refresh tokens are invalidated
            const tokensAfter = await prisma.refreshToken.findMany({
              where: { userId: signupResult.userId },
            });
            expect(tokensAfter.length).toBe(0);

            // Verify old refresh tokens cannot be used
            await expect(authService.refreshToken(tokens1.refreshToken))
              .rejects.toThrow('Invalid refresh token');
            await expect(authService.refreshToken(tokens2.refreshToken))
              .rejects.toThrow('Invalid refresh token');
            await expect(authService.refreshToken(tokens3.refreshToken))
              .rejects.toThrow('Invalid refresh token');

            // Cleanup
            await cleanupTestUser(email);

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should invalidate all refresh tokens when logout-all-devices is called', async () => {
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

            // Create multiple sessions
            const tokens1 = await authService.login(email, password);
            const tokens2 = await authService.login(email, password);
            const tokens3 = await authService.login(email, password);

            // Verify all refresh tokens exist
            const tokensBefore = await prisma.refreshToken.findMany({
              where: { userId: signupResult.userId },
            });
            expect(tokensBefore.length).toBeGreaterThanOrEqual(3);

            // Logout from all devices
            await authService.logoutAllDevices(signupResult.userId);

            // Verify all refresh tokens are invalidated
            const tokensAfter = await prisma.refreshToken.findMany({
              where: { userId: signupResult.userId },
            });
            expect(tokensAfter.length).toBe(0);

            // Verify old refresh tokens cannot be used
            await expect(authService.refreshToken(tokens1.refreshToken))
              .rejects.toThrow('Invalid refresh token');
            await expect(authService.refreshToken(tokens2.refreshToken))
              .rejects.toThrow('Invalid refresh token');
            await expect(authService.refreshToken(tokens3.refreshToken))
              .rejects.toThrow('Invalid refresh token');

            // Cleanup
            await cleanupTestUser(email);

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should allow login with new password after password change', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          uniqueEmailArbitrary,
          validPasswordArbitrary,
          newPasswordArbitrary,
          async (email, originalPassword, newPassword) => {
            testEmails.push(email);

            // Create and activate user
            const signupResult = await authService.signup(email, originalPassword);
            const otpRecord = await prisma.otpCode.findFirst({
              where: { userId: signupResult.userId, verified: false },
            });
            await authService.verifyOTP(signupResult.userId, otpRecord!.code);

            // Change password
            await userService.changePassword(signupResult.userId, originalPassword, newPassword);

            // Verify old password no longer works
            await expect(authService.login(email, originalPassword))
              .rejects.toThrow('Invalid email or password');

            // Verify new password works
            const newTokens = await authService.login(email, newPassword);
            expect(newTokens.accessToken).toBeDefined();
            expect(newTokens.refreshToken).toBeDefined();

            // Cleanup
            await cleanupTestUser(email);

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should allow re-login after logout-all-devices', async () => {
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

            // Login and then logout from all devices
            await authService.login(email, password);
            await authService.logoutAllDevices(signupResult.userId);

            // Verify user can still login
            const newTokens = await authService.login(email, password);
            expect(newTokens.accessToken).toBeDefined();
            expect(newTokens.refreshToken).toBeDefined();

            // Cleanup
            await cleanupTestUser(email);

            return true;
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});
