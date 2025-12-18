/**
 * Integration tests for Offline Functionality
 * Tests offline data access and synchronization
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { useAccountStore } from '../../store/accountStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useAppStore } from '../../store/appStore';
import { secureStorage } from '../../utils/secureStorage';

// Mock secure storage
jest.mock('../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    setJSON: jest.fn().mockResolvedValue(undefined),
    getJSON: jest.fn(),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;

describe('Offline Functionality Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset stores to initial state
    useAccountStore.setState({
      account: null,
      paymentMethods: [],
      isLoading: false,
      error: null,
      lastUpdated: null,
    });

    useTransactionStore.setState({
      transactions: [],
      isLoading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
    });

    useAppStore.setState({
      isOnline: true,
      isAppReady: false,
      lastSyncTime: null,
    });
  });

  describe('Account Data Caching', () => {
    it('should cache account balance when online', async () => {
      const { setAccount, cacheAccountData } = useAccountStore.getState();

      // Set account data
      setAccount({
        id: 'acc-123',
        balance: 1500,
        currency: 'USD',
        status: 'active',
      });

      // Cache the data
      await cacheAccountData();

      expect(mockSecureStorage.setJSON).toHaveBeenCalledWith(
        'CACHED_BALANCE',
        expect.objectContaining({
          balance: 1500,
          currency: 'USD',
          cachedAt: expect.any(String),
        })
      );
    });

    it('should load cached account data when offline', async () => {
      const cachedData = {
        balance: 1500,
        currency: 'USD',
        cachedAt: '2025-12-18T10:00:00Z',
      };
      mockSecureStorage.getJSON.mockResolvedValue(cachedData);

      const { loadCachedData } = useAccountStore.getState();
      await loadCachedData();

      const { account, lastUpdated } = useAccountStore.getState();
      
      expect(account?.balance).toBe(1500);
      expect(account?.currency).toBe('USD');
      expect(lastUpdated).toEqual(new Date(cachedData.cachedAt));
    });

    it('should handle missing cached data gracefully', async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);

      const { loadCachedData } = useAccountStore.getState();
      await loadCachedData();

      const { account } = useAccountStore.getState();
      expect(account).toBeNull();
    });

    it('should handle cache loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSecureStorage.getJSON.mockRejectedValue(new Error('Storage error'));

      const { loadCachedData } = useAccountStore.getState();
      await loadCachedData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading cached account data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Transaction Data Caching', () => {
    const mockTransactions = [
      {
        id: 'tx-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: 100,
        currency: 'USD',
        type: 'transfer' as const,
        status: 'completed' as const,
        createdAt: '2025-12-18T09:00:00Z',
      },
      {
        id: 'tx-2',
        fromAccountId: 'acc-2',
        toAccountId: 'acc-1',
        amount: 50,
        currency: 'USD',
        type: 'transfer' as const,
        status: 'completed' as const,
        createdAt: '2025-12-18T08:00:00Z',
      },
    ];

    it('should cache recent transactions', async () => {
      const { setTransactions, cacheTransactions } = useTransactionStore.getState();

      setTransactions(mockTransactions);
      await cacheTransactions();

      expect(mockSecureStorage.setJSON).toHaveBeenCalledWith(
        'CACHED_TRANSACTIONS',
        expect.objectContaining({
          transactions: mockTransactions,
          cachedAt: expect.any(String),
        })
      );
    });

    it('should limit cached transactions to 20', async () => {
      const manyTransactions = Array.from({ length: 30 }, (_, i) => ({
        id: `tx-${i}`,
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: 10,
        currency: 'USD',
        type: 'transfer' as const,
        status: 'completed' as const,
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      }));

      const { setTransactions, cacheTransactions } = useTransactionStore.getState();

      setTransactions(manyTransactions);
      await cacheTransactions();

      expect(mockSecureStorage.setJSON).toHaveBeenCalledWith(
        'CACHED_TRANSACTIONS',
        expect.objectContaining({
          transactions: expect.arrayContaining([]),
        })
      );

      // Verify only 20 transactions are cached
      const cachedCall = mockSecureStorage.setJSON.mock.calls[0];
      const cachedData = cachedCall[1] as { transactions: unknown[] };
      expect(cachedData.transactions.length).toBe(20);
    });

    it('should load cached transactions when offline', async () => {
      const cachedData = {
        transactions: mockTransactions,
        cachedAt: '2025-12-18T10:00:00Z',
      };
      mockSecureStorage.getJSON.mockResolvedValue(cachedData);

      const { loadCachedTransactions } = useTransactionStore.getState();
      await loadCachedTransactions();

      const { transactions } = useTransactionStore.getState();
      expect(transactions).toEqual(mockTransactions);
    });

    it('should handle missing cached transactions gracefully', async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);

      const { loadCachedTransactions } = useTransactionStore.getState();
      await loadCachedTransactions();

      const { transactions } = useTransactionStore.getState();
      expect(transactions).toEqual([]);
    });
  });

  describe('Online/Offline State Management', () => {
    it('should track online status', () => {
      const { setOnline } = useAppStore.getState();

      setOnline(false);
      expect(useAppStore.getState().isOnline).toBe(false);

      setOnline(true);
      expect(useAppStore.getState().isOnline).toBe(true);
    });

    it('should track last sync time', () => {
      const { setLastSyncTime } = useAppStore.getState();
      const syncTime = new Date();

      setLastSyncTime(syncTime);
      expect(useAppStore.getState().lastSyncTime).toEqual(syncTime);
    });
  });

  describe('Data Synchronization', () => {
    it('should update balance and cache when receiving new data', async () => {
      const { setAccount, updateBalance, cacheAccountData } = useAccountStore.getState();

      // Initial account
      setAccount({
        id: 'acc-123',
        balance: 1000,
        currency: 'USD',
        status: 'active',
      });

      // Update balance (simulating real-time update)
      updateBalance(1500);

      // Cache updated data
      await cacheAccountData();

      const { account } = useAccountStore.getState();
      expect(account?.balance).toBe(1500);

      expect(mockSecureStorage.setJSON).toHaveBeenCalledWith(
        'CACHED_BALANCE',
        expect.objectContaining({
          balance: 1500,
        })
      );
    });

    it('should update transaction and cache when receiving new data', async () => {
      const { setTransactions, updateTransaction, cacheTransactions } = useTransactionStore.getState();

      // Initial transactions
      setTransactions([
        {
          id: 'tx-1',
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: 100,
          currency: 'USD',
          type: 'transfer',
          status: 'pending',
          createdAt: '2025-12-18T09:00:00Z',
        },
      ]);

      // Update transaction status (simulating real-time update)
      updateTransaction('tx-1', {
        status: 'completed',
        processedAt: '2025-12-18T09:01:00Z',
      });

      // Cache updated data
      await cacheTransactions();

      const { transactions } = useTransactionStore.getState();
      expect(transactions[0].status).toBe('completed');
      expect(transactions[0].processedAt).toBe('2025-12-18T09:01:00Z');
    });

    it('should add new transaction to store', () => {
      const { setTransactions, addTransaction } = useTransactionStore.getState();

      setTransactions([]);

      addTransaction({
        id: 'tx-new',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: 200,
        currency: 'USD',
        type: 'transfer',
        status: 'pending',
        createdAt: '2025-12-18T10:00:00Z',
      });

      const { transactions } = useTransactionStore.getState();
      expect(transactions.length).toBe(1);
      expect(transactions[0].id).toBe('tx-new');
    });
  });

  describe('Store Cleanup', () => {
    it('should clear account data on logout', () => {
      const { setAccount, clearAccount } = useAccountStore.getState();

      setAccount({
        id: 'acc-123',
        balance: 1000,
        currency: 'USD',
        status: 'active',
      });

      clearAccount();

      const { account, paymentMethods, isLoading, error, lastUpdated } = useAccountStore.getState();
      expect(account).toBeNull();
      expect(paymentMethods).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(lastUpdated).toBeNull();
    });

    it('should clear transaction data on logout', () => {
      const { setTransactions, clearTransactions } = useTransactionStore.getState();

      setTransactions([
        {
          id: 'tx-1',
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: 100,
          currency: 'USD',
          type: 'transfer',
          status: 'completed',
          createdAt: '2025-12-18T09:00:00Z',
        },
      ]);

      clearTransactions();

      const { transactions, isLoading, error, hasMore, currentPage } = useTransactionStore.getState();
      expect(transactions).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
      expect(hasMore).toBe(true);
      expect(currentPage).toBe(1);
    });
  });

  describe('Pagination State', () => {
    it('should manage pagination state correctly', () => {
      const { incrementPage, resetPagination, setHasMore } = useTransactionStore.getState();

      incrementPage();
      expect(useTransactionStore.getState().currentPage).toBe(2);

      incrementPage();
      expect(useTransactionStore.getState().currentPage).toBe(3);

      setHasMore(false);
      expect(useTransactionStore.getState().hasMore).toBe(false);

      resetPagination();
      expect(useTransactionStore.getState().currentPage).toBe(1);
      expect(useTransactionStore.getState().hasMore).toBe(true);
    });

    it('should append transactions for pagination', () => {
      const { setTransactions, appendTransactions } = useTransactionStore.getState();

      setTransactions([
        {
          id: 'tx-1',
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: 100,
          currency: 'USD',
          type: 'transfer',
          status: 'completed',
          createdAt: '2025-12-18T09:00:00Z',
        },
      ]);

      appendTransactions([
        {
          id: 'tx-2',
          fromAccountId: 'acc-2',
          toAccountId: 'acc-1',
          amount: 50,
          currency: 'USD',
          type: 'transfer',
          status: 'completed',
          createdAt: '2025-12-18T08:00:00Z',
        },
      ]);

      const { transactions } = useTransactionStore.getState();
      expect(transactions.length).toBe(2);
      expect(transactions[0].id).toBe('tx-1');
      expect(transactions[1].id).toBe('tx-2');
    });
  });
});
