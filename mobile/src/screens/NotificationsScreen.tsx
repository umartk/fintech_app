/**
 * Notifications Screen
 * Displays notification history and allows interaction
 * Requirements: 4.4, 5.2, 8.2
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer, Text, Card, Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useNotificationStore } from '../store/notificationStore';
import { PushNotification, NotificationType } from '../services/notifications';
import { MainStackParamList } from '../navigation/types';

type NotificationsNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'Notifications'
>;

/**
 * Get icon and color for notification type
 */
const getNotificationStyle = (type: NotificationType) => {
  switch (type) {
    case 'transaction_sent':
      return { icon: '↑', color: colors.primary, bgColor: colors.primaryLight };
    case 'transaction_received':
      return { icon: '↓', color: colors.success, bgColor: colors.successLight };
    case 'transaction_completed':
      return { icon: '✓', color: colors.success, bgColor: colors.successLight };
    case 'transaction_failed':
      return { icon: '✕', color: colors.error, bgColor: colors.errorLight };
    case 'balance_update':
      return { icon: '$', color: colors.secondary, bgColor: colors.secondaryLight };
    case 'security_alert':
      return { icon: '!', color: colors.warning, bgColor: colors.warningLight };
    default:
      return { icon: '•', color: colors.textSecondary, bgColor: colors.border };
  }
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

interface NotificationItemProps {
  notification: PushNotification;
  onPress: () => void;
  onDismiss: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
}) => {
  const style = getNotificationStyle(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.unreadNotification,
      ]}
      onPress={onPress}
      testID={`notification-item-${notification.id}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: style.bgColor }]}>
        <Text variant="body" color={style.color}>
          {style.icon}
        </Text>
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            variant="body"
            style={!notification.read && styles.unreadText}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {!notification.read && <View style={styles.unreadDot} />}
        </View>
        <Text
          variant="caption"
          color={colors.textSecondary}
          numberOfLines={2}
        >
          {notification.body}
        </Text>
        <Text variant="caption" color={colors.textSecondary} style={styles.timestamp}>
          {formatTimestamp(notification.timestamp)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID={`dismiss-notification-${notification.id}`}
      >
        <Text variant="caption" color={colors.textSecondary}>
          ✕
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotificationStore();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    (notification: PushNotification) => {
      // Mark as read
      markAsRead(notification.id);

      // Navigate based on notification type
      if (notification.data?.transactionId) {
        navigation.navigate('TransactionDetail', {
          transactionId: notification.data.transactionId,
        });
      }
    },
    [markAsRead, navigation]
  );

  const handleDismiss = useCallback(
    (notificationId: string) => {
      removeNotification(notificationId);
    },
    [removeNotification]
  );

  const renderNotification = ({ item }: { item: PushNotification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onDismiss={() => handleDismiss(item.id)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text variant="h3" align="center" style={styles.emptyTitle}>
        No notifications
      </Text>
      <Text
        variant="body"
        color={colors.textSecondary}
        align="center"
        style={styles.emptyText}
      >
        You'll see transaction updates and alerts here
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (notifications.length === 0) return null;

    return (
      <View style={styles.header}>
        <Text variant="caption" color={colors.textSecondary}>
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
            : 'All caught up!'}
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.headerButton}
              testID="mark-all-read-button"
            >
              <Text variant="caption" color={colors.primary}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={clearAllNotifications}
            style={styles.headerButton}
            testID="clear-all-button"
          >
            <Text variant="caption" color={colors.error}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer safeArea padding={false}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadNotifications}
            colors={[colors.primary]}
            tintColor={colors.primary}
            testID="notifications-refresh"
          />
        }
        showsVerticalScrollIndicator={false}
        testID="notifications-list"
      />

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('NotificationSettings')}
        testID="notification-settings-button"
      >
        <Text variant="body" color={colors.primary}>
          Notification Settings
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerButton: {
    paddingVertical: spacing.xs,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  unreadNotification: {
    backgroundColor: colors.primaryLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  unreadText: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  timestamp: {
    marginTop: spacing.xs,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    marginTop: spacing.sm,
  },
  settingsButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
