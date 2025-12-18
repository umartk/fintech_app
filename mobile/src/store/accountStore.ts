import { create } from 'zustand';
import { secureStorage } from '../utils/secureStorage';

interface Account {
  id: string;
  balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
}

interface PaymentMethod {
  id: string;
  type: 'bank_account' | 'debit_card' | 'credit_card';
  provider: string;
  maskedAccountNumber: string;
  isVerified: boolean;
  isDefault: boolean;
}

interface AccountState {
  account: Account | null;
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  setAccount: (account: Account | null) => void;
  setPaymentMethods: (methods: PaymentMethod[]) => void;
  updateBalance: (balance: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  cacheAccountData: () => Promise<void>;
  loadCachedData: () => Promise<void>;
  clearAccount: () => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  account: null,
  paymentMethods: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  setAccount: (account) => set({ account, lastUpdated: new Date(), error: null }),

  setPaymentMethods: (paymentMethods) => set({ paymentMethods }),

  updateBalance: (balance) => {
    const { account } = get();
    if (account) {
      set({ account: { ...account, balance }, lastUpdated: new Date() });
    }
  },


  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  cacheAccountData: async () => {
    const { account } = get();
    if (account) {
      await secureStorage.setJSON('CACHED_BALANCE', {
        balance: account.balance,
        currency: account.currency,
        cachedAt: new Date().toISOString(),
      });
    }
  },

  loadCachedData: async () => {
    try {
      const cached = await secureStorage.getJSON<{
        balance: number;
        currency: string;
        cachedAt: string;
      }>('CACHED_BALANCE');

      if (cached) {
        set({
          account: {
            id: '',
            balance: cached.balance,
            currency: cached.currency,
            status: 'active',
          },
          lastUpdated: new Date(cached.cachedAt),
        });
      }
    } catch (error) {
      console.error('Error loading cached account data:', error);
    }
  },

  clearAccount: () => set({
    account: null,
    paymentMethods: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
  }),
}));
