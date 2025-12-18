import { Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { logSecurityEvent } from '../middleware/auditLog';
import { KycStatus, AccountStatus, Role, TransactionStatus } from '@prisma/client';

export class AdminController {
  /**
   * List all users with admin-level details
   * GET /api/admin/users
   * Validates: Requirements 10.1, 10.2
   */
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        kycStatus,
        role,
        flaggedOnly,
        search,
      } = req.query as {
        page?: number;
        limit?: number;
        kycStatus?: KycStatus;
        role?: Role;
        flaggedOnly?: string;
        search?: string;
      };

      const result = await adminService.listUsers({
        page: Number(page),
        limit: Number(limit),
        kycStatus,
        role,
        flaggedOnly: flaggedOnly === 'true',
        search,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed user information
   * GET /api/admin/users/:userId
   * Validates: Requirements 10.2
   */
  async getUserDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const result = await adminService.getUserDetails(userId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Update user account status (suspend/activate)
   * PATCH /api/admin/users/:userId/account-status
   * Validates: Requirements 10.1
   */
  async updateAccountStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body as { status: AccountStatus };

      await adminService.updateAccountStatus(userId, status);

      logSecurityEvent('SECURITY_SETTINGS_CHANGE', req, {
        userId: req.user!.userId,
        success: true,
        details: {
          action: 'UPDATE_ACCOUNT_STATUS',
          targetUserId: userId,
          newStatus: status,
        },
      });

      res.status(200).json({
        status: 'success',
        message: `Account status updated to ${status}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transactions with filtering and monitoring
   * GET /api/admin/transactions
   * Validates: Requirements 10.3
   */
  async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        type,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        userId,
        flaggedOnly,
      } = req.query as {
        page?: number;
        limit?: number;
        status?: TransactionStatus;
        type?: string;
        minAmount?: string;
        maxAmount?: string;
        startDate?: string;
        endDate?: string;
        userId?: string;
        flaggedOnly?: string;
      };

      const result = await adminService.getTransactions({
        page: Number(page),
        limit: Number(limit),
        status,
        type,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        userId,
        flaggedOnly: flaggedOnly === 'true',
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Flag suspicious activity
   * POST /api/admin/flags
   * Validates: Requirements 10.4
   */
  async flagSuspiciousActivity(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId, reason, severity } = req.body as {
        entityType: 'USER' | 'TRANSACTION';
        entityId: string;
        reason: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      };

      const flag = adminService.flagSuspiciousActivity(
        entityType,
        entityId,
        reason,
        severity,
        req.user!.userId
      );

      logSecurityEvent('SUSPICIOUS_ACTIVITY', req, {
        userId: req.user!.userId,
        success: true,
        details: {
          action: 'FLAG_CREATED',
          entityType,
          entityId,
          reason,
          severity,
          flagId: flag.id,
        },
      });

      res.status(201).json({
        status: 'success',
        message: 'Suspicious activity flagged',
        data: flag,
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Resolve a suspicious activity flag
   * PATCH /api/admin/flags/:flagId/resolve
   * Validates: Requirements 10.4
   */
  async resolveSuspiciousFlag(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flagId } = req.params;
      const { notes } = req.body as { notes?: string };

      const flag = adminService.resolveSuspiciousFlag(flagId, req.user!.userId, notes);

      logSecurityEvent('SUSPICIOUS_ACTIVITY', req, {
        userId: req.user!.userId,
        success: true,
        details: {
          action: 'FLAG_RESOLVED',
          flagId,
          notes,
        },
      });

      res.status(200).json({
        status: 'success',
        message: 'Flag resolved',
        data: flag,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get suspicious activity flags
   * GET /api/admin/flags
   * Validates: Requirements 10.4
   */
  async getSuspiciousFlags(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        entityType,
        resolved,
        severity,
      } = req.query as {
        page?: number;
        limit?: number;
        entityType?: 'USER' | 'TRANSACTION';
        resolved?: string;
        severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      };

      const result = adminService.getSuspiciousFlags({
        page: Number(page),
        limit: Number(limit),
        entityType,
        resolved: resolved !== undefined ? resolved === 'true' : undefined,
        severity,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate compliance report
   * POST /api/admin/reports/compliance
   * Validates: Requirements 10.5
   */
  async generateComplianceReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.body as {
        startDate: string;
        endDate: string;
      };

      const report = await adminService.generateComplianceReport(
        new Date(startDate),
        new Date(endDate)
      );

      res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit logs
   * GET /api/admin/audit-logs
   * Validates: Requirements 9.5, 10.5
   */
  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        userId,
        eventType,
        startDate,
        endDate,
        success,
        limit = 100,
        offset = 0,
      } = req.query as {
        userId?: string;
        eventType?: string;
        startDate?: string;
        endDate?: string;
        success?: string;
        limit?: number;
        offset?: number;
      };

      const result = adminService.getAuditLogs({
        userId,
        eventType: eventType as any,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        success: success !== undefined ? success === 'true' : undefined,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit log statistics
   * GET /api/admin/audit-logs/stats
   * Validates: Requirements 10.5
   */
  async getAuditStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = adminService.getAuditStats();

      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
export default adminController;
