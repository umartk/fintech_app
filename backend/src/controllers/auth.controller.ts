import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { SignupInput, LoginInput, OtpVerificationInput, RefreshTokenInput } from '../validation/schemas';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/signup
   */
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as SignupInput;
      const result = await authService.signup(email, password);
      
      res.status(201).json({
        status: 'success',
        message: 'User registered successfully. Please verify your email with the OTP sent.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP and activate account
   * POST /api/auth/verify-otp
   */
  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, otp } = req.body as OtpVerificationInput;
      const tokens = await authService.verifyOTP(userId, otp);
      
      res.status(200).json({
        status: 'success',
        message: 'Account verified successfully',
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as LoginInput;
      const tokens = await authService.login(email, password);
      
      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const result = await authService.refreshToken(refreshToken);
      
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      await authService.logout(refreshToken);
      
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend OTP
   * POST /api/auth/resend-otp
   */
  async resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body as { userId: string };
      await authService.generateOTP(userId);
      
      res.status(200).json({
        status: 'success',
        message: 'OTP sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;
