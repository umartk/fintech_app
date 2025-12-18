import { Router } from 'express';
import { paymentMethodController } from '../controllers/paymentMethod.controller';
import { validateInput } from '../middleware/validateInput';
import { authenticate } from '../middleware/authenticate';
import { addPaymentMethodSchema, uuidSchema } from '../validation/schemas';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/payment-methods - Add a new payment method
router.post(
  '/',
  validateInput(addPaymentMethodSchema),
  paymentMethodController.addPaymentMethod.bind(paymentMethodController)
);

// GET /api/payment-methods - List all payment methods
router.get(
  '/',
  paymentMethodController.listPaymentMethods.bind(paymentMethodController)
);

// GET /api/payment-methods/:paymentMethodId - Get a specific payment method
router.get(
  '/:paymentMethodId',
  validateInput(z.object({ paymentMethodId: uuidSchema }), { target: 'params' }),
  paymentMethodController.getPaymentMethod.bind(paymentMethodController)
);

// DELETE /api/payment-methods/:paymentMethodId - Remove a payment method
router.delete(
  '/:paymentMethodId',
  validateInput(z.object({ paymentMethodId: uuidSchema }), { target: 'params' }),
  paymentMethodController.removePaymentMethod.bind(paymentMethodController)
);

// PATCH /api/payment-methods/:paymentMethodId/default - Set as default
router.patch(
  '/:paymentMethodId/default',
  validateInput(z.object({ paymentMethodId: uuidSchema }), { target: 'params' }),
  paymentMethodController.setDefaultPaymentMethod.bind(paymentMethodController)
);

export default router;
