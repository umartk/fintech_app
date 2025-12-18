/**
 * Integration tests for Fintech Mobile App API
 * Tests end-to-end user flows: signup, login, transactions
 * Validates: All requirements integration
 */

import request from 'supertest';
import app from '../../app';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Test data
const testUser = {
  email: `integration-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

let userId: string;
let accessToken: string;
let refreshToken: string;
let accountId: string;

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { fromAccount: { user: { email: { contains: 'integration-test' } } } },
          { toAccount: { user: { email: { contains: 'integration-test' } } } },
        ],
      },
    });
    await prisma.account.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'integration-test' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { fromAccount: { user: { email: { contains: 'integration-test' } } } },
          { toAccount: { user: { email: { contains: 'integration-test' } } } },
        ],
      },
    });
    await prisma.account.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { user: { email: { contains: 'integration-test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'integration-test' } },
    });
    await prisma.$disconnect();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Flow', () => {
    describe('POST /api/auth/signup', () => {
      it('should create a new user account', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send(testUser);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.userId).toBeDefined();
        expect(response.body.data.requiresOTP).toBe(true);

        userId = response.body.data.userId;
      });

      it('should reject duplicate email registration', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send(testUser);

        expect(response.status).toBe(409);
        expect(response.body.status).toBe('error');
      });

      it('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({ email: 'invalid-email', password: 'TestPassword123!' });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });

      it('should reject weak password', async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({ email: 'weak-password@example.com', password: 'weak' });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });
    });

    describe('POST /api/auth/verify-otp', () => {
      it('should verify OTP and activate account', async () => {
        // Get the OTP from database (in real scenario, this would be sent via email)
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        expect(user).toBeDefined();
        expect(user?.otpCode).toBeDefined();

        const response = await request(app)
          .post('/api/auth/verify-otp')
          .send({ userId, otp: user?.otpCode });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();

        accessToken = response.body.data.accessToken;
        refreshToken = response.body.data.refreshToken;
      });

      it('should reject invalid OTP', async () => {
        const response = await request(app)
          .post('/api/auth/verify-otp')
          .send({ userId, otp: '000000' });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send(testUser);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();

        accessToken = response.body.data.accessToken;
        refreshToken = response.body.data.refreshToken;
      });

      it('should reject invalid password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: testUser.email, password: 'WrongPassword123!' });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
      });

      it('should reject non-existent user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'TestPassword123!' });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh access token with valid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.accessToken).toBeDefined();

        accessToken = response.body.data.accessToken;
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-token' });

        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
      });
    });
  });

  describe('User Profile Flow', () => {
    describe('GET /api/users/profile', () => {
      it('should return user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.email).toBe(testUser.email);
      });

      it('should reject request without token', async () => {
        const response = await request(app).get('/api/users/profile');

        expect(response.status).toBe(401);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/users/balance', () => {
      it('should return account balance', async () => {
        const response = await request(app)
          .get('/api/users/balance')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.balance).toBeDefined();
        expect(response.body.data.currency).toBeDefined();

        // Store account ID for transaction tests
        const account = await prisma.account.findFirst({
          where: { userId },
        });
        accountId = account?.id || '';
      });
    });

    describe('PATCH /api/users/profile', () => {
      it('should update user profile', async () => {
        const response = await request(app)
          .patch('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ firstName: 'Test', lastName: 'User' });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      });
    });
  });

  describe('Transaction Flow', () => {
    let recipientUserId: string;
    let recipientAccessToken: string;

    beforeAll(async () => {
      // Create a recipient user for transaction tests
      const recipientEmail = `integration-recipient-${Date.now()}@example.com`;
      const recipientResponse = await request(app)
        .post('/api/auth/signup')
        .send({ email: recipientEmail, password: 'TestPassword123!' });

      recipientUserId = recipientResponse.body.data.userId;

      // Verify recipient OTP
      const recipient = await prisma.user.findUnique({
        where: { id: recipientUserId },
      });

      const verifyResponse = await request(app)
        .post('/api/auth/verify-otp')
        .send({ userId: recipientUserId, otp: recipient?.otpCode });

      recipientAccessToken = verifyResponse.body.data.accessToken;

      // Add balance to sender account for testing
      await prisma.account.update({
        where: { userId },
        data: { balance: 1000 },
      });
    });

    describe('POST /api/transactions/transfer', () => {
      it('should create a transfer with valid data', async () => {
        const response = await request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            toUserId: recipientUserId,
            amount: 100,
            description: 'Test transfer',
            idempotencyKey: `test-${Date.now()}`,
          });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.amount).toBe(100);
        expect(response.body.data.status).toBeDefined();
      });

      it('should reject transfer with insufficient funds', async () => {
        const response = await request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            toUserId: recipientUserId,
            amount: 100000,
            description: 'Large transfer',
            idempotencyKey: `test-large-${Date.now()}`,
          });

        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
      });

      it('should reject transfer to non-existent user', async () => {
        const response = await request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            toUserId: '00000000-0000-0000-0000-000000000000',
            amount: 10,
            description: 'Invalid transfer',
            idempotencyKey: `test-invalid-${Date.now()}`,
          });

        expect(response.status).toBe(404);
        expect(response.body.status).toBe('error');
      });

      it('should handle idempotent requests', async () => {
        const idempotencyKey = `idempotent-${Date.now()}`;

        // First request
        const response1 = await request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            toUserId: recipientUserId,
            amount: 50,
            description: 'Idempotent test',
            idempotencyKey,
          });

        expect(response1.status).toBe(201);

        // Second request with same idempotency key
        const response2 = await request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            toUserId: recipientUserId,
            amount: 50,
            description: 'Idempotent test',
            idempotencyKey,
          });

        // Should return the same transaction
        expect(response2.status).toBe(201);
        expect(response2.body.data.id).toBe(response1.body.data.id);
      });
    });

    describe('GET /api/transactions', () => {
      it('should return transaction history', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.transactions).toBeDefined();
        expect(Array.isArray(response.body.data.transactions)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, limit: 5 });

        expect(response.status).toBe(200);
        expect(response.body.data.transactions.length).toBeLessThanOrEqual(5);
      });
    });

    describe('GET /api/transactions/:transactionId', () => {
      let transactionId: string;

      beforeAll(async () => {
        // Get a transaction ID from history
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, limit: 1 });

        if (response.body.data.transactions.length > 0) {
          transactionId = response.body.data.transactions[0].id;
        }
      });

      it('should return transaction details', async () => {
        if (!transactionId) {
          console.log('Skipping test - no transactions available');
          return;
        }

        const response = await request(app)
          .get(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data.id).toBe(transactionId);
      });

      it('should reject access to other users transactions', async () => {
        if (!transactionId) {
          console.log('Skipping test - no transactions available');
          return;
        }

        // Create a new user to test access control
        const otherEmail = `integration-other-${Date.now()}@example.com`;
        const signupResponse = await request(app)
          .post('/api/auth/signup')
          .send({ email: otherEmail, password: 'TestPassword123!' });

        const otherUser = await prisma.user.findUnique({
          where: { id: signupResponse.body.data.userId },
        });

        const verifyResponse = await request(app)
          .post('/api/auth/verify-otp')
          .send({ userId: signupResponse.body.data.userId, otp: otherUser?.otpCode });

        const otherToken = verifyResponse.body.data.accessToken;

        const response = await request(app)
          .get(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Route not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet adds these headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should not expose sensitive error details in production', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      // Error message should not contain stack trace or internal details
      expect(response.body.stack).toBeUndefined();
    });
  });
});
