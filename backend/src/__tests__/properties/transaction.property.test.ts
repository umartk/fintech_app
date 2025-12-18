import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionService } from '../../services/transaction.service';
import { AuthService } from '../../services/auth.service';

let prisma: PrismaClient;
let transactionService: TransactionService;
let authService: AuthService;
let isDatabaseAvailable = false;

// Test user tracking for cleanup
const testUserIds: string[] = [];

// Helper to create a test user with activated account and balance
async function createTestUserWithBalance(
  email: string,
  balance: number
): Promise<{ userId: string; accountId: string }> {
  const password = 'TestPass123';

  // Create user
  const signupResult = await authService.signup(email, password);
  testUserIds.push(signupResult.userId);

  // Get OTP and verify
  const otpRecord = await prisma.otpCode.findFirst({
    where: { userId: signupResult.userId, verified: false },
    orderBy: { createdAt: 'desc' },
  });
  await authService.verifyOTP(signupResult.userId, otpRecord!.code);

  // Set balance
  const account = await prisma.account.findUnique({
    where: { userId: signupResult.userId },
  });

  if (balance > 0) {
    await prisma.account.update({
      where: { id: account!.id },
      data: { balance: new Decimal(balance) },
    });
  }

  return { userId: signupResult.userId, accountId: account!.id };
}

// Helper to clean up test users
async function cleanupTestUsers() {
  if (!isDatabaseAvailable) return;
  for (const userId of testUserIds) {
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch {
      // Ignore cleanup errors
    }
  }
  testUserIds.length = 0;
}

// Generate valid transfer amounts (positive, max 2 decimal places)
const validAmountArbitrary = fc
  .double({ min: 0.01, max: 10000, noNaN: true })
  .map((n) => Math.round(n * 100) / 100);

describe('Transaction Property Tests', () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    transactionService = new TransactionService();
    authService = new AuthService();

    try {
      await prisma.$connect();
      isDatabaseAvailable = true;
      console.log('Database connected successfully');
    } catch (error) {
      isDatabaseAvailable = false;
      console.warn('Database not available - skipping database-dependent tests');
      console.warn('Error:', error);
    }
  });

  afterAll(async () => {
    await cleanupTestUsers();
    if (isDatabaseAvailable) {
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });


  /**
   * **Feature: fintech-mobile-app, Property 7: Atomic transaction processing**
   * **Validates: Requirements 4.1**
   */
  describe('Property 7: Atomic transaction processing', () => {
    it('should atomically update both accounts for any valid transfer', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          validAmountArbitrary,
          fc.double({ min: 1, max: 100, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          async (initialBalance, transferAmount) => {
            const safeTransferAmount = Math.min(transferAmount, initialBalance);
            if (safeTransferAmount < 0.01) return true;

            const senderEmail = `sender_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const recipientEmail = `recipient_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const sender = await createTestUserWithBalance(senderEmail, initialBalance);
            const recipient = await createTestUserWithBalance(recipientEmail, 0);

            const senderAccountBefore = await prisma.account.findUnique({ where: { id: sender.accountId } });
            const recipientAccountBefore = await prisma.account.findUnique({ where: { id: recipient.accountId } });

            const transaction = await transactionService.createTransfer({
              fromUserId: sender.userId,
              toUserId: recipient.userId,
              amount: safeTransferAmount,
            });

            expect(transaction.id).toBeDefined();
            expect(transaction.status).toBe('COMPLETED');

            const senderAccountAfter = await prisma.account.findUnique({ where: { id: sender.accountId } });
            const recipientAccountAfter = await prisma.account.findUnique({ where: { id: recipient.accountId } });

            expect(senderAccountAfter!.balance.toNumber()).toBeCloseTo(
              senderAccountBefore!.balance.toNumber() - safeTransferAmount, 2
            );
            expect(recipientAccountAfter!.balance.toNumber()).toBeCloseTo(
              recipientAccountBefore!.balance.toNumber() + safeTransferAmount, 2
            );

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 8: Insufficient funds protection**
   * **Validates: Requirements 4.2**
   */
  describe('Property 8: Insufficient funds protection', () => {
    it('should reject transfer and preserve balances when funds insufficient', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.01, max: 100, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          fc.double({ min: 1.01, max: 10, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          async (initialBalance, excessMultiplier) => {
            const senderEmail = `sender_insuf_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const recipientEmail = `recipient_insuf_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const sender = await createTestUserWithBalance(senderEmail, initialBalance);
            const recipient = await createTestUserWithBalance(recipientEmail, 50);

            const excessAmount = Math.round((initialBalance * excessMultiplier + 0.01) * 100) / 100;

            const senderBalanceBefore = (await prisma.account.findUnique({ where: { id: sender.accountId } }))!.balance.toNumber();
            const recipientBalanceBefore = (await prisma.account.findUnique({ where: { id: recipient.accountId } }))!.balance.toNumber();

            await expect(
              transactionService.createTransfer({
                fromUserId: sender.userId,
                toUserId: recipient.userId,
                amount: excessAmount,
              })
            ).rejects.toThrow('Insufficient funds');

            const senderBalanceAfter = (await prisma.account.findUnique({ where: { id: sender.accountId } }))!.balance.toNumber();
            const recipientBalanceAfter = (await prisma.account.findUnique({ where: { id: recipient.accountId } }))!.balance.toNumber();

            expect(senderBalanceAfter).toBe(senderBalanceBefore);
            expect(recipientBalanceAfter).toBe(recipientBalanceBefore);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 9: Ledger consistency**
   * **Validates: Requirements 4.3**
   */
  describe('Property 9: Ledger consistency', () => {
    it('should maintain total money conservation for any transfer', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 100, max: 1000, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          fc.double({ min: 50, max: 500, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          fc.double({ min: 0.01, max: 50, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          async (senderInitial, recipientInitial, transferAmount) => {
            const senderEmail = `sender_ledger_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const recipientEmail = `recipient_ledger_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const sender = await createTestUserWithBalance(senderEmail, senderInitial);
            const recipient = await createTestUserWithBalance(recipientEmail, recipientInitial);

            const totalBefore = senderInitial + recipientInitial;

            await transactionService.createTransfer({
              fromUserId: sender.userId,
              toUserId: recipient.userId,
              amount: transferAmount,
            });

            const senderBalanceAfter = (await prisma.account.findUnique({ where: { id: sender.accountId } }))!.balance.toNumber();
            const recipientBalanceAfter = (await prisma.account.findUnique({ where: { id: recipient.accountId } }))!.balance.toNumber();

            const totalAfter = senderBalanceAfter + recipientBalanceAfter;
            expect(totalAfter).toBeCloseTo(totalBefore, 2);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });


  /**
   * **Feature: fintech-mobile-app, Property 10: Transaction idempotency**
   * **Validates: Requirements 4.5**
   */
  describe('Property 10: Transaction idempotency', () => {
    it('should process only one transaction for duplicate idempotency keys', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.double({ min: 10, max: 100, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          async (idempotencyKey, transferAmount) => {
            const senderEmail = `sender_idemp_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const recipientEmail = `recipient_idemp_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const sender = await createTestUserWithBalance(senderEmail, 1000);
            const recipient = await createTestUserWithBalance(recipientEmail, 0);

            const transaction1 = await transactionService.createTransfer({
              fromUserId: sender.userId,
              toUserId: recipient.userId,
              amount: transferAmount,
              idempotencyKey,
            });

            const senderBalanceAfterFirst = (await prisma.account.findUnique({ where: { id: sender.accountId } }))!.balance.toNumber();

            const transaction2 = await transactionService.createTransfer({
              fromUserId: sender.userId,
              toUserId: recipient.userId,
              amount: transferAmount,
              idempotencyKey,
            });

            expect(transaction2.id).toBe(transaction1.id);

            const senderBalanceAfterSecond = (await prisma.account.findUnique({ where: { id: sender.accountId } }))!.balance.toNumber();
            expect(senderBalanceAfterSecond).toBe(senderBalanceAfterFirst);

            const transactionCount = await prisma.transaction.count({ where: { idempotencyKey } });
            expect(transactionCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 11: Balance update consistency**
   * **Validates: Requirements 5.1, 5.4**
   */
  describe('Property 11: Balance update consistency', () => {
    it('should increase recipient balance by exact transfer amount', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.01, max: 500, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          fc.double({ min: 0, max: 100, noNaN: true }).map((n) => Math.round(n * 100) / 100),
          async (transferAmount, recipientInitial) => {
            const senderEmail = `sender_balance_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const recipientEmail = `recipient_balance_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const sender = await createTestUserWithBalance(senderEmail, 1000);
            const recipient = await createTestUserWithBalance(recipientEmail, recipientInitial);

            const recipientBalanceBefore = (await prisma.account.findUnique({ where: { id: recipient.accountId } }))!.balance.toNumber();

            const transaction = await transactionService.createTransfer({
              fromUserId: sender.userId,
              toUserId: recipient.userId,
              amount: transferAmount,
            });

            const recipientBalanceAfter = (await prisma.account.findUnique({ where: { id: recipient.accountId } }))!.balance.toNumber();

            expect(recipientBalanceAfter).toBeCloseTo(recipientBalanceBefore + transferAmount, 2);

            const transactionRecord = await prisma.transaction.findUnique({ where: { id: transaction.id } });
            expect(transactionRecord).not.toBeNull();
            expect(transactionRecord!.toAccountId).toBe(recipient.accountId);
            expect(transactionRecord!.amount.toNumber()).toBe(transferAmount);
            expect(transactionRecord!.status).toBe('COMPLETED');

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: fintech-mobile-app, Property 12: Transaction history completeness**
   * **Validates: Requirements 6.1**
   */
  describe('Property 12: Transaction history completeness', () => {
    it('should return complete transaction history for any user', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping - database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (numTransactions) => {
            const userEmail = `user_history_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
            const otherEmail = `other_history_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

            const user = await createTestUserWithBalance(userEmail, 1000);
            const other = await createTestUserWithBalance(otherEmail, 1000);

            const createdTransactions: string[] = [];
            for (let i = 0; i < numTransactions; i++) {
              const amount = Math.round((10 + Math.random() * 10) * 100) / 100;
              const tx = i % 2 === 0
                ? await transactionService.createTransfer({ fromUserId: user.userId, toUserId: other.userId, amount })
                : await transactionService.createTransfer({ fromUserId: other.userId, toUserId: user.userId, amount });
              createdTransactions.push(tx.id);
            }

            const history = await transactionService.getTransactionHistory(user.userId, { page: 1, limit: 100 });

            expect(history.transactions.length).toBe(numTransactions);
            expect(history.total).toBe(numTransactions);

            for (const tx of history.transactions) {
              expect(tx.id).toBeDefined();
              expect(tx.fromAccountId).toBeDefined();
              expect(tx.toAccountId).toBeDefined();
              expect(tx.amount).toBeGreaterThan(0);
              expect(tx.status).toBeDefined();
              expect(tx.createdAt).toBeDefined();
              expect(createdTransactions).toContain(tx.id);
            }

            return true;
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
