import { Response, NextFunction } from 'express';
import { paymentMethodService } from '../services/paymentMethod.service';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { AddPaymentMethodInput } from '../validation/schemas';

export class PaymentMethodController {
  /**
   * Add a new payment method
   * POST /api/payment-methods
   * Validates: Requirements 7.1, 7.2
   */
  async addPaymentMethod(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = req.body as AddPaymentMethodInput;
      const paymentMethod = await paymentMethodService.addPaymentMethod(userId, input);

      res.status(201).json({
        status: 'success',
        message: 'Payment method added successfully',
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all payment methods for the current user
   * GET /api/payment-methods
   * Validates: Requirements 7.4
   */
  async listPaymentMethods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const paymentMethods = await paymentMethodService.listPaymentMethods(userId);

      res.status(200).json({
        status: 'success',
        data: paymentMethods,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific payment method
   * GET /api/payment-methods/:paymentMethodId
   */
  async getPaymentMethod(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { paymentMethodId } = req.params;
      const paymentMethod = await paymentMethodService.getPaymentMethod(userId, paymentMethodId);

      res.status(200).json({
        status: 'success',
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a payment method
   * DELETE /api/payment-methods/:paymentMethodId
   * Validates: Requirements 7.3
   */
  async removePaymentMethod(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { paymentMethodId } = req.params;
      await paymentMethodService.removePaymentMethod(userId, paymentMethodId);

      res.status(200).json({
        status: 'success',
        message: 'Payment method removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set a payment method as default
   * PATCH /api/payment-methods/:paymentMethodId/default
   */
  async setDefaultPaymentMethod(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { paymentMethodId } = req.params;
      const paymentMethod = await paymentMethodService.setDefaultPaymentMethod(
        userId,
        paymentMethodId
      );

      res.status(200).json({
        status: 'success',
        message: 'Default payment method updated',
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentMethodController = new PaymentMethodController();
export default paymentMethodController;
