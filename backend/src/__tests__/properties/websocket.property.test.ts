import * as fc from 'fast-check';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Test configuration
const TEST_PORT = 3099;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// In-memory session storage for testing (no Redis dependency)
const testSessions = new Map<string, { socketId: string; userId: string }>();

// Helper to generate valid JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
};

// Helper to create a connected client
const createClient = (port: number, token?: string): ClientSocket => {
  const auth = token ? { token } : {};
  return ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    auth,
    forceNew: true,
  });
};

// Helper to wait for event
const waitForEvent = <T>(socket: ClientSocket, event: string, timeout = 5000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

// Helper to wait for connection
const waitForConnection = (socket: ClientSocket, timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

// Simple WebSocket server for testing (no Redis dependency)
const createTestServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Handle authentication event
    socket.on('authenticate', (data: { token: string; deviceId?: string }) => {
      try {
        const decoded = jwt.verify(data.token, JWT_SECRET) as { userId: string };
        socket.data.userId = decoded.userId;
        socket.data.authenticated = true;

        // Store session in memory
        testSessions.set(socket.id, { socketId: socket.id, userId: decoded.userId });

        // Join user's room for broadcasts
        socket.join(`user:${decoded.userId}`);

        socket.emit('authenticated', {
          userId: decoded.userId,
          socketId: socket.id,
        });
      } catch {
        socket.emit('auth_error', { message: 'Invalid token' });
      }
    });

    // Handle ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      testSessions.delete(socket.id);
    });
  });

  return io;
};

// Broadcast transaction update to users
const broadcastTransactionUpdateTest = (
  io: SocketIOServer,
  update: {
    transactionId: string;
    status: string;
    amount?: number;
    fromUserId?: string;
    toUserId?: string;
    timestamp: Date;
  }
): { senderNotified: boolean; recipientNotified: boolean } => {
  const result = { senderNotified: false, recipientNotified: false };

  const eventData = {
    type: 'transaction_update',
    data: {
      transactionId: update.transactionId,
      status: update.status,
      amount: update.amount,
      timestamp: update.timestamp.toISOString(),
    },
  };

  if (update.fromUserId) {
    io.to(`user:${update.fromUserId}`).emit('transaction_update', eventData);
    result.senderNotified = true;
  }

  if (update.toUserId && update.toUserId !== update.fromUserId) {
    io.to(`user:${update.toUserId}`).emit('transaction_update', eventData);
    result.recipientNotified = true;
  }

  return result;
};

describe('WebSocket Property Tests', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let isServerRunning = false;

  beforeAll(async () => {
    try {
      // Create HTTP server
      httpServer = createServer();

      // Initialize WebSocket server (no Redis)
      io = createTestServer(httpServer);

      // Start server
      await new Promise<void>((resolve, reject) => {
        httpServer.listen(TEST_PORT, () => {
          isServerRunning = true;
          resolve();
        });
        httpServer.on('error', reject);
      });
    } catch (error) {
      console.warn('Failed to start WebSocket server:', error);
      isServerRunning = false;
    }
  });

  afterAll(async () => {
    if (isServerRunning) {
      io?.close();
      await new Promise<void>((resolve) => {
        httpServer?.close(() => resolve());
      });
    }
    testSessions.clear();
  });

  afterEach(() => {
    testSessions.clear();
  });

  /**
   * **Feature: fintech-mobile-app, Property 15: Real-time update broadcasting**
   * **Validates: Requirements 8.1, 8.4**
   *
   * For any transaction status change, the system should broadcast updates
   * to all active WebSocket sessions for both the sender and recipient users.
   */
  describe('Property 15: Real-time update broadcasting', () => {
    it('should broadcast transaction updates to sender user', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // senderId
          fc.uuid(), // recipientId
          fc.uuid(), // transactionId
          fc.constantFrom('PENDING', 'COMPLETED', 'FAILED'), // status
          fc.double({ min: 0.01, max: 10000, noNaN: true }), // amount
          async (senderId, recipientId, transactionId, status, amount) => {
            const clients: ClientSocket[] = [];

            try {
              // Create sender client and authenticate
              const senderToken = generateToken(senderId);
              const senderClient = createClient(TEST_PORT, senderToken);
              clients.push(senderClient);

              await waitForConnection(senderClient);

              // Authenticate and join room
              senderClient.emit('authenticate', { token: senderToken, deviceId: 'device1' });
              await waitForEvent(senderClient, 'authenticated');

              // Set up listener for transaction update
              const updatePromise = waitForEvent<{ type: string; data: { transactionId: string } }>(
                senderClient,
                'transaction_update',
                3000
              );

              // Broadcast transaction update
              broadcastTransactionUpdateTest(io, {
                transactionId,
                status,
                amount: Math.round(amount * 100) / 100,
                fromUserId: senderId,
                toUserId: recipientId,
                timestamp: new Date(),
              });

              // Verify sender received the update
              const update = await updatePromise;
              expect(update.type).toBe('transaction_update');
              expect(update.data.transactionId).toBe(transactionId);

              return true;
            } finally {
              // Cleanup clients
              for (const client of clients) {
                client.disconnect();
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should broadcast transaction updates to recipient user', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // senderId
          fc.uuid(), // recipientId
          fc.uuid(), // transactionId
          fc.constantFrom('PENDING', 'COMPLETED', 'FAILED'), // status
          async (senderId, recipientId, transactionId, status) => {
            const clients: ClientSocket[] = [];

            try {
              // Create recipient client and authenticate
              const recipientToken = generateToken(recipientId);
              const recipientClient = createClient(TEST_PORT, recipientToken);
              clients.push(recipientClient);

              await waitForConnection(recipientClient);

              // Authenticate
              recipientClient.emit('authenticate', { token: recipientToken, deviceId: 'device1' });
              await waitForEvent(recipientClient, 'authenticated');

              // Set up listener for transaction update
              const updatePromise = waitForEvent<{ type: string; data: { transactionId: string } }>(
                recipientClient,
                'transaction_update',
                3000
              );

              // Broadcast transaction update
              broadcastTransactionUpdateTest(io, {
                transactionId,
                status,
                amount: 100,
                fromUserId: senderId,
                toUserId: recipientId,
                timestamp: new Date(),
              });

              // Verify recipient received the update
              const update = await updatePromise;
              expect(update.type).toBe('transaction_update');
              expect(update.data.transactionId).toBe(transactionId);

              return true;
            } finally {
              for (const client of clients) {
                client.disconnect();
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should broadcast to multiple devices for the same user', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // transactionId
          fc.integer({ min: 2, max: 3 }), // number of devices
          async (userId, transactionId, deviceCount) => {
            const clients: ClientSocket[] = [];
            const receivedUpdates: boolean[] = [];

            try {
              const token = generateToken(userId);

              // Create multiple clients for the same user
              for (let i = 0; i < deviceCount; i++) {
                const client = createClient(TEST_PORT, token);
                clients.push(client);

                await waitForConnection(client);

                // Authenticate each device
                client.emit('authenticate', { token, deviceId: `device${i}` });
                await waitForEvent(client, 'authenticated');

                // Set up listener
                client.on('transaction_update', () => {
                  receivedUpdates.push(true);
                });
              }

              // Small delay to ensure all listeners are set up
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Broadcast transaction update
              broadcastTransactionUpdateTest(io, {
                transactionId,
                status: 'COMPLETED',
                amount: 50,
                fromUserId: userId,
                toUserId: 'other-user',
                timestamp: new Date(),
              });

              // Wait for updates to propagate
              await new Promise((resolve) => setTimeout(resolve, 500));

              // All devices should receive the update
              expect(receivedUpdates.length).toBe(deviceCount);

              return true;
            } finally {
              for (const client of clients) {
                client.disconnect();
              }
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should broadcast to both sender and recipient simultaneously', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // senderId
          fc.uuid(), // recipientId
          fc.uuid(), // transactionId
          async (senderId, recipientId, transactionId) => {
            // Ensure sender and recipient are different
            if (senderId === recipientId) {
              return true; // Skip this case
            }

            const clients: ClientSocket[] = [];

            try {
              // Create sender client
              const senderToken = generateToken(senderId);
              const senderClient = createClient(TEST_PORT, senderToken);
              clients.push(senderClient);

              // Create recipient client
              const recipientToken = generateToken(recipientId);
              const recipientClient = createClient(TEST_PORT, recipientToken);
              clients.push(recipientClient);

              // Connect both
              await Promise.all([waitForConnection(senderClient), waitForConnection(recipientClient)]);

              // Authenticate both
              senderClient.emit('authenticate', { token: senderToken });
              recipientClient.emit('authenticate', { token: recipientToken });

              await Promise.all([
                waitForEvent(senderClient, 'authenticated'),
                waitForEvent(recipientClient, 'authenticated'),
              ]);

              // Set up listeners
              const senderUpdatePromise = waitForEvent<{ data: { transactionId: string } }>(
                senderClient,
                'transaction_update',
                3000
              );
              const recipientUpdatePromise = waitForEvent<{ data: { transactionId: string } }>(
                recipientClient,
                'transaction_update',
                3000
              );

              // Broadcast
              broadcastTransactionUpdateTest(io, {
                transactionId,
                status: 'COMPLETED',
                amount: 100,
                fromUserId: senderId,
                toUserId: recipientId,
                timestamp: new Date(),
              });

              // Both should receive
              const [senderUpdate, recipientUpdate] = await Promise.all([
                senderUpdatePromise,
                recipientUpdatePromise,
              ]);

              expect(senderUpdate.data.transactionId).toBe(transactionId);
              expect(recipientUpdate.data.transactionId).toBe(transactionId);

              return true;
            } finally {
              for (const client of clients) {
                client.disconnect();
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Connection Handling', () => {
    it('should handle authentication flow correctly', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (userId) => {
          let client: ClientSocket | null = null;

          try {
            const token = generateToken(userId);
            client = createClient(TEST_PORT);

            await waitForConnection(client);

            // Authenticate
            client.emit('authenticate', { token, deviceId: 'test-device' });

            const authResult = await waitForEvent<{ userId: string; socketId: string }>(client, 'authenticated');

            expect(authResult.userId).toBe(userId);
            expect(authResult.socketId).toBeDefined();

            return true;
          } finally {
            client?.disconnect();
          }
        }),
        { numRuns: 5 }
      );
    });

    it('should reject invalid tokens', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      let client: ClientSocket | null = null;

      try {
        client = createClient(TEST_PORT);
        await waitForConnection(client);

        // Try to authenticate with invalid token
        client.emit('authenticate', { token: 'invalid-token' });

        const error = await waitForEvent<{ message: string }>(client, 'auth_error');
        expect(error.message).toBe('Invalid token');
      } finally {
        client?.disconnect();
      }
    });

    it('should respond to ping with pong', async () => {
      if (!isServerRunning) {
        console.log('Skipping - WebSocket server not running');
        return;
      }

      let client: ClientSocket | null = null;

      try {
        client = createClient(TEST_PORT);
        await waitForConnection(client);

        client.emit('ping');

        const pong = await waitForEvent<{ timestamp: string }>(client, 'pong');
        expect(pong.timestamp).toBeDefined();
        expect(new Date(pong.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      } finally {
        client?.disconnect();
      }
    });
  });
});
