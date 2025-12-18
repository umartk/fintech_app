import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { AppError, AuthenticationError } from '../middleware/errorHandler';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const OTP_EXPIRY_MINUTES = 10;

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production';
  }

  /**
   * Create a new user account with encrypted password storage
   * Validates: Requirements 1.1
   */
  async signup(email: string, password: string): Promise<{ userId: string; requiresOTP: boolean }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user in transaction
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    // Generate and store OTP
    await this.generateOTP(user.id);

    return { userId: user.id, requiresOTP: true };
  }

  /**
   * Generate OTP for user verification
   * Validates: Requirements 1.2
   */
  async generateOTP(userId: string): Promise<string> {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing OTPs for this user
    await prisma.otpCode.updateMany({
      where: { userId, verified: false },
      data: { verified: true },
    });

    // Store new OTP
    await prisma.otpCode.create({
      data: {
        userId,
        code: otp,
        expiresAt,
      },
    });

    // In production, send OTP via email
    // For now, log it (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`OTP for user ${userId}: ${otp}`);
    }

    return otp;
  }

  /**
   * Verify OTP and activate account with zero balance
   * Validates: Requirements 1.3
   */
  async verifyOTP(userId: string, otp: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Find valid OTP
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId,
        code: otp,
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      throw new AuthenticationError('Invalid or expired OTP');
    }

    // Mark OTP as verified and create account in transaction
    await prisma.$transaction(async (tx) => {
      // Mark OTP as verified
      await tx.otpCode.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });

      // Create financial account with zero balance if not exists
      const existingAccount = await tx.account.findUnique({ where: { userId } });
      if (!existingAccount) {
        await tx.account.create({
          data: {
            userId,
            balance: 0,
            currency: 'USD',
            status: 'ACTIVE',
          },
        });
      }
    });

    // Generate tokens
    return this.generateTokens(user);
  }


  /**
   * Authenticate user with email and password
   * Validates: Requirements 2.1
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user has an active account (OTP verified)
    const account = await prisma.account.findUnique({ where: { userId: user.id } });
    if (!account) {
      throw new AuthenticationError('Account not activated. Please verify your email.');
    }

    return this.generateTokens(user);
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: { id: string; email: string; role: string }): Promise<AuthTokens> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using valid refresh token
   * Validates: Requirements 2.4
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      // Delete expired token
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new AuthenticationError('Refresh token expired');
    }

    const payload: TokenPayload = {
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    return { accessToken };
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      throw new AuthenticationError('Invalid or expired access token');
    }
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  /**
   * Logout from all devices by invalidating all refresh tokens
   * Validates: Requirements 9.4
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const authService = new AuthService();
export default authService;
