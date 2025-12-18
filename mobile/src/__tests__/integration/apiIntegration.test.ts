/**
 * Integration tests for Mobile App API Services
 * Tests service layer integration with backend API
 * Validates: All requirements integration
 */

import { authService } from '../../services/auth';
import { userService } from '../../services/user';
import { paymentMethodService } from '../../services/paymentMethod';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the API module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockApi = api as jest.Mocked<typeof api>;

describe('API Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('AuthService', () => {
    describe('signup', () => {
      it('should call signup endpoint with correct data', async () => {
        const mockResponse = {
          data: { userId: 'user-123', requiresOTP: true, message: 'OTP sent' },
        };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await authService.signup({
          email: 'test@example.com',
          password: 'Password123!',
        });

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/signup', {
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('should propagate signup errors', async () => {
        const error = new Error('Email already exists');
        mockApi.post.mockRejectedValue(error);

        await expect(
          authService.signup({ email: 'test@example.com', password: 'Password123!' })
        ).rejects.toThrow('Email already exists');
      });
    });

    describe('verifyOTP', () => {
      it('should call verify-otp endpoint with correct data', async () => {
        const mockResponse = {
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: { id: 'user-123', email: 'test@example.com' },
          },
        };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await authService.verifyOTP({
          userId: 'user-123',
          otp: '123456',
        });

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/verify-otp', {
          userId: 'user-123',
          otp: '123456',
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('should propagate OTP verification errors', async () => {
        const error = new Error('Invalid OTP');
        mockApi.post.mockRejectedValue(error);

        await expect(
          authService.verifyOTP({ userId: 'user-123', otp: '000000' })
        ).rejects.toThrow('Invalid OTP');
      });
    });

    describe('login', () => {
      it('should call login endpoint with correct credentials', async () => {
        const mockResponse = {
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: { id: 'user-123', email: 'test@example.com' },
          },
        };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        });

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('should propagate login errors', async () => {
        const error = new Error('Invalid credentials');
        mockApi.post.mockRejectedValue(error);

        await expect(
          authService.login({ email: 'test@example.com', password: 'wrong' })
        ).rejects.toThrow('Invalid credentials');
      });
    });

    describe('refreshToken', () => {
      it('should call refresh endpoint with token', async () => {
        const mockResponse = { data: { accessToken: 'new-access-token' } };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await authService.refreshToken('refresh-token');

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/refresh', {
          refreshToken: 'refresh-token',
        });
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('logout', () => {
      it('should call logout endpoint', async () => {
        mockApi.post.mockResolvedValue({ data: {} });

        await authService.logout();

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout');
      });
    });

    describe('logoutAllDevices', () => {
      it('should call logout-all endpoint', async () => {
        mockApi.post.mockResolvedValue({ data: {} });

        await authService.logoutAllDevices();

        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout-all');
      });
    });

    describe('getProfile', () => {
      it('should call profile endpoint', async () => {
        const mockProfile = {
          id: 'user-123',
          email: 'test@example.com',
          kycStatus: 'verified',
        };
        mockApi.get.mockResolvedValue({ data: mockProfile });

        const result = await authService.getProfile();

        expect(mockApi.get).toHaveBeenCalledWith('/api/users/profile');
        expect(result).toEqual(mockProfile);
      });
    });
  });

  describe('UserService', () => {
    describe('getProfile', () => {
      it('should fetch user profile', async () => {
        const mockProfile = {
          id: 'user-123',
          email: 'test@example.com',
          kycStatus: 'verified' as const,
          role: 'user',
          createdAt: '2025-01-01T00:00:00Z',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            phoneNumber: null,
            dateOfBirth: null,
            address: null,
          },
        };
        mockApi.get.mockResolvedValue({ data: mockProfile });

        const result = await userService.getProfile();

        expect(mockApi.get).toHaveBeenCalledWith('/api/users/profile');
        expect(result).toEqual(mockProfile);
      });
    });

    describe('updateProfile', () => {
      it('should update user profile', async () => {
        const mockUpdatedProfile = {
          id: 'user-123',
          email: 'test@example.com',
          kycStatus: 'verified' as const,
          role: 'user',
          createdAt: '2025-01-01T00:00:00Z',
          profile: {
            firstName: 'Updated',
            lastName: 'Name',
            phoneNumber: null,
            dateOfBirth: null,
            address: null,
          },
        };
        mockApi.put.mockResolvedValue({ data: mockUpdatedProfile });

        const result = await userService.updateProfile({
          firstName: 'Updated',
          lastName: 'Name',
        });

        expect(mockApi.put).toHaveBeenCalledWith('/api/users/profile', {
          firstName: 'Updated',
          lastName: 'Name',
        });
        expect(result).toEqual(mockUpdatedProfile);
      });
    });

    describe('changePassword', () => {
      it('should call change password endpoint', async () => {
        mockApi.post.mockResolvedValue({ data: {} });

        await userService.changePassword({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

        expect(mockApi.post).toHaveBeenCalledWith('/api/users/change-password', {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });
      });
    });

    describe('getAccountBalance', () => {
      it('should fetch account balance', async () => {
        const mockBalance = {
          balance: 1000,
          currency: 'USD',
          status: 'active',
        };
        mockApi.get.mockResolvedValue({ data: mockBalance });

        const result = await userService.getAccountBalance();

        expect(mockApi.get).toHaveBeenCalledWith('/api/users/balance');
        expect(result).toEqual(mockBalance);
      });
    });
  });

  describe('PaymentMethodService', () => {
    describe('getPaymentMethods', () => {
      it('should fetch payment methods', async () => {
        const mockMethods = [
          {
            id: 'pm-1',
            type: 'BANK_ACCOUNT' as const,
            provider: 'Chase',
            maskedAccountNumber: '****1234',
            isVerified: true,
            isDefault: true,
            createdAt: '2025-01-01T00:00:00Z',
          },
        ];
        mockApi.get.mockResolvedValue({ data: mockMethods });

        const result = await paymentMethodService.getPaymentMethods();

        expect(mockApi.get).toHaveBeenCalledWith('/api/payment-methods');
        expect(result).toEqual(mockMethods);
      });
    });

    describe('addPaymentMethod', () => {
      it('should add a new payment method', async () => {
        const mockMethod = {
          id: 'pm-2',
          type: 'DEBIT_CARD' as const,
          provider: 'Visa',
          maskedAccountNumber: '****5678',
          isVerified: false,
          isDefault: false,
          createdAt: '2025-01-01T00:00:00Z',
        };
        mockApi.post.mockResolvedValue({ data: mockMethod });

        const result = await paymentMethodService.addPaymentMethod({
          type: 'DEBIT_CARD',
          provider: 'Visa',
          accountNumber: '4111111111115678',
          expiryDate: '12/25',
        });

        expect(mockApi.post).toHaveBeenCalledWith('/api/payment-methods', {
          type: 'DEBIT_CARD',
          provider: 'Visa',
          accountNumber: '4111111111115678',
          expiryDate: '12/25',
        });
        expect(result).toEqual(mockMethod);
      });
    });

    describe('removePaymentMethod', () => {
      it('should remove a payment method', async () => {
        mockApi.delete.mockResolvedValue({ data: {} });

        await paymentMethodService.removePaymentMethod('pm-1');

        expect(mockApi.delete).toHaveBeenCalledWith('/api/payment-methods/pm-1');
      });
    });

    describe('setDefaultPaymentMethod', () => {
      it('should set default payment method', async () => {
        const mockMethod = {
          id: 'pm-1',
          type: 'BANK_ACCOUNT' as const,
          provider: 'Chase',
          maskedAccountNumber: '****1234',
          isVerified: true,
          isDefault: true,
          createdAt: '2025-01-01T00:00:00Z',
        };
        mockApi.put.mockResolvedValue({ data: mockMethod });

        const result = await paymentMethodService.setDefaultPaymentMethod('pm-1');

        expect(mockApi.put).toHaveBeenCalledWith('/api/payment-methods/pm-1/default');
        expect(result).toEqual(mockMethod);
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      (networkError as any).isAxiosError = true;
      (networkError as any).code = 'ERR_NETWORK';
      mockApi.get.mockRejectedValue(networkError);

      await expect(userService.getProfile()).rejects.toThrow('Network Error');
    });

    it('should handle 401 unauthorized errors', async () => {
      const unauthorizedError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
      mockApi.get.mockRejectedValue(unauthorizedError);

      await expect(userService.getProfile()).rejects.toEqual(unauthorizedError);
    });

    it('should handle 400 validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { message: 'Validation failed', errors: [{ field: 'email', message: 'Invalid email' }] },
        },
      };
      mockApi.post.mockRejectedValue(validationError);

      await expect(
        authService.signup({ email: 'invalid', password: 'Password123!' })
      ).rejects.toEqual(validationError);
    });

    it('should handle 500 server errors', async () => {
      const serverError = {
        response: { status: 500, data: { message: 'Internal server error' } },
      };
      mockApi.get.mockRejectedValue(serverError);

      await expect(userService.getAccountBalance()).rejects.toEqual(serverError);
    });
  });
});
