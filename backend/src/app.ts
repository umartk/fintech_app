import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit';
import { auditContext } from './middleware/auditLog';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import transactionRoutes from './routes/transaction.routes';
import paymentMethodRoutes from './routes/paymentMethod.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit context - adds correlation ID to all requests
app.use(auditContext);

// Request logging
app.use(requestLogger);

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes with rate limiting
// Auth routes have stricter rate limiting
app.use('/api/auth', authRateLimiter, authRoutes);
// Other API routes use standard rate limiting
app.use('/api/users', apiRateLimiter, userRoutes);
app.use('/api/transactions', apiRateLimiter, transactionRoutes);
app.use('/api/payment-methods', apiRateLimiter, paymentMethodRoutes);
// Admin routes with standard rate limiting
app.use('/api/admin', apiRateLimiter, adminRoutes);

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
