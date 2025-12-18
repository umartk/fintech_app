import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { broadcastTransactionUpdate } from '../websocket';

export interface CreateTransferInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
}

export interface TransactionResult {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface TransactionHistoryResult {
  transactions: TransactionResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TransactionService {
  /**
   * Create and process a money transfer atomically
   * Validates: Requirements 4.1, 4.2, 4.3, 4.5
   */
  async createTransfer(input: CreateTransferInput): Promise<TransactionResult> {
    const { fromUserId, toUserId, amount, description, idempotencyKey } = input;

    // Check for idempotent request
    if (idempotencyKey) {
      const existingTransaction = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTransaction) {
        return this.formatTransaction(existingTransaction);
      }
    }

    // Validate users exist and get their accounts
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findUnique({ where: { userId: fromUserId } }),
      prisma.account.findUnique({ where: { userId: toUserId } }),
    ]);

    if (!fromAccount) {
      throw new NotFoundError('Sender account not found');
    }
    if (!toAccount) {
      throw new NotFoundError('Recipient account not found');
    }
    if (fromAccount.status !== 'ACTIVE') {
      throw new AppError('Sender account is not active', 400, 'ACCOUNT_INACTIVE');
    }
    if (toAccount.status !== 'ACTIVE') {
      throw new AppError('Recipient account is not active', 400, 'ACCOUNT_INACTIVE');
    }
    if (fromUserId === toUserId) {
      throw new AppError('Cannot transfer to yourself', 400, 'SELF_TRANSFER');
    }

    const amountDecimal = new Decimal(amount);

    // Check sufficient funds
    if (fromAccount.balance.lessThan(amountDecimal)) {
      throw new AppError('Insufficient funds', 400, 'INSUFFICIENT_FUNDS');
    }

    // Execute atomic transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Lock accounts by reading with update intent (order by ID to prevent deadlocks)
      const accountIds = [fromAccount.id, toAccount.id].sort();
      for (const accountId of accountIds) {
        await tx.$queryRaw`SELECT * FROM accounts WHERE id = ${accountId} FOR UPDATE`;
      }

      // Re-check balance after acquiring lock
      const lockedFromAccount = await tx.account.findUnique({
        where: { id: fromAccount.id },
      });

      if (!lockedFromAccount || lockedFromAccount.balance.lessThan(amountDecimal)) {
        throw new AppError('Insufficient funds', 400, 'INSUFFICIENT_FUNDS');
      }

      // Debit sender
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: amountDecimal } },
      });

      // Credit recipient
      await tx.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: amountDecimal } },
      });

      // Create transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          amount: amountDecimal,
          currency: fromAccount.currency,
          type: 'TRANSFER',
          status: 'COMPLETED',
          description,
          idempotencyKey,
          processedAt: new Date(),
        },
      });

      return newTransaction;
    });

    // Broadcast real-time update to both sender and recipient
    // Validates: Requirements 8.1, 8.4
    try {
      await broadcastTransactionUpdate({
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount.toNumber(),
        fromUserId,
        toUserId,
        timestamp: transaction.processedAt || new Date(),
      });
    } catch (error) {
      // Log but don't fail the transaction if broadcast fails
      console.error('Failed to broadcast transaction update:', error);
    }

    return this.formatTransaction(transaction);
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string): Promise<TransactionResult> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        fromAccount: true,
        toAccount: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Verify user has access to this transaction
    const userAccount = await prisma.account.findUnique({
      where: { userId },
    });

    if (!userAccount) {
      throw new NotFoundError('User account not found');
    }

    if (
      transaction.fromAccountId !== userAccount.id &&
      transaction.toAccountId !== userAccount.id
    ) {
      throw new AppError('Access denied to this transaction', 403, 'ACCESS_DENIED');
    }

    return this.formatTransaction(transaction);
  }

  /**
   * Get transaction history for a user with pagination
   * Validates: Requirements 6.1
   */
  async getTransactionHistory(
    userId: string,
    options: PaginationOptions
  ): Promise<TransactionHistoryResult> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Get user's account
    const account = await prisma.account.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Get transactions where user is sender or recipient
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          fromAccount: {
            include: { user: { select: { id: true, email: true } } },
          },
          toAccount: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      }),
      prisma.transaction.count({
        where: {
          OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
        },
      }),
    ]);

    return {
      transactions: transactions.map((t) => this.formatTransactionWithUsers(t, account.id)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get account balance
   */
  async getAccountBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const account = await prisma.account.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return {
      balance: account.balance.toNumber(),
      currency: account.currency,
    };
  }

  private formatTransaction(transaction: {
    id: string;
    fromAccountId: string;
    toAccountId: string;
    amount: Decimal;
    currency: string;
    type: TransactionType;
    status: TransactionStatus;
    description: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }): TransactionResult {
    return {
      id: transaction.id,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      amount: transaction.amount.toNumber(),
      currency: transaction.currency,
      type: transaction.type,
      status: transaction.status,
      description: transaction.description,
      idempotencyKey: transaction.idempotencyKey,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt,
    };
  }

  private formatTransactionWithUsers(
    transaction: {
      id: string;
      fromAccountId: string;
      toAccountId: string;
      amount: Decimal;
      currency: string;
      type: TransactionType;
      status: TransactionStatus;
      description: string | null;
      idempotencyKey: string | null;
      createdAt: Date;
      processedAt: Date | null;
      fromAccount: { user: { id: string; email: string } };
      toAccount: { user: { id: string; email: string } };
    },
    userAccountId: string
  ): TransactionResult & { direction: string; counterparty: { id: string; email: string } } {
    const isOutgoing = transaction.fromAccountId === userAccountId;
    return {
      ...this.formatTransaction(transaction),
      direction: isOutgoing ? 'outgoing' : 'incoming',
      counterparty: isOutgoing ? transaction.toAccount.user : transaction.fromAccount.user,
    };
  }
}

export const transactionService = new TransactionService();
export default transactionService;
