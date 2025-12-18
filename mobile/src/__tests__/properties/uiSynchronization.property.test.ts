/**
 * Property-Based Tests for UI Synchronization
 * 
 * **Feature: fintech-mobile-app, Property 16: UI synchronization**
 * **Validates: Requirements 8.2**
 * 
 * Property: For any real-time update received by the mobile app, 
 * the user interface should reflect the changes immediately without requiring manual refresh.
 */

import * as fc from 'fast-check';
import { useAccountStore } from '../../store/accountStore';
import { useTransactionStore, Transaction } from '../../store/transactionStore';
import { positiveAmountArbitrary, propertyConfig } from './helpers';

// Reset stores before each test
beforeEach(() => {
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

describe('Property 16: UI Synchronization', () => {
  /**
   * **Feature: fintech-mobile-app, Property 16: UI synchronization**
   * **Validates: Requirements 8.2**
   * 
   * Test that balance updates via WebSocket are immediately reflected in the store state.
   * This simulates the real-time update flow where the WebSocket service calls updateBalance.
   */
  it('should immediately reflect balance updates in store state', () => {
    fc.assert(
      fc.property(
        // Generate initial balance and new balance from WebSocket update
        positiveAmountArbitrary,
        positiveAmountArbitrary,
        fc.constantFrom('USD', 'EUR', 'GBP'),
        (initialBalance, newBalance, currency) => {
          // Set up initial account state
          useAccountStore.getState().setAccount({
            id: 'test-account-id',
            balance: initialBalance,
            currency,
            status: 'active',
          });

          // Verify initial state
          const stateBefore = useAccountStore.getState();
          expect(stateBefore.account?.balance).toBe(initialBalance);

          // Simulate WebSocket balance update (this is what websocketService.onBalanceUpdate triggers)
          useAccountStore.getState().updateBalance(newBalance);

          // Verify state is immediately updated without manual refresh
          const stateAfter = useAccountStore.getState();
          expect(stateAfter.account?.balance).toBe(newBalance);
          expect(stateAfter.lastUpdated).not.toBeNull();
          
          // The update should be synchronous - no pending state
          expect(stateAfter.isLoading).toBe(false);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 16: UI synchronization**
   * **Validates: Requirements 8.2**
   * 
   * Test that transaction status updates via WebSocket are immediately reflected in the store.
   * This validates that when a transaction:update event is received, the UI state updates.
   */
  it('should immediately reflect transaction status updates in store state', () => {
    fc.assert(
      fc.property(
        // Generate transaction ID and status transitions
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        positiveAmountArbitrary,
        fc.constantFrom('USD', 'EUR', 'GBP'),
        fc.constantFrom('pending', 'completed', 'failed', 'cancelled') as fc.Arbitrary<Transaction['status']>,
        fc.constantFrom('pending', 'completed', 'failed', 'cancelled') as fc.Arbitrary<Transaction['status']>,
        (transactionId, fromAccountId, toAccountId, amount, currency, initialStatus, newStatus) => {
          // Set up initial transaction in store
          const initialTransaction: Transaction = {
            id: transactionId,
            fromAccountId,
            toAccountId,
            amount,
            currency,
            type: 'transfer',
            status: initialStatus,
            createdAt: new Date().toISOString(),
          };

          useTransactionStore.getState().setTransactions([initialTransaction]);

          // Verify initial state
          const stateBefore = useTransactionStore.getState();
          const txBefore = stateBefore.transactions.find(t => t.id === transactionId);
          expect(txBefore?.status).toBe(initialStatus);

          // Simulate WebSocket transaction update
          const processedAt = new Date().toISOString();
          useTransactionStore.getState().updateTransaction(transactionId, {
            status: newStatus,
            processedAt,
          });

          // Verify state is immediately updated
          const stateAfter = useTransactionStore.getState();
          const txAfter = stateAfter.transactions.find(t => t.id === transactionId);
          
          expect(txAfter?.status).toBe(newStatus);
          expect(txAfter?.processedAt).toBe(processedAt);
          
          // The update should be synchronous
          expect(stateAfter.isLoading).toBe(false);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 16: UI synchronization**
   * **Validates: Requirements 8.2**
   * 
   * Test that new transactions added via real-time updates appear at the top of the list.
   * This validates the addTransaction behavior used when receiving new transaction notifications.
   */
  it('should add new transactions at the top of the list immediately', () => {
    fc.assert(
      fc.property(
        // Generate existing transactions and a new incoming transaction
        fc.array(
          fc.record({
            id: fc.uuid(),
            fromAccountId: fc.uuid(),
            toAccountId: fc.uuid(),
            amount: positiveAmountArbitrary,
            currency: fc.constantFrom('USD', 'EUR', 'GBP'),
            type: fc.constantFrom('transfer', 'deposit', 'withdrawal') as fc.Arbitrary<Transaction['type']>,
            status: fc.constantFrom('pending', 'completed', 'failed', 'cancelled') as fc.Arbitrary<Transaction['status']>,
            createdAt: fc.date().map(d => d.toISOString()),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.record({
          id: fc.uuid(),
          fromAccountId: fc.uuid(),
          toAccountId: fc.uuid(),
          amount: positiveAmountArbitrary,
          currency: fc.constantFrom('USD', 'EUR', 'GBP'),
          type: fc.constantFrom('transfer', 'deposit', 'withdrawal') as fc.Arbitrary<Transaction['type']>,
          status: fc.constantFrom('pending', 'completed') as fc.Arbitrary<Transaction['status']>,
          createdAt: fc.date().map(d => d.toISOString()),
        }),
        (existingTransactions, newTransaction) => {
          // Set up initial transactions
          useTransactionStore.getState().setTransactions(existingTransactions);

          const countBefore = useTransactionStore.getState().transactions.length;

          // Simulate receiving a new transaction via real-time update
          useTransactionStore.getState().addTransaction(newTransaction);

          const stateAfter = useTransactionStore.getState();
          
          // New transaction should be at the top
          expect(stateAfter.transactions[0].id).toBe(newTransaction.id);
          
          // Total count should increase by 1
          expect(stateAfter.transactions.length).toBe(countBefore + 1);
          
          // Update should be synchronous
          expect(stateAfter.isLoading).toBe(false);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });

  /**
   * **Feature: fintech-mobile-app, Property 16: UI synchronization**
   * **Validates: Requirements 8.2**
   * 
   * Test that multiple rapid updates are all reflected correctly.
   * This validates that the UI can handle burst updates from WebSocket.
   */
  it('should handle multiple rapid balance updates correctly', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of balance updates
        fc.array(positiveAmountArbitrary, { minLength: 2, maxLength: 20 }),
        fc.constantFrom('USD', 'EUR', 'GBP'),
        (balanceUpdates, currency) => {
          // Set up initial account
          useAccountStore.getState().setAccount({
            id: 'test-account-id',
            balance: 0,
            currency,
            status: 'active',
          });

          // Apply all balance updates rapidly (simulating burst WebSocket messages)
          balanceUpdates.forEach(balance => {
            useAccountStore.getState().updateBalance(balance);
          });

          // Final state should reflect the last update
          const finalState = useAccountStore.getState();
          const lastBalance = balanceUpdates[balanceUpdates.length - 1];
          
          expect(finalState.account?.balance).toBe(lastBalance);
          expect(finalState.isLoading).toBe(false);
        }
      ),
      { numRuns: propertyConfig.numRuns }
    );
  });
});
