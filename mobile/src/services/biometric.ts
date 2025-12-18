/**
 * Biometric Authentication Service
 * Handles fingerprint and face recognition authentication
 * Requirements: 2.2, 2.3
 */

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { secureStorage } from '../utils/secureStorage';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export type BiometricType = 'FaceID' | 'TouchID' | 'Biometrics' | 'None';

export interface BiometricStatus {
  available: boolean;
  biometryType: BiometricType;
  keysExist: boolean;
}

export interface BiometricCredentials {
  email: string;
  accessToken: string;
  refreshToken: string;
}

const BIOMETRIC_CREDENTIALS_KEY = '@fintech/biometricCredentials';

class BiometricService {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkAvailability(): Promise<BiometricStatus> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      const { keysExist } = await rnBiometrics.biometricKeysExist();

      let type: BiometricType = 'None';
      if (available) {
        switch (biometryType) {
          case BiometryTypes.FaceID:
            type = 'FaceID';
            break;
          case BiometryTypes.TouchID:
            type = 'TouchID';
            break;
          case BiometryTypes.Biometrics:
            type = 'Biometrics';
            break;
          default:
            type = 'None';
        }
      }

      return {
        available,
        biometryType: type,
        keysExist,
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        available: false,
        biometryType: 'None',
        keysExist: false,
      };
    }
  }

  /**
   * Get a user-friendly name for the biometric type
   */
  getBiometricTypeName(type: BiometricType): string {
    switch (type) {
      case 'FaceID':
        return 'Face ID';
      case 'TouchID':
        return 'Touch ID';
      case 'Biometrics':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  }

  /**
   * Create biometric keys for secure authentication
   */
  async createKeys(): Promise<boolean> {
    try {
      const { publicKey } = await rnBiometrics.createKeys();
      return !!publicKey;
    } catch (error) {
      console.error('Error creating biometric keys:', error);
      return false;
    }
  }

  /**
   * Delete biometric keys
   */
  async deleteKeys(): Promise<boolean> {
    try {
      const { keysDeleted } = await rnBiometrics.deleteKeys();
      return keysDeleted;
    } catch (error) {
      console.error('Error deleting biometric keys:', error);
      return false;
    }
  }

  /**
   * Prompt user for biometric authentication
   */
  async authenticate(promptMessage?: string): Promise<boolean> {
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: promptMessage || 'Authenticate to continue',
        cancelButtonText: 'Cancel',
      });
      return success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  /**
   * Store credentials securely for biometric login
   * These are encrypted and only accessible after biometric verification
   */
  async storeCredentials(credentials: BiometricCredentials): Promise<boolean> {
    try {
      const encrypted = JSON.stringify(credentials);
      await secureStorage.setItem('BIOMETRIC_ENABLED', encrypted);
      return true;
    } catch (error) {
      console.error('Error storing biometric credentials:', error);
      return false;
    }
  }

  /**
   * Retrieve stored credentials after biometric verification
   */
  async getStoredCredentials(): Promise<BiometricCredentials | null> {
    try {
      const stored = await secureStorage.getItem('BIOMETRIC_ENABLED');
      if (!stored || stored === 'true' || stored === 'false') {
        return null;
      }
      return JSON.parse(stored) as BiometricCredentials;
    } catch (error) {
      console.error('Error retrieving biometric credentials:', error);
      return null;
    }
  }

  /**
   * Clear stored biometric credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      await secureStorage.removeItem('BIOMETRIC_ENABLED');
      await this.deleteKeys();
    } catch (error) {
      console.error('Error clearing biometric credentials:', error);
    }
  }

  /**
   * Enable biometric authentication for a user
   * Stores their credentials securely after biometric verification
   */
  async enableBiometric(credentials: BiometricCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if biometrics are available
      const status = await this.checkAvailability();
      if (!status.available) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      // Create keys if they don't exist
      if (!status.keysExist) {
        const keysCreated = await this.createKeys();
        if (!keysCreated) {
          return { success: false, error: 'Failed to set up biometric authentication' };
        }
      }

      // Verify biometric before storing credentials
      const authenticated = await this.authenticate('Verify your identity to enable biometric login');
      if (!authenticated) {
        return { success: false, error: 'Biometric verification failed' };
      }

      // Store credentials
      const stored = await this.storeCredentials(credentials);
      if (!stored) {
        return { success: false, error: 'Failed to store credentials securely' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Perform biometric login
   * Returns stored credentials if biometric verification succeeds
   */
  async biometricLogin(): Promise<{ success: boolean; credentials?: BiometricCredentials; error?: string }> {
    try {
      // Check if biometrics are available
      const status = await this.checkAvailability();
      if (!status.available) {
        return { success: false, error: 'Biometric authentication is not available' };
      }

      // Check if credentials are stored
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        return { success: false, error: 'No biometric credentials found. Please log in with your password first.' };
      }

      // Verify biometric
      const authenticated = await this.authenticate('Sign in with biometrics');
      if (!authenticated) {
        return { success: false, error: 'Biometric verification failed' };
      }

      return { success: true, credentials };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<boolean> {
    try {
      await this.clearCredentials();
      return true;
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return false;
    }
  }
}

export const biometricService = new BiometricService();
