/**
 * Integration tests for WebSocket real-time updates
 * Tests WebSocket connection and event handling
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { websocketService } from '../../services/websocket';
import { useTransactionStore } from '../../store/transactionStore';
import { useAccountStore } from '../../store/accountStore';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock secure storage
jest.mock('../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue('mock-access-token'),
    setItem: jest.fn().mockResolvedValue(undefined),
    setJSON: jest.fn().mockResolvedValue(undefined),
    getJSON: jest.fn().mockResolvedValue(null),
  },
}));

describe('WebSocket Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = true;
  });

  describe('Connection Management', () => {
    it('should connect with authentication token', async () => {
      await websocketService.connect();

      // Verify socket.io was called with auth token
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'mock-access-token' },
          transports: ['websocket'],
        })
      );
    });

    it('should set up event listeners on connect', async () => {
      await websocketService.connect();

      // Verify event listeners are registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('transaction:update', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('balance:update', expect.any(Function));
    });

    it('should disconnect and clean up handlers', () => {
      websocketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should report connection status correctly', () => {
      mockSocket.connected = true;
      expect(websocketService.isConnected()).toBe(true);

      mockSocket.connected = false;
      expect(websocketService.isConnected()).toBe(false);
    });
  });

  describe('Transaction Update Handling', () => {
    it('should register transaction update handler', async () => {
      const handler = jest.fn();
      
      await websocketService.connect();
      const unsubscribe = websocketService.onTransactionUpdate(handler);

      // Simulate transaction update event
      const transactionUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'transaction:update'
      );
      
      if (transactionUpdateCall) {
        const eventHandler = transactionUpdateCall[1];
        eventHandler({
          transactionId: 'tx-123',
          status: 'completed',
          processedAt: '2025-12-18T10:00:00Z',
        });
      }

      expect(handler).toHaveBeenCalledWith({
        transactionId: 'tx-123',
        status: 'completed',
        processedAt: '2025-12-18T10:00:00Z',
      });

      // Cleanup
      unsubscribe();
    });

    it('should allow multiple transaction update handlers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await websocketService.connect();
      websocketService.onTransactionUpdate(handler1);
      websocketService.onTransactionUpdate(handler2);

      // Simulate transaction update
      const transactionUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'transaction:update'
      );

      if (transactionUpdateCall) {
        const eventHandler = transactionUpdateCall[1];
        eventHandler({ transactionId: 'tx-456', status: 'pending' });
      }

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe handler correctly', async () => {
      const handler = jest.fn();

      await websocketService.connect();
      const unsubscribe = websocketService.onTransactionUpdate(handler);
      unsubscribe();

      // Simulate transaction update after unsubscribe
      const transactionUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'transaction:update'
      );

      if (transactionUpdateCall) {
        const eventHandler = transactionUpdateCall[1];
        eventHandler({ transactionId: 'tx-789', status: 'completed' });
      }

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Balance Update Handling', () => {
    it('should register balance update handler', async () => {
      const handler = jest.fn();

      await websocketService.connect();
      websocketService.onBalanceUpdate(handler);

      // Simulate balance update event
      const balanceUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'balance:update'
      );

      if (balanceUpdateCall) {
        const eventHandler = balanceUpdateCall[1];
        eventHandler({ balance: 1500 });
      }

      expect(handler).toHaveBeenCalledWith({ balance: 1500 });
    });

    it('should unsubscribe balance handler correctly', async () => {
      const handler = jest.fn();

      await websocketService.connect();
      const unsubscribe = websocketService.onBalanceUpdate(handler);
      unsubscribe();

      // Simulate balance update after unsubscribe
      const balanceUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'balance:update'
      );

      if (balanceUpdateCall) {
        const eventHandler = balanceUpdateCall[1];
        eventHandler({ balance: 2000 });
      }

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Store Integration', () => {
    beforeEach(() => {
      // Reset stores
      useTransactionStore.setState({
        transactions: [
          {
            id: 'tx-123',
            fromAccountId: 'acc-1',
            toAccountId: 'acc-2',
            amount: 100,
            currency: 'USD',
            type: 'transfer',
            status: 'pending',
            createdAt: '2025-12-18T09:00:00Z',
          },
        ],
        isLoading: false,
        error: null,
        hasMore: true,
        currentPage: 1,
      });

      useAccountStore.setState({
        account: {
          id: 'acc-1',
          balance: 1000,
          currency: 'USD',
          status: 'active',
        },
        paymentMethods: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
    });

    it('should update transaction status in store on WebSocket event', async () => {
      const { updateTransaction } = useTransactionStore.getState();

      await websocketService.connect();
      websocketService.onTransactionUpdate((data) => {
        updateTransaction(data.transactionId, {
          status: data.status as 'pending' | 'completed' | 'failed' | 'cancelled',
          processedAt: data.processedAt,
        });
      });

      // Simulate transaction update
      const transactionUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'transaction:update'
      );

      if (transactionUpdateCall) {
        const eventHandler = transactionUpdateCall[1];
        eventHandler({
          transactionId: 'tx-123',
          status: 'completed',
          processedAt: '2025-12-18T10:00:00Z',
        });
      }

      const { transactions } = useTransactionStore.getState();
      const updatedTransaction = transactions.find((t) => t.id === 'tx-123');
      
      expect(updatedTransaction?.status).toBe('completed');
      expect(updatedTransaction?.processedAt).toBe('2025-12-18T10:00:00Z');
    });

    it('should update account balance in store on WebSocket event', async () => {
      const { updateBalance } = useAccountStore.getState();

      await websocketService.connect();
      websocketService.onBalanceUpdate((data) => {
        updateBalance(data.balance);
      });

      // Simulate balance update
      const balanceUpdateCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'balance:update'
      );

      if (balanceUpdateCall) {
        const eventHandler = balanceUpdateCall[1];
        eventHandler({ balance: 1500 });
      }

      const { account } = useAccountStore.getState();
      expect(account?.balance).toBe(1500);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await websocketService.connect();

      // Simulate connection error
      const connectErrorCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      );

      if (connectErrorCall) {
        const errorHandler = connectErrorCall[1];
        errorHandler(new Error('Connection failed'));
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket connection error:',
        'Connection failed'
      );

      consoleSpy.mockRestore();
    });

    it('should handle disconnect events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await websocketService.connect();

      // Simulate disconnect
      const disconnectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      );

      if (disconnectCall) {
        const disconnectHandler = disconnectCall[1];
        disconnectHandler('io server disconnect');
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket disconnected:',
        'io server disconnect'
      );

      consoleSpy.mockRestore();
    });
  });
});
