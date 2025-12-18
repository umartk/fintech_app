import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { validateInput } from '../middleware/validateInput';
import { authenticate } from '../middleware/authenticate';
import {
  createTransferSchema,
  transactionIdParamSchema,
  paginationSchema,
} from '../validation/schemas';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

// POST /api/transactions/transfer - Create a money transfer
router.post(
  '/transfer',
  validateInput(createTransferSchema),
  transactionController.createTransfer.bind(transactionController)
);

// GET /api/transactions/balance - Get account balance
router.get(
  '/balance',
  transactionController.getBalance.bind(transactionController)
);

// GET /api/transactions - Get transaction history
router.get(
  '/',
  validateInput(paginationSchema, { target: 'query' }),
  transactionController.getTransactionHistory.bind(transactionController)
);

// GET /api/transactions/:transactionId - Get transaction by ID
router.get(
  '/:transactionId',
  validateInput(transactionIdParamSchema, { target: 'params' }),
  transactionController.getTransaction.bind(transactionController)
);

export default router;
