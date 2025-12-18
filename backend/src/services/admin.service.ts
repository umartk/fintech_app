import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { getAuditLogs, getAuditLogStats, SecurityEventType, AuditLogEntry } from '../middleware/auditLog';
import { KycStatus, TransactionStatus, AccountStatus, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface AdminUserListResult {
  users: AdminUserInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  kycStatus: KycStatus;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  accountStatus: AccountStatus | null;
  accountBalance: number | null;
  transactionCount: number;
  isFlagged: boolean;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
  } | null;
}

export interface TransactionMonitoringResult {
  transactions: AdminTransactionInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: TransactionSummary;
}

export interface AdminTransactionInfo {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromUser: { id: string; email: string };
  toUser: { id: string; email: string };
  amount: number;
  currency: string;
  type: string;
  status: TransactionStatus;
  description: string | null;
  isFlagged: boolean;
  flagReason: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface TransactionSummary {
  totalAmount: number;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  flaggedCount: number;
}


export interface TransactionFilterOptions {
  page: number;
  limit: number;
  status?: TransactionStatus;
  type?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  flaggedOnly?: boolean;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  period: { startDate: Date; endDate: Date };
  summary: {
    totalUsers: number;
    newUsers: number;
    verifiedUsers: number;
    pendingKycUsers: number;
    rejectedKycUsers: number;
    totalTransactions: number;
    totalTransactionVolume: number;
    flaggedTransactions: number;
    flaggedUsers: number;
    suspendedAccounts: number;
  };
  securityEvents: {
    loginAttempts: number;
    failedLogins: number;
    passwordChanges: number;
    suspiciousActivities: number;
  };
  auditTrail: AuditLogEntry[];
}

export interface SuspiciousActivityFlag {
  id: string;
  entityType: 'USER' | 'TRANSACTION';
  entityId: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flaggedAt: Date;
  flaggedBy: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

// In-memory storage for flags (in production, use database)
const suspiciousFlags: SuspiciousActivityFlag[] = [];

export class AdminService {
  /**
   * List all users with admin-level details
   * Validates: Requirements 10.1, 10.2
   */
  async listUsers(options: {
    page: number;
    limit: number;
    kycStatus?: KycStatus;
    role?: Role;
    flaggedOnly?: boolean;
    search?: string;
  }): Promise<AdminUserListResult> {
    const { page, limit, kycStatus, role, flaggedOnly, search } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (kycStatus) where.kycStatus = kycStatus;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          profile: true,
          account: {
            include: {
              _count: {
                select: {
                  outgoingTransactions: true,
                  incomingTransactions: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    let userInfos: AdminUserInfo[] = users.map((user) => {
      const transactionCount = user.account
        ? user.account._count.outgoingTransactions + user.account._count.incomingTransactions
        : 0;
      const isFlagged = suspiciousFlags.some(
        (f) => f.entityType === 'USER' && f.entityId === user.id && !f.resolved
      );

      return {
        id: user.id,
        email: user.email,
        kycStatus: user.kycStatus,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        accountStatus: user.account?.status || null,
        accountBalance: user.account?.balance.toNumber() || null,
        transactionCount,
        isFlagged,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              phoneNumber: user.profile.phoneNumber,
            }
          : null,
      };
    });

    if (flaggedOnly) {
      userInfos = userInfos.filter((u) => u.isFlagged);
    }

    return {
      users: userInfos,
      total: flaggedOnly ? userInfos.length : total,
      page,
      limit,
      totalPages: Math.ceil((flaggedOnly ? userInfos.length : total) / limit),
    };
  }


  /**
   * Get detailed user information for admin review
   * Validates: Requirements 10.2
   */
  async getUserDetails(userId: string): Promise<AdminUserInfo & { recentTransactions: AdminTransactionInfo[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        account: {
          include: {
            outgoingTransactions: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                fromAccount: { include: { user: { select: { id: true, email: true } } } },
                toAccount: { include: { user: { select: { id: true, email: true } } } },
              },
            },
            incomingTransactions: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                fromAccount: { include: { user: { select: { id: true, email: true } } } },
                toAccount: { include: { user: { select: { id: true, email: true } } } },
              },
            },
            _count: {
              select: {
                outgoingTransactions: true,
                incomingTransactions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const transactionCount = user.account
      ? user.account._count.outgoingTransactions + user.account._count.incomingTransactions
      : 0;
    const isFlagged = suspiciousFlags.some(
      (f) => f.entityType === 'USER' && f.entityId === user.id && !f.resolved
    );

    const allTransactions = [
      ...(user.account?.outgoingTransactions || []),
      ...(user.account?.incomingTransactions || []),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    const recentTransactions: AdminTransactionInfo[] = allTransactions.map((t) => {
      const txFlag = suspiciousFlags.find(
        (f) => f.entityType === 'TRANSACTION' && f.entityId === t.id && !f.resolved
      );
      return {
        id: t.id,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        fromUser: t.fromAccount.user,
        toUser: t.toAccount.user,
        amount: t.amount.toNumber(),
        currency: t.currency,
        type: t.type,
        status: t.status,
        description: t.description,
        isFlagged: !!txFlag,
        flagReason: txFlag?.reason || null,
        createdAt: t.createdAt,
        processedAt: t.processedAt,
      };
    });

    return {
      id: user.id,
      email: user.email,
      kycStatus: user.kycStatus,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      accountStatus: user.account?.status || null,
      accountBalance: user.account?.balance.toNumber() || null,
      transactionCount,
      isFlagged,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phoneNumber: user.profile.phoneNumber,
          }
        : null,
      recentTransactions,
    };
  }

  /**
   * Suspend or activate a user account
   * Validates: Requirements 10.1
   */
  async updateAccountStatus(userId: string, status: AccountStatus): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    await prisma.account.update({
      where: { userId },
      data: { status },
    });
  }


  /**
   * Get transactions with filtering and monitoring capabilities
   * Validates: Requirements 10.3
   */
  async getTransactions(options: TransactionFilterOptions): Promise<TransactionMonitoringResult> {
    const { page, limit, status, type, minAmount, maxAmount, startDate, endDate, userId, flaggedOnly } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) (where.amount as Record<string, unknown>).gte = new Decimal(minAmount);
      if (maxAmount !== undefined) (where.amount as Record<string, unknown>).lte = new Decimal(maxAmount);
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, unknown>).lte = endDate;
    }
    if (userId) {
      const account = await prisma.account.findUnique({ where: { userId } });
      if (account) {
        where.OR = [{ fromAccountId: account.id }, { toAccountId: account.id }];
      }
    }

    const [transactions, total, summaryData] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          fromAccount: { include: { user: { select: { id: true, email: true } } } },
          toAccount: { include: { user: { select: { id: true, email: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    // Get status counts
    const [completedCount, pendingCount, failedCount] = await Promise.all([
      prisma.transaction.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.transaction.count({ where: { ...where, status: 'PENDING' } }),
      prisma.transaction.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    let transactionInfos: AdminTransactionInfo[] = transactions.map((t) => {
      const txFlag = suspiciousFlags.find(
        (f) => f.entityType === 'TRANSACTION' && f.entityId === t.id && !f.resolved
      );
      return {
        id: t.id,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        fromUser: t.fromAccount.user,
        toUser: t.toAccount.user,
        amount: t.amount.toNumber(),
        currency: t.currency,
        type: t.type,
        status: t.status,
        description: t.description,
        isFlagged: !!txFlag,
        flagReason: txFlag?.reason || null,
        createdAt: t.createdAt,
        processedAt: t.processedAt,
      };
    });

    if (flaggedOnly) {
      transactionInfos = transactionInfos.filter((t) => t.isFlagged);
    }

    const flaggedCount = suspiciousFlags.filter(
      (f) => f.entityType === 'TRANSACTION' && !f.resolved
    ).length;

    return {
      transactions: transactionInfos,
      total: flaggedOnly ? transactionInfos.length : total,
      page,
      limit,
      totalPages: Math.ceil((flaggedOnly ? transactionInfos.length : total) / limit),
      summary: {
        totalAmount: summaryData._sum.amount?.toNumber() || 0,
        totalCount: summaryData._count._all,
        completedCount,
        pendingCount,
        failedCount,
        flaggedCount,
      },
    };
  }


  /**
   * Flag suspicious activity on a user or transaction
   * Validates: Requirements 10.4
   */
  flagSuspiciousActivity(
    entityType: 'USER' | 'TRANSACTION',
    entityId: string,
    reason: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    flaggedBy: string
  ): SuspiciousActivityFlag {
    const flag: SuspiciousActivityFlag = {
      id: `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType,
      entityId,
      reason,
      severity,
      flaggedAt: new Date(),
      flaggedBy,
      resolved: false,
    };

    suspiciousFlags.push(flag);
    return flag;
  }

  /**
   * Resolve a suspicious activity flag
   * Validates: Requirements 10.4
   */
  resolveSuspiciousFlag(
    flagId: string,
    resolvedBy: string,
    notes?: string
  ): SuspiciousActivityFlag {
    const flag = suspiciousFlags.find((f) => f.id === flagId);
    if (!flag) {
      throw new NotFoundError('Flag not found');
    }

    flag.resolved = true;
    flag.resolvedAt = new Date();
    flag.resolvedBy = resolvedBy;
    flag.notes = notes;

    return flag;
  }

  /**
   * Get all suspicious activity flags
   * Validates: Requirements 10.4
   */
  getSuspiciousFlags(options: {
    entityType?: 'USER' | 'TRANSACTION';
    resolved?: boolean;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    page: number;
    limit: number;
  }): { flags: SuspiciousActivityFlag[]; total: number; page: number; limit: number } {
    let filtered = [...suspiciousFlags];

    if (options.entityType) {
      filtered = filtered.filter((f) => f.entityType === options.entityType);
    }
    if (options.resolved !== undefined) {
      filtered = filtered.filter((f) => f.resolved === options.resolved);
    }
    if (options.severity) {
      filtered = filtered.filter((f) => f.severity === options.severity);
    }

    filtered.sort((a, b) => b.flaggedAt.getTime() - a.flaggedAt.getTime());

    const total = filtered.length;
    const skip = (options.page - 1) * options.limit;

    return {
      flags: filtered.slice(skip, skip + options.limit),
      total,
      page: options.page,
      limit: options.limit,
    };
  }


  /**
   * Generate compliance report
   * Validates: Requirements 10.5
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // User statistics
    const [totalUsers, newUsers, verifiedUsers, pendingKycUsers, rejectedKycUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.user.count({ where: { kycStatus: 'VERIFIED' } }),
      prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      prisma.user.count({ where: { kycStatus: 'REJECTED' } }),
    ]);

    // Transaction statistics
    const transactionStats = await prisma.transaction.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
      _sum: { amount: true },
    });

    // Account statistics
    const suspendedAccounts = await prisma.account.count({
      where: { status: 'SUSPENDED' },
    });

    // Flagged items
    const flaggedTransactions = suspiciousFlags.filter(
      (f) =>
        f.entityType === 'TRANSACTION' &&
        !f.resolved &&
        f.flaggedAt >= startDate &&
        f.flaggedAt <= endDate
    ).length;

    const flaggedUsers = suspiciousFlags.filter(
      (f) =>
        f.entityType === 'USER' &&
        !f.resolved &&
        f.flaggedAt >= startDate &&
        f.flaggedAt <= endDate
    ).length;

    // Security events from audit logs
    const auditData = getAuditLogs({
      startDate,
      endDate,
      limit: 1000,
    });

    const loginAttempts = auditData.logs.filter(
      (l) => l.eventType === 'LOGIN_SUCCESS' || l.eventType === 'LOGIN_FAILURE'
    ).length;
    const failedLogins = auditData.logs.filter((l) => l.eventType === 'LOGIN_FAILURE').length;
    const passwordChanges = auditData.logs.filter((l) => l.eventType === 'PASSWORD_CHANGE').length;
    const suspiciousActivities = auditData.logs.filter(
      (l) => l.eventType === 'SUSPICIOUS_ACTIVITY'
    ).length;

    // Get recent audit trail for the report
    const auditTrail = getAuditLogs({
      startDate,
      endDate,
      limit: 100,
    }).logs;

    return {
      reportId,
      generatedAt: new Date(),
      period: { startDate, endDate },
      summary: {
        totalUsers,
        newUsers,
        verifiedUsers,
        pendingKycUsers,
        rejectedKycUsers,
        totalTransactions: transactionStats._count._all,
        totalTransactionVolume: transactionStats._sum.amount?.toNumber() || 0,
        flaggedTransactions,
        flaggedUsers,
        suspendedAccounts,
      },
      securityEvents: {
        loginAttempts,
        failedLogins,
        passwordChanges,
        suspiciousActivities,
      },
      auditTrail,
    };
  }

  /**
   * Get audit log statistics
   * Validates: Requirements 10.5
   */
  getAuditStats(): Record<SecurityEventType, { total: number; success: number; failure: number }> {
    return getAuditLogStats();
  }

  /**
   * Get audit logs with filtering
   * Validates: Requirements 9.5, 10.5
   */
  getAuditLogs(options: {
    userId?: string;
    eventType?: SecurityEventType;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): { logs: AuditLogEntry[]; total: number } {
    return getAuditLogs(options);
  }

  /**
   * Clear suspicious flags (for testing)
   */
  clearFlags(): void {
    suspiciousFlags.length = 0;
  }
}

export const adminService = new AdminService();
export default adminService;
