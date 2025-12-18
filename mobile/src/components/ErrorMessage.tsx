import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors, spacing, borderRadius } from '../theme';

export interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'card' | 'fullscreen';
  style?: ViewStyle;
  testID?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = 'Error',
  onRetry,
  onDismiss,
  variant = 'inline',
  style,
  testID,
}) => {
  if (variant === 'fullscreen') {
    return (
      <View style={[styles.fullscreenContainer, style]} testID={testID}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>❌</Text>
        </View>
        <Text variant="h3" align="center" style={styles.title}>
          {title}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={styles.message}>
          {message}
        </Text>
        <View style={styles.buttonRow}>
          {onRetry && (
            <Button
              title="Try Again"
              onPress={onRetry}
              style={styles.button}
              testID={`${testID}-retry`}
            />
          )}
          {onDismiss && (
            <Button
              title="Dismiss"
              onPress={onDismiss}
              variant="outline"
              style={styles.button}
              testID={`${testID}-dismiss`}
            />
          )}
        </View>
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View style={[styles.cardContainer, style]} testID={testID}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>⚠️</Text>
          <Text variant="body" style={styles.cardTitle}>
            {title}
          </Text>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text variant="bodySmall" color={colors.textSecondary} style={styles.cardMessage}>
          {message}
        </Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryLink}>
            <Text variant="bodySmall" color={colors.primary}>
              Tap to retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Inline variant (default)
  return (
    <View style={[styles.inlineContainer, style]} testID={testID}>
      <Text style={styles.inlineIcon}>⚠️</Text>
      <View style={styles.inlineContent}>
        <Text variant="bodySmall" color={colors.error}>
          {message}
        </Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry}>
            <Text variant="caption" color={colors.primary} style={styles.inlineRetry}>
              Retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    minWidth: 120,
  },

  // Card styles
  cardContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontWeight: '600',
    color: colors.error,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  dismissIcon: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  cardMessage: {
    marginBottom: spacing.xs,
  },
  retryLink: {
    marginTop: spacing.xs,
  },

  // Inline styles
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  inlineIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  inlineContent: {
    flex: 1,
  },
  inlineRetry: {
    marginTop: spacing.xs,
  },
});
