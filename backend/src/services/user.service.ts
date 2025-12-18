import prisma from '../config/database';
import { authService } from './auth.service';
import { AppError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { UpdateProfileInput, ChangePasswordInput } from '../validation/schemas';
import { KycStatus } from '@prisma/client';

export interface UserProfile {
  id: string;
  email: string;
  kycStatus: KycStatus;
  role: string;
  createdAt: Date;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    dateOfBirth: Date | null;
    address: unknown;
  } | null;
}

export interface AccountBalance {
  balance: number;
  currency: string;
  status: string;
}

export class UserService {
  /**
   * Get user profile by ID
   * Validates: Requirements 9.1
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      kycStatus: user.kycStatus,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile,
    };
  }


  /**
   * Update user profile
   * Validates: Requirements 9.1
   */
  async updateProfile(userId: string, updates: UpdateProfileInput): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update or create profile
    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        firstName: updates.firstName,
        lastName: updates.lastName,
        phoneNumber: updates.phoneNumber,
        dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : undefined,
      },
      create: {
        userId,
        firstName: updates.firstName,
        lastName: updates.lastName,
        phoneNumber: updates.phoneNumber,
        dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : undefined,
      },
    });

    return this.getUserProfile(userId);
  }

  /**
   * Get account balance for user
   * Validates: Requirements 3.1
   */
  async getAccountBalance(userId: string): Promise<AccountBalance> {
    const account = await prisma.account.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return {
      balance: account.balance.toNumber(),
      currency: account.currency,
      status: account.status,
    };
  }

  /**
   * Change user password and invalidate all sessions
   * Validates: Requirements 9.2
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValidPassword = await authService.comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await authService.hashPassword(newPassword);

    // Update password and invalidate all sessions in a transaction
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // Invalidate all refresh tokens (session invalidation)
      await tx.refreshToken.deleteMany({
        where: { userId },
      });
    });
  }

  /**
   * Get KYC status for user
   * Validates: Requirements 1.5
   */
  async getKycStatus(userId: string): Promise<{ kycStatus: KycStatus }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return { kycStatus: user.kycStatus };
  }

  /**
   * Update KYC status (admin only)
   * Validates: Requirements 10.1
   */
  async updateKycStatus(userId: string, kycStatus: KycStatus): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus },
    });

    return this.getUserProfile(userId);
  }

  /**
   * List all users (admin only)
   * Validates: Requirements 10.2
   */
  async listUsers(page: number = 1, limit: number = 20): Promise<{
    users: UserProfile[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        kycStatus: user.kycStatus,
        role: user.role,
        createdAt: user.createdAt,
        profile: user.profile,
      })),
      total,
      page,
      limit,
    };
  }
}

export const userService = new UserService();
export default userService;
