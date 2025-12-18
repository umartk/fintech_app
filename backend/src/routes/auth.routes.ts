import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateInput } from '../middleware/validateInput';
import { auditSecurityEvent } from '../middleware/auditLog';
import {
  signupSchema,
  loginSchema,
  otpVerificationSchema,
  refreshTokenSchema,
  uuidSchema,
} from '../validation/schemas';
import { z } from 'zod';

const router = Router();

// POST /api/auth/signup - Register new user
router.post(
  '/signup',
  validateInput(signupSchema),
  auditSecurityEvent('SIGNUP'),
  authController.signup.bind(authController)
);

// POST /api/auth/verify-otp - Verify OTP and activate account
router.post(
  '/verify-otp',
  validateInput(otpVerificationSchema),
  auditSecurityEvent('OTP_VERIFICATION'),
  authController.verifyOTP.bind(authController)
);

// POST /api/auth/login - Login user
router.post(
  '/login',
  validateInput(loginSchema),
  auditSecurityEvent('LOGIN_SUCCESS'),
  authController.login.bind(authController)
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  validateInput(refreshTokenSchema),
  auditSecurityEvent('TOKEN_REFRESH'),
  authController.refreshToken.bind(authController)
);

// POST /api/auth/logout - Logout user
router.post(
  '/logout',
  validateInput(refreshTokenSchema),
  auditSecurityEvent('LOGOUT'),
  authController.logout.bind(authController)
);

// POST /api/auth/resend-otp - Resend OTP
router.post(
  '/resend-otp',
  validateInput(z.object({ userId: uuidSchema })),
  authController.resendOTP.bind(authController)
);

export default router;
