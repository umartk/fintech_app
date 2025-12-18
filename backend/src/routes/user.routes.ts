import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validateInput } from '../middleware/validateInput';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import {
  updateProfileSchema,
  changePasswordSchema,
  paginationSchema,
  uuidSchema,
} from '../validation/schemas';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users/profile - Get current user's profile
router.get(
  '/profile',
  userController.getProfile.bind(userController)
);

// PATCH /api/users/profile - Update current user's profile
router.patch(
  '/profile',
  validateInput(updateProfileSchema),
  userController.updateProfile.bind(userController)
);

// GET /api/users/balance - Get current user's account balance
router.get(
  '/balance',
  userController.getBalance.bind(userController)
);

// POST /api/users/change-password - Change current user's password
router.post(
  '/change-password',
  validateInput(changePasswordSchema),
  userController.changePassword.bind(userController)
);

// GET /api/users/kyc-status - Get current user's KYC status
router.get(
  '/kyc-status',
  userController.getKycStatus.bind(userController)
);

// POST /api/users/logout-all - Logout from all devices
router.post(
  '/logout-all',
  userController.logoutAllDevices.bind(userController)
);

// Admin routes
const kycStatusSchema = z.object({
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
});

// GET /api/users - List all users (admin only)
router.get(
  '/',
  requireAdmin,
  validateInput(paginationSchema, { target: 'query' }),
  userController.listUsers.bind(userController)
);

// GET /api/users/:userId - Get user by ID (admin only)
router.get(
  '/:userId',
  requireAdmin,
  validateInput(z.object({ userId: uuidSchema }), { target: 'params' }),
  userController.getUserById.bind(userController)
);

// PATCH /api/users/:userId/kyc-status - Update user's KYC status (admin only)
router.patch(
  '/:userId/kyc-status',
  requireAdmin,
  validateInput(z.object({ userId: uuidSchema }), { target: 'params' }),
  validateInput(kycStatusSchema),
  userController.updateKycStatus.bind(userController)
);

export default router;
