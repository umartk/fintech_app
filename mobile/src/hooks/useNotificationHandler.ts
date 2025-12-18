/**
 * Hook for handling push notification interactions
 * Requirements: 4.4, 5.2, 8.2
 */

import { useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { notificationService, PushNotification } from '../services/notifications';
import { useNotificationStore } from '../store/notificationStore';
import { MainStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

/**
 * Hook to handle notification interactions and navigation
 */
export const useNotificationHandler = () => {
  const navigation = useNavigation<NavigationProp>();
  const { addNotification, markAsRead } = useNotificationStore();

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  const handleNotificationTap = useCallback(
    (notification: PushNotification) => {
      // Mark notification as read
      markAsRead(notification.id);

      // Navigate based on notification type
      switch (notification.type) {
        case 'transaction_sent':
        case 'transaction_received':
        case 'transaction_completed':
        case 'transaction_failed':
          if (notification.data?.transactionId) {
            navigation.navigate('TransactionDetail', {
              transactionId: notification.data.transactionId,
            });
          } else {
            navigation.navigate('TransactionHistory');
          }
          break;

        case 'balance_update':
          navigation.navigate('Dashboard');
          break;

        case 'security_alert':
          navigation.navigate('SecuritySettings');
          break;

        default:
          navigation.navigate('Notifications');
      }
    },
    [navigation, markAsRead]
  );

  /**
   * Set up notification listener
   */
  useEffect(() => {
    const unsubscribe = notificationService.onNotification((notification) => {
      // Add to store
      addNotification(notification);

      // Show local alert for foreground notifications
      notificationService.showLocalAlert(notification);
    });

    return () => {
      unsubscribe();
    };
  }, [addNotification]);

  return {
    handleNotificationTap,
  };
};

/**
 * Create a transaction notification helper
 */
export const createTransactionNotification = (
  type: 'sent' | 'received' | 'completed' | 'failed',
  transactionId: string,
  amount: number,
  currency: string,
  counterpartyName?: string
): PushNotification => {
  return notificationService.createTransactionNotification(
    type,
    transactionId,
    amount,
    currency,
    counterpartyName
  );
};
