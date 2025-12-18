import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import redis from '../config/redis';

let io: Server;

// Session management types
interface UserSession {
  socketId: string;
  userId: string;
  deviceId?: string;
  connectedAt: Date;
}

interface TransactionUpdate {
  transactionId: string;
  status: string;
  amount?: number;
  fromUserId?: string;
  toUserId?: string;
  timestamp: Date;
}

// Session storage key prefix
const SESSION_PREFIX = 'ws:session:';
const USER_SESSIONS_PREFIX = 'ws:user:';
const SESSION_TTL = 86400; // 24 hours

/**
 * Initialize WebSocket server with Socket.io
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
export const initializeWebSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        // Allow connection without auth for initial handshake
        // User must authenticate via 'authenticate' event
        return next();
      }

      const decoded = verifyToken(token as string);
      if (decoded) {
        socket.data.userId = decoded.userId;
        socket.data.authenticated = true;
      }
      next();
    } catch (error) {
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle authentication event
    socket.on('authenticate', async (data: { token: string; deviceId?: string }) => {
      try {
        const decoded = verifyToken(data.token);
        if (!decoded) {
          socket.emit('auth_error', { message: 'Invalid token' });
          return;
        }

        socket.data.userId = decoded.userId;
        socket.data.deviceId = data.deviceId;
        socket.data.authenticated = true;

        // Register session
        await registerSession(socket.id, decoded.userId, data.deviceId);

        // Join user's room for broadcasts
        socket.join(`user:${decoded.userId}`);

        socket.emit('authenticated', { 
          userId: decoded.userId,
          socketId: socket.id 
        });

        console.log(`User ${decoded.userId} authenticated on socket ${socket.id}`);
      } catch (error) {
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    // Handle join room (legacy support)
    socket.on('join', async (userId: string) => {
      if (socket.data.authenticated && socket.data.userId === userId) {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined their room`);
      } else {
        socket.emit('error', { message: 'Unauthorized: Please authenticate first' });
      }
    });

    // Handle ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle reconnection sync request
    socket.on('sync_request', async (data: { lastSyncTimestamp?: string }) => {
      if (!socket.data.authenticated || !socket.data.userId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      try {
        // Get missed updates from Redis
        const missedUpdates = await getMissedUpdates(
          socket.data.userId,
          data.lastSyncTimestamp ? new Date(data.lastSyncTimestamp) : undefined
        );

        socket.emit('sync_response', {
          updates: missedUpdates,
          syncTimestamp: new Date().toISOString(),
        });
      } catch (error) {
        socket.emit('sync_error', { message: 'Failed to sync updates' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason);
      
      if (socket.data.userId) {
        await removeSession(socket.id, socket.data.userId);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', socket.id, error);
    });
  });

  return io;
};

/**
 * Get the Socket.io server instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
};

/**
 * Verify JWT token
 */
const verifyToken = (token: string): { userId: string } | null => {
  try {
    const secret = process.env.JWT_SECRET || 'test-secret';
    const decoded = jwt.verify(token, secret) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Register a user session in Redis
 */
export const registerSession = async (
  socketId: string,
  userId: string,
  deviceId?: string
): Promise<void> => {
  const session: UserSession = {
    socketId,
    userId,
    deviceId,
    connectedAt: new Date(),
  };

  // Store session data
  await redis.setex(
    `${SESSION_PREFIX}${socketId}`,
    SESSION_TTL,
    JSON.stringify(session)
  );

  // Add to user's session set
  await redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, socketId);
  await redis.expire(`${USER_SESSIONS_PREFIX}${userId}`, SESSION_TTL);
};

/**
 * Remove a user session from Redis
 */
export const removeSession = async (socketId: string, userId: string): Promise<void> => {
  await redis.del(`${SESSION_PREFIX}${socketId}`);
  await redis.srem(`${USER_SESSIONS_PREFIX}${userId}`, socketId);
};

/**
 * Get all active sessions for a user
 */
export const getUserSessions = async (userId: string): Promise<UserSession[]> => {
  const socketIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
  const sessions: UserSession[] = [];

  for (const socketId of socketIds) {
    const sessionData = await redis.get(`${SESSION_PREFIX}${socketId}`);
    if (sessionData) {
      sessions.push(JSON.parse(sessionData));
    } else {
      // Clean up stale session reference
      await redis.srem(`${USER_SESSIONS_PREFIX}${userId}`, socketId);
    }
  }

  return sessions;
};

/**
 * Broadcast to a specific user across all their connected devices
 * Validates: Requirements 8.1, 8.4
 */
export const broadcastToUser = (userId: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Broadcast transaction update to both sender and recipient
 * Validates: Requirements 8.1, 8.4
 */
export const broadcastTransactionUpdate = async (
  update: TransactionUpdate
): Promise<{ senderNotified: boolean; recipientNotified: boolean }> => {
  const result = { senderNotified: false, recipientNotified: false };

  if (!io) {
    console.warn('WebSocket server not initialized, skipping broadcast');
    return result;
  }

  const eventData = {
    type: 'transaction_update',
    data: {
      transactionId: update.transactionId,
      status: update.status,
      amount: update.amount,
      timestamp: update.timestamp.toISOString(),
    },
  };

  // Store update for offline sync
  if (update.fromUserId) {
    await storeUpdateForUser(update.fromUserId, eventData);
    const senderSessions = await getUserSessions(update.fromUserId);
    if (senderSessions.length > 0) {
      broadcastToUser(update.fromUserId, 'transaction_update', eventData);
      result.senderNotified = true;
    }
  }

  if (update.toUserId && update.toUserId !== update.fromUserId) {
    await storeUpdateForUser(update.toUserId, eventData);
    const recipientSessions = await getUserSessions(update.toUserId);
    if (recipientSessions.length > 0) {
      broadcastToUser(update.toUserId, 'transaction_update', eventData);
      result.recipientNotified = true;
    }
  }

  return result;
};

/**
 * Store update for offline sync
 */
const storeUpdateForUser = async (userId: string, update: unknown): Promise<void> => {
  const key = `ws:updates:${userId}`;
  const updateWithTimestamp = {
    ...update as object,
    storedAt: new Date().toISOString(),
  };
  
  await redis.lpush(key, JSON.stringify(updateWithTimestamp));
  await redis.ltrim(key, 0, 99); // Keep last 100 updates
  await redis.expire(key, 86400); // Expire after 24 hours
};

/**
 * Get missed updates for a user since last sync
 */
export const getMissedUpdates = async (
  userId: string,
  since?: Date
): Promise<unknown[]> => {
  const key = `ws:updates:${userId}`;
  const updates = await redis.lrange(key, 0, -1);
  
  if (!since) {
    return updates.map((u) => JSON.parse(u));
  }

  return updates
    .map((u) => JSON.parse(u))
    .filter((u) => new Date(u.storedAt) > since);
};

/**
 * Clear updates for a user (after successful sync)
 */
export const clearUserUpdates = async (userId: string): Promise<void> => {
  await redis.del(`ws:updates:${userId}`);
};

/**
 * Check if a user has any active connections
 */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  const sessions = await getUserSessions(userId);
  return sessions.length > 0;
};

/**
 * Get connection count for a user
 */
export const getUserConnectionCount = async (userId: string): Promise<number> => {
  const sessions = await getUserSessions(userId);
  return sessions.length;
};

export default {
  initializeWebSocket,
  getIO,
  broadcastToUser,
  broadcastTransactionUpdate,
  registerSession,
  removeSession,
  getUserSessions,
  getMissedUpdates,
  clearUserUpdates,
  isUserOnline,
  getUserConnectionCount,
};
