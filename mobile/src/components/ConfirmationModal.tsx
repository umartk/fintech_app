import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors, spacing, borderRadius, shadows } from '../theme';

export type ConfirmationType = 'success' | 'warning' | 'error' | 'info';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: ConfirmationType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDismiss: () => void;
  showCancel?: boolean;
  testID?: string;
}

const typeConfig: Record<ConfirmationType, { icon: string; iconBg: string }> = {
  success: { icon: '✓', iconBg: colors.successLight },
  warning: { icon: '⚠', iconBg: colors.warningLight },
  error: { icon: '✕', iconBg: colors.errorLight },
  info: { icon: 'ℹ', iconBg: colors.infoLight },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  type = 'info',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  onDismiss,
  showCancel = false,
  testID,
}) => {
  const config = typeConfig[type];

  const handleConfirm = () => {
    onConfirm?.();
    onDismiss();
  };

  const handleCancel = () => {
    onCancel?.();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      testID={testID}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
                <Text style={styles.icon}>{config.icon}</Text>
              </View>
              <Text variant="h3" align="center" style={styles.title}>
                {title}
              </Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={styles.message}>
                {message}
              </Text>
              <View style={styles.buttonContainer}>
                {showCancel && (
                  <Button
                    title={cancelLabel}
                    onPress={handleCancel}
                    variant="outline"
                    style={styles.button}
                    testID={`${testID}-cancel`}
                  />
                )}
                <Button
                  title={confirmLabel}
                  onPress={handleConfirm}
                  style={showCancel ? styles.button : styles.fullWidthButton}
                  testID={`${testID}-confirm`}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
  },
  fullWidthButton: {
    flex: 1,
  },
});
