/**
 * User service for profile and account management API calls
 */

import api from './api';

export interface UserProfile {
  id: string;
  email: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  role: string;
  createdAt: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    dateOfBirth: string | null;
    address: unknown;
  } | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AccountBalance {
  balance: number;
  currency: string;
  status: string;
}

class UserService {
  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/api/users/profile');
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/api/users/profile', data);
    return response.data;
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/api/users/change-password', data);
  }

  async getAccountBalance(): Promise<AccountBalance> {
    const response = await api.get<AccountBalance>('/api/users/balance');
    return response.data;
  }
}

export const userService = new UserService();