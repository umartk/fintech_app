/**
 * Notification Store for Fintech Mobile App
 * Manages notification state, settings, and history
 * Requirements: 4.4, 5.2, 8.2
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushNotification, NotificationType } from '../services/notifications';

const NOTIFICATIONS_STORAGE_KEY = '@fintech_notifications';
const NOTIFICATION_SETTINGS_KEY = '@fintech_notification_settings';
const MAX_STORED_NOTIFICATIONS = 50;

export interface NotificationSettings {
  enabled: boolean;
  transactionAlerts: boolean;
  balanceUpdates: boolean;
  securityAlerts: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface NotificationState {
  notifications: PushNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  isLoading: boolean;
  error: string | null;

  // Actions
  addNotification: (notification: PushNotification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  loadNotifications: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  transactionAlerts: true,
  balanceUpdates: true,
  securityAlerts: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  settings: defaultSettings,
  isLoading: false,
  error: null,

  addNotification: (notification) => {
    const { settings, notifications } = get();

    // Check if notifications are enabled for this type
    if (!settings.enabled) return;

    const shouldNotify = shouldShowNotification(notification.type, settings);
    if (!shouldNotify) return;

    // Add notification to the beginning of the list
    const updatedNotifications = [notification, ...notifications].slice(
      0,
      MAX_STORED_NOTIFICATIONS
    );

    const unreadCount = updatedNotifications.filter((n) => !n.read).length;

    set({
      notifications: updatedNotifications,
      unreadCount,
    });

    // Persist notifications
    persistNotifications(updatedNotifications);
  },

  markAsRead: (notificationId) => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );

    const unreadCount = updatedNotifications.filter((n) => !n.read).length;

    set({
      notifications: updatedNotifications,
      unreadCount,
    });

    persistNotifications(updatedNotifications);
  },

  markAllAsRead: () => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));

    set({
      notifications: updatedNotifications,
      unreadCount: 0,
    });

    persistNotifications(updatedNotifications);
  },

  removeNotification: (notificationId) => {
    const { notifications } = get();
    const updatedNotifications = notifications.filter((n) => n.id !== notificationId);
    const unreadCount = updatedNotifications.filter((n) => !n.read).length;

    set({
      notifications: updatedNotifications,
      unreadCount,
    });

    persistNotifications(updatedNotifications);
  },

  clearAllNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });

    AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  },

  updateSettings: (newSettings) => {
    const { settings } = get();
    const updatedSettings = { ...settings, ...newSettings };

    set({ settings: updatedSettings });

    persistSettings(updatedSettings);
  },

  loadNotifications: async () => {
    try {
      set({ isLoading: true, error: null });

      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const notifications: PushNotification[] = JSON.parse(stored).map(
          (n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          })
        );

        const unreadCount = notifications.filter((n) => !n.read).length;

        set({
          notifications,
          unreadCount,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({
        error: 'Failed to load notifications',
        isLoading: false,
      });
    }
  },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const settings: NotificationSettings = JSON.parse(stored);
        set({ settings });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));

/**
 * Check if a notification type should be shown based on settings
 */
function shouldShowNotification(
  type: NotificationType,
  settings: NotificationSettings
): boolean {
  switch (type) {
    case 'transaction_sent':
    case 'transaction_received':
    case 'transaction_completed':
    case 'transaction_failed':
      return settings.transactionAlerts;
    case 'balance_update':
      return settings.balanceUpdates;
    case 'security_alert':
      return settings.securityAlerts;
    default:
      return true;
  }
}

/**
 * Persist notifications to AsyncStorage
 */
async function persistNotifications(notifications: PushNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications)
    );
  } catch (error) {
    console.error('Failed to persist notifications:', error);
  }
}

/**
 * Persist settings to AsyncStorage
 */
async function persistSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(settings)
    );
  } catch (error) {
    console.error('Failed to persist notification settings:', error);
  }
}
