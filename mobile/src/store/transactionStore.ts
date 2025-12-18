import { create } from 'zustand';
import { secureStorage } from '../utils/secureStorage';

export interface Transaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  type: 'transfer' | 'deposit' | 'withdrawal';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  createdAt: string;
  processedAt?: string;
  counterpartyName?: string;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  appendTransactions: (transactions: Transaction[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  incrementPage: () => void;
  resetPagination: () => void;
  cacheTransactions: () => Promise<void>;
  loadCachedTransactions: () => Promise<void>;
  clearTransactions: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  hasMore: true,
  currentPage: 1,

  setTransactions: (transactions) => set({ transactions, error: null }),

  addTransaction: (transaction) => {
    const { transactions } = get();
    set({ transactions: [transaction, ...transactions] });
  },


  updateTransaction: (id, updates) => {
    const { transactions } = get();
    set({
      transactions: transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    });
  },

  appendTransactions: (newTransactions) => {
    const { transactions } = get();
    set({ transactions: [...transactions, ...newTransactions] });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setHasMore: (hasMore) => set({ hasMore }),

  incrementPage: () => {
    const { currentPage } = get();
    set({ currentPage: currentPage + 1 });
  },

  resetPagination: () => set({ currentPage: 1, hasMore: true }),

  cacheTransactions: async () => {
    const { transactions } = get();
    const recentTransactions = transactions.slice(0, 20);
    await secureStorage.setJSON('CACHED_TRANSACTIONS', {
      transactions: recentTransactions,
      cachedAt: new Date().toISOString(),
    });
  },

  loadCachedTransactions: async () => {
    try {
      const cached = await secureStorage.getJSON<{
        transactions: Transaction[];
        cachedAt: string;
      }>('CACHED_TRANSACTIONS');

      if (cached) {
        set({ transactions: cached.transactions });
      }
    } catch (error) {
      console.error('Error loading cached transactions:', error);
    }
  },

  clearTransactions: () => set({
    transactions: [],
    isLoading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
  }),
}));
