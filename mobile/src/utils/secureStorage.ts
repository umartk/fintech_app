/**
 * Secure Storage utility for sensitive data
 * Uses AsyncStorage with encryption-ready structure
 * In production, this should be replaced with react-native-keychain or similar
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@fintech/accessToken',
  REFRESH_TOKEN: '@fintech/refreshToken',
  USER_DATA: '@fintech/userData',
  BIOMETRIC_ENABLED: '@fintech/biometricEnabled',
  CACHED_BALANCE: '@fintech/cachedBalance',
  CACHED_TRANSACTIONS: '@fintech/cachedTransactions',
  LAST_SYNC_TIME: '@fintech/lastSyncTime',
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

class SecureStorage {
  /**
   * Store a value securely
   */
  async setItem(key: StorageKey, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS[key], value);
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      throw new Error(`Failed to store ${key}`);
    }
  }

  /**
   * Retrieve a stored value
   */
  async getItem(key: StorageKey): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS[key]);
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a stored value
   */
  async removeItem(key: StorageKey): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS[key]);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
    }
  }


  /**
   * Store JSON data
   */
  async setJSON<T>(key: StorageKey, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error storing JSON for ${key}:`, error);
      throw new Error(`Failed to store JSON for ${key}`);
    }
  }

  /**
   * Retrieve JSON data
   */
  async getJSON<T>(key: StorageKey): Promise<T | null> {
    try {
      const jsonValue = await this.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error retrieving JSON for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all stored data (for logout)
   */
  async clearAll(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Clear authentication data only
   */
  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }
}

export const secureStorage = new SecureStorage();
export { STORAGE_KEYS };
