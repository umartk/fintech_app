import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../utils/secureStorage';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  kycStatus?: 'pending' | 'verified' | 'rejected';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  pendingUserId: string | null;
  pendingEmail: string | null;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  loadBiometricSetting: () => Promise<void>;
  setPendingVerification: (userId: string, email: string) => void;
  clearPendingVerification: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,
  pendingUserId: null,
  pendingEmail: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setTokens: async (accessToken, refreshToken) => {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');

      if (accessToken && refreshToken) {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      set({ isLoading: false });
    }
  },

  setBiometricEnabled: async (enabled) => {
    await secureStorage.setItem('BIOMETRIC_ENABLED', enabled ? 'true' : 'false');
    set({ biometricEnabled: enabled });
  },

  loadBiometricSetting: async () => {
    try {
      const enabled = await secureStorage.getItem('BIOMETRIC_ENABLED');
      set({ biometricEnabled: enabled === 'true' });
    } catch (error) {
      console.error('Error loading biometric setting:', error);
    }
  },

  setPendingVerification: (userId, email) => {
    set({ pendingUserId: userId, pendingEmail: email });
  },

  clearPendingVerification: () => {
    set({ pendingUserId: null, pendingEmail: null });
  },
}));
