import { Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { UpdateProfileInput, ChangePasswordInput, PaginationInput } from '../validation/schemas';
import { KycStatus } from '@prisma/client';

export class UserController {
  /**
   * Get current user's profile
   * GET /api/users/profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await userService.getUserProfile(userId);

      res.status(200).json({
        status: 'success',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's profile
   * PATCH /api/users/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updates = req.body as UpdateProfileInput;
      const profile = await userService.updateProfile(userId, updates);

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's account balance
   * GET /api/users/balance
   */
  async getBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const balance = await userService.getAccountBalance(userId);

      res.status(200).json({
        status: 'success',
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Change current user's password
   * POST /api/users/change-password
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body as ChangePasswordInput;
      await userService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully. All sessions have been invalidated.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's KYC status
   * GET /api/users/kyc-status
   */
  async getKycStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const kycStatus = await userService.getKycStatus(userId);

      res.status(200).json({
        status: 'success',
        data: kycStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID (admin only)
   * GET /api/users/:userId
   */
  async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const profile = await userService.getUserProfile(userId);

      res.status(200).json({
        status: 'success',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user's KYC status (admin only)
   * PATCH /api/users/:userId/kyc-status
   */
  async updateKycStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { kycStatus } = req.body as { kycStatus: KycStatus };
      const profile = await userService.updateKycStatus(userId, kycStatus);

      res.status(200).json({
        status: 'success',
        message: 'KYC status updated successfully',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all users (admin only)
   * GET /api/users
   */
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as unknown as PaginationInput;
      const result = await userService.listUsers(page, limit);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout from all devices
   * POST /api/users/logout-all
   */
  async logoutAllDevices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { authService } = await import('../services/auth.service');
      await authService.logoutAllDevices(userId);

      res.status(200).json({
        status: 'success',
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
export default userController;
