import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { validateInput } from '../middleware/validateInput';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { auditSecurityEvent } from '../middleware/auditLog';
import { z } from 'zod';
import { paginationSchema, uuidSchema } from '../validation/schemas';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Validation schemas for admin endpoints
const adminUserListSchema = paginationSchema.extend({
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  flaggedOnly: z.string().optional(),
  search: z.string().max(100).optional(),
});

const accountStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
});

const transactionFilterSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  type: z.enum(['TRANSFER', 'DEPOSIT', 'WITHDRAWAL']).optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: uuidSchema.optional(),
  flaggedOnly: z.string().optional(),
});

const flagSuspiciousSchema = z.object({
  entityType: z.enum(['USER', 'TRANSACTION']),
  entityId: uuidSchema,
  reason: z.string().min(1).max(500),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

const resolveFlagSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const flagListSchema = paginationSchema.extend({
  entityType: z.enum(['USER', 'TRANSACTION']).optional(),
  resolved: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

const complianceReportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const auditLogSchema = z.object({
  userId: uuidSchema.optional(),
  eventType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  success: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});


// User management endpoints
// GET /api/admin/users - List all users with admin details
router.get(
  '/users',
  validateInput(adminUserListSchema, { target: 'query' }),
  adminController.listUsers.bind(adminController)
);

// GET /api/admin/users/:userId - Get detailed user information
router.get(
  '/users/:userId',
  validateInput(z.object({ userId: uuidSchema }), { target: 'params' }),
  adminController.getUserDetails.bind(adminController)
);

// PATCH /api/admin/users/:userId/account-status - Update account status
router.patch(
  '/users/:userId/account-status',
  validateInput(z.object({ userId: uuidSchema }), { target: 'params' }),
  validateInput(accountStatusSchema),
  auditSecurityEvent('SECURITY_SETTINGS_CHANGE'),
  adminController.updateAccountStatus.bind(adminController)
);

// Transaction monitoring endpoints
// GET /api/admin/transactions - Get transactions with filtering
router.get(
  '/transactions',
  validateInput(transactionFilterSchema, { target: 'query' }),
  adminController.getTransactions.bind(adminController)
);

// Suspicious activity flagging endpoints
// POST /api/admin/flags - Flag suspicious activity
router.post(
  '/flags',
  validateInput(flagSuspiciousSchema),
  auditSecurityEvent('SUSPICIOUS_ACTIVITY'),
  adminController.flagSuspiciousActivity.bind(adminController)
);

// GET /api/admin/flags - Get suspicious activity flags
router.get(
  '/flags',
  validateInput(flagListSchema, { target: 'query' }),
  adminController.getSuspiciousFlags.bind(adminController)
);

// PATCH /api/admin/flags/:flagId/resolve - Resolve a flag
router.patch(
  '/flags/:flagId/resolve',
  validateInput(z.object({ flagId: z.string().min(1) }), { target: 'params' }),
  validateInput(resolveFlagSchema),
  auditSecurityEvent('SUSPICIOUS_ACTIVITY'),
  adminController.resolveSuspiciousFlag.bind(adminController)
);

// Compliance reporting endpoints
// POST /api/admin/reports/compliance - Generate compliance report
router.post(
  '/reports/compliance',
  validateInput(complianceReportSchema),
  adminController.generateComplianceReport.bind(adminController)
);

// Audit log endpoints
// GET /api/admin/audit-logs - Get audit logs
router.get(
  '/audit-logs',
  validateInput(auditLogSchema, { target: 'query' }),
  adminController.getAuditLogs.bind(adminController)
);

// GET /api/admin/audit-logs/stats - Get audit log statistics
router.get(
  '/audit-logs/stats',
  adminController.getAuditStats.bind(adminController)
);

export default router;
