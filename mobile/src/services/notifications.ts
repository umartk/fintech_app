/**
 * Push Notification Service for Fintech Mobile App
 * Handles Firebase Cloud Messaging setup and notification handling
 * Requirements: 4.4, 5.2, 8.2
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { secureStorage } from '../utils/secureStorage';
import api from './api';

// Notification types for transaction updates
export type NotificationType =
  | 'transaction_sent'
  | 'transaction_received'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'balance_update'
  | 'security_alert';

export interface PushNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  timestamp: Date;
  read: boolean;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  senderName?: string;
  recipientName?: string;
}

type NotificationHandler = (notification: PushNotification) => void;

/**
 * Push Notification Service
 * Manages FCM token registration, permission handling, and notification processing
 */
class NotificationService {
  private fcmToken: string | null = null;
  private notificationHandlers: NotificationHandler[] = [];
  private isInitialized = false;
  private permissionGranted = false;

  /**
   * Initialize the notification service
   * Sets up FCM and requests permissions
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.permissionGranted;
    }

    try {
      // Request notification permissions
      this.permissionGranted = await this.requestPermissions();

      if (this.permissionGranted) {
        // Get FCM token (mock implementation for development)
        await this.getFCMToken();

        // Register token with backend
        if (this.fcmToken) {
          await this.registerTokenWithBackend();
        }
      }

      this.isInitialized = true;
      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Android 13+ requires explicit notification permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message:
                'This app needs notification permissions to alert you about transactions and account activity.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        // Android < 13 doesn't require explicit permission
        return true;
      }

      // iOS permission handling would go here
      // For now, return true as a mock
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return result;
    }
    return this.permissionGranted;
  }

  /**
   * Get FCM token for push notifications
   * In production, this would use @react-native-firebase/messaging
   */
  private async getFCMToken(): Promise<string | null> {
    try {
      // Check for cached token first
      const cachedToken = await secureStorage.getItem('FCM_TOKEN');
      if (cachedToken) {
        this.fcmToken = cachedToken;
        return cachedToken;
      }

      // In production, this would be:
      // const token = await messaging().getToken();
      // For development, generate a mock token
      const mockToken = `fcm_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.fcmToken = mockToken;

      // Cache the token
      await secureStorage.setItem('FCM_TOKEN', mockToken);

      return mockToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register FCM token with the backend server
   */
  private async registerTokenWithBackend(): Promise<void> {
    if (!this.fcmToken) return;

    try {
      await api.post('/api/users/device-token', {
        token: this.fcmToken,
        platform: Platform.OS,
        deviceId: await this.getDeviceId(),
      });
      console.log('FCM token registered with backend');
    } catch (error) {
      // Don't throw - token registration failure shouldn't block app usage
      console.warn('Failed to register FCM token with backend:', error);
    }
  }

  /**
   * Get or generate a unique device identifier
   */
  private async getDeviceId(): Promise<string> {
    let deviceId = await secureStorage.getItem('DEVICE_ID');
    if (!deviceId) {
      deviceId = `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await secureStorage.setItem('DEVICE_ID', deviceId);
    }
    return deviceId;
  }

  /**
   * Handle incoming notification payload
   * Converts raw payload to PushNotification and notifies handlers
   */
  handleNotification(payload: NotificationPayload): PushNotification {
    const notification: PushNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: {
        transactionId: payload.transactionId,
        amount: payload.amount,
        currency: payload.currency,
        senderName: payload.senderName,
        recipientName: payload.recipientName,
      },
      timestamp: new Date(),
      read: false,
    };

    // Notify all registered handlers
    this.notificationHandlers.forEach((handler) => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    });

    return notification;
  }

  /**
   * Create a transaction notification
   * Requirements: 4.4, 5.2
   */
  createTransactionNotification(
    type: 'sent' | 'received' | 'completed' | 'failed',
    transactionId: string,
    amount: number,
    currency: string,
    counterpartyName?: string
  ): PushNotification {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);

    let notificationType: NotificationType;
    let title: string;
    let body: string;

    switch (type) {
      case 'sent':
        notificationType = 'transaction_sent';
        title = 'Money Sent';
        body = `You sent ${formattedAmount} to ${counterpartyName || 'recipient'}`;
        break;
      case 'received':
        notificationType = 'transaction_received';
        title = 'Money Received';
        body = `You received ${formattedAmount} from ${counterpartyName || 'sender'}`;
        break;
      case 'completed':
        notificationType = 'transaction_completed';
        title = 'Transaction Completed';
        body = `Your transaction of ${formattedAmount} has been completed`;
        break;
      case 'failed':
        notificationType = 'transaction_failed';
        title = 'Transaction Failed';
        body = `Your transaction of ${formattedAmount} could not be processed`;
        break;
    }

    return this.handleNotification({
      type: notificationType,
      title,
      body,
      transactionId,
      amount,
      currency,
      senderName: type === 'received' ? counterpartyName : undefined,
      recipientName: type === 'sent' ? counterpartyName : undefined,
    });
  }

  /**
   * Register a notification handler
   * Returns unsubscribe function
   */
  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      this.notificationHandlers = this.notificationHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Show a local notification alert
   * Used for foreground notifications
   */
  showLocalAlert(notification: PushNotification): void {
    Alert.alert(notification.title, notification.body, [
      { text: 'Dismiss', style: 'cancel' },
      {
        text: 'View',
        onPress: () => {
          // Navigation would be handled by the notification handler
          this.notificationHandlers.forEach((handler) => handler(notification));
        },
      },
    ]);
  }

  /**
   * Get the current FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Clear FCM token on logout
   */
  async clearToken(): Promise<void> {
    if (this.fcmToken) {
      try {
        // Unregister token from backend
        await api.delete('/api/users/device-token', {
          data: { token: this.fcmToken },
        });
      } catch (error) {
        console.warn('Failed to unregister FCM token:', error);
      }
    }

    await secureStorage.removeItem('FCM_TOKEN');
    this.fcmToken = null;
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this.fcmToken = null;
    this.notificationHandlers = [];
    this.isInitialized = false;
    this.permissionGranted = false;
  }
}

export const notificationService = new NotificationService();
