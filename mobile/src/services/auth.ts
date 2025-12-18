/**
 * Authentication service for API calls
 */

import api from './api';

export interface SignupRequest {
  email: string;
  password: string;
}

export interface SignupResponse {
  userId: string;
  requiresOTP: boolean;
  message: string;
}

export interface VerifyOTPRequest {
  userId: string;
  otp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
}

export interface LoginResponse extends AuthTokens {
  user: UserProfile;
}

class AuthService {
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const response = await api.post<SignupResponse>('/api/auth/signup', data);
    return response.data;
  }

  async verifyOTP(data: VerifyOTPRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/verify-otp', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/login', data);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await api.post<{ accessToken: string }>('/api/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  }

  async logoutAllDevices(): Promise<void> {
    await api.post('/api/auth/logout-all');
  }

  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/api/users/profile');
    return response.data;
  }
}

export const authService = new AuthService();
