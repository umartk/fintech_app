/**
 * Payment method service for API calls
 */

import api from './api';

export interface PaymentMethod {
  id: string;
  type: 'BANK_ACCOUNT' | 'DEBIT_CARD' | 'CREDIT_CARD';
  provider: string;
  maskedAccountNumber: string;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface AddPaymentMethodRequest {
  type: 'BANK_ACCOUNT' | 'DEBIT_CARD' | 'CREDIT_CARD';
  provider: string;
  accountNumber: string;
  routingNumber?: string;
  expiryDate?: string;
}

class PaymentMethodService {
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await api.get<PaymentMethod[]>('/api/payment-methods');
    return response.data;
  }

  async addPaymentMethod(data: AddPaymentMethodRequest): Promise<PaymentMethod> {
    const response = await api.post<PaymentMethod>('/api/payment-methods', data);
    return response.data;
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await api.delete(`/api/payment-methods/${paymentMethodId}`);
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    const response = await api.put<PaymentMethod>(`/api/payment-methods/${paymentMethodId}/default`);
    return response.data;
  }
}

export const paymentMethodService = new PaymentMethodService();