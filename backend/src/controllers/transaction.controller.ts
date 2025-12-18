import { Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { CreateTransferInput, PaginationInput } from '../validation/schemas';

export class TransactionController {
  /**
   * Create a money transfer
   * POST /api/transactions/transfer
   * Validates: Requirements 4.1, 4.2, 4.3, 4.5
   */
  async createTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { toUserId, amount, description, idempotencyKey } = req.body as CreateTransferInput;
      const fromUserId = req.user!.userId;

      const transaction = await transactionService.createTransfer({
        fromUserId,
        toUserId,
        amount,
        description,
        idempotencyKey,
      });

      res.status(201).json({
        status: 'success',
        message: 'Transfer completed successfully',
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction by ID
   * GET /api/transactions/:transactionId
   */
  async getTransaction(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transactionId } = req.params;
      const userId = req.user!.userId;

      const transaction = await transactionService.getTransactionById(transactionId, userId);

      res.status(200).json({
        status: 'success',
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction history
   * GET /api/transactions
   * Validates: Requirements 6.1
   */
  async getTransactionHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page = 1, limit = 20 } = req.query as unknown as PaginationInput;

      const result = await transactionService.getTransactionHistory(userId, {
        page: Number(page),
        limit: Number(limit),
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get account balance
   * GET /api/transactions/balance
   */
  async getBalance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const balance = await transactionService.getAccountBalance(userId);

      res.status(200).json({
        status: 'success',
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
export default transactionController;
