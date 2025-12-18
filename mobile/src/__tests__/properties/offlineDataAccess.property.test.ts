/**
 * Property-Based Tests for Offline Data Access
 * 
 * **Feature: fintech-mobile-app, Property 19: Offline data access**
 * **Validates: Requirements 12.1**
 * 
 * Property: For any user session that loses internet connectivity, 
 * the mobile app should display cached account balance and recent transaction history.
 */

import * as fc from 'fast-check';
import { useAppStore } from '../../store/appStore';
import { useAccountStore } from '../../store/accountStore';
import { useTransactionStore } from '../../store/transactionStore';
import { positiveAmountArbitrary, transactionArbitrary, propertyConfig } from './helpers';

// Mock AsyncStorage for testing
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorage[key] || null);
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach(key => delete mockStorage[key]);
    return Promise.resolve();
  }),
}));

// Reset stores and mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Clear mock storage
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  
  useAppStore.setState({
    isOnline: true,
    isAppReady: false,
    lastSyncTime: null,
  });
  
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
});

describe('Property 19: Offline Data Access', () => {
  /**
   * **Feature: fintech-mobile-app, Property 19: Offline data access**
   * **Validates: Requirements 12.1**
   * 
   * Test that when the app goes offline, the offline state is properly tracked.
   * This validates that the app can detect offline status.
   */
  it('should properly track offline state', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (startOnline, endOnline) => {
          // Set initial online state
          useAppStore.getState().setOnline(startOnline);
          expect(useAppStore.getState().isOnline).toBe(startOnline);
          
          // Change to end state
          useAppStore.getState().setOnline(endOnline);
          expect(useAppStore.getState().isOnline).toBe(endOnline);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 19: Offline data access**
   * **Validates: Requirements 12.1**
   * 
   * Test that account data can be cached and retrieved.
   * This validates the caching mechanism for account balance.
   */
  it('should cache and retrieve account balance data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        positiveAmountArbitrary,
        fc.constantFrom('USD', 'EUR', 'GBP'),
        async (accountId, balance, currency) => {
          // Set up account data
          const accountData = {
            id: accountId,
            balance,
            currency,
            status: 'active' as const,
          };
          
          useAccountStore.getState().setAccount(accountData);
          
          // Cache the account data
          await useAccountStore.getState().cacheAccountData();
          
          // Clear the store to simulate fresh load
          useAccountStore.getState().clearAccount();
          expect(useAccountStore.getState().account).toBeNull();
          
          // Load from cache
          await useAccountStore.getState().loadCachedData();
          
          // Verify cached data is loaded
          const loadedAccount = useAccountStore.getState().account;
          expect(loadedAccount).not.toBeNull();
          expect(loadedAccount?.balance).toBe(balance);
          expect(loadedAccount?.currency).toBe(currency);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 19: Offline data access**
   * **Validates: Requirements 12.1**
   * 
   * Test that transaction data can be cached and retrieved.
   * This validates the caching mechanism for transaction history.
   */
  it('should cache and retrieve transaction history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }),
        async (transactions) => {
          // Set up transaction data
          useTransactionStore.getState().setTransactions(transactions);
          
          // Cache the transactions
          await useTransactionStore.getState().cacheTransactions();
          
          // Clear the store to simulate fresh load
          useTransactionStore.getState().clearTransactions();
          expect(useTransactionStore.getState().transactions.length).toBe(0);
          
          // Load from cache
          await useTransactionStore.getState().loadCachedTransactions();
          
          // Verify cached data is loaded (up to 20 most recent)
          const loadedTransactions = useTransactionStore.getState().transactions;
          const expectedCount = Math.min(transactions.length, 20);
          expect(loadedTransactions.length).toBe(expectedCount);
          
          // Verify transaction data integrity
          loadedTransactions.forEach((tx, index) => {
            expect(tx.id).toBe(transactions[index].id);
            expect(tx.amount).toBe(transactions[index].amount);
            expect(tx.type).toBe(transactions[index].type);
            expect(tx.status).toBe(transactions[index].status);
          });
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 19: Offline data access**
   * **Validates: Requirements 12.1**
   * 
   * Test that offline state combined with cached data works correctly.
   * This validates the complete offline data access flow.
   */
  it('should allow data access when offline with cached data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        positiveAmountArbitrary,
        fc.constantFrom('USD', 'EUR', 'GBP'),
        fc.array(transactionArbitrary, { minLength: 0, maxLength: 10 }),
        async (accountId, balance, currency, transactions) => {
          // Start online and set up data
          useAppStore.getState().setOnline(true);
          
          useAccountStore.getState().setAccount({
            id: accountId,
            balance,
            currency,
            status: 'active',
          });
          
          useTransactionStore.getState().setTransactions(transactions);
          
          // Cache the data
          await useAccountStore.getState().cacheAccountData();
          await useTransactionStore.getState().cacheTransactions();
          
          // Go offline
          useAppStore.getState().setOnline(false);
          expect(useAppStore.getState().isOnline).toBe(false);
          
          // Clear stores to simulate app restart
          useAccountStore.getState().clearAccount();
          useTransactionStore.getState().clearTransactions();
          
          // Load cached data while offline
          await useAccountStore.getState().loadCachedData();
          await useTransactionStore.getState().loadCachedTransactions();
          
          // Verify data is accessible offline
          const account = useAccountStore.getState().account;
          const loadedTransactions = useTransactionStore.getState().transactions;
          
          expect(account).not.toBeNull();
          expect(account?.balance).toBe(balance);
          expect(account?.currency).toBe(currency);
          
          const expectedTxCount = Math.min(transactions.length, 20);
          expect(loadedTransactions.length).toBe(expectedTxCount);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 19: Offline data access**
   * **Validates: Requirements 12.1**
   * 
   * Test that empty cache is handled gracefully when offline.
   * This validates that the app doesn't crash when no cached data is available.
   */
  it('should handle empty cache gracefully when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (goOffline) => {
          // Reset state at the start of each property run
          useAppStore.setState({ isOnline: true });
          useAccountStore.setState({ account: null, paymentMethods: [], isLoading: false, error: null, lastUpdated: null });
          useTransactionStore.setState({ transactions: [], isLoading: false, error: null, hasMore: true, currentPage: 1 });
          
          // Set online/offline state
          useAppStore.getState().setOnline(!goOffline);
          
          // Try to load cached data when none exists
          await useAccountStore.getState().loadCachedData();
          await useTransactionStore.getState().loadCachedTransactions();
          
          // Verify app handles empty cache gracefully (no crashes)
          const account = useAccountStore.getState().account;
          const transactions = useTransactionStore.getState().transactions;
          
          // With no cache, account should be null and transactions empty
          expect(account).toBeNull();
          expect(transactions.length).toBe(0);
          
          // Verify offline state is correct
          expect(useAppStore.getState().isOnline).toBe(!goOffline);
          
          // Test passes if we reach here without throwing
          expect(true).toBe(true);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });
});
