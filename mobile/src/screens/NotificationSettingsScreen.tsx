/**
 * Notification Settings Screen
 * Allows users to manage notification preferences
 * Requirements: 4.4, 5.2, 8.2
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Alert } from 'react-native';
import { ScreenContainer, Text, Card } from '../components';
import { colors, spacing } from '../theme';
import { useNotificationStore, NotificationSettings } from '../store/notificationStore';
import { notificationService } from '../services/notifications';

interface SettingRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}) => (
  <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
    <View style={styles.settingInfo}>
      <Text variant="body" color={disabled ? colors.textSecondary : colors.text}>
        {label}
      </Text>
      {description && (
        <Text variant="caption" color={colors.textSecondary}>
          {description}
        </Text>
      )}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primaryLight }}
      thumbColor={value ? colors.primary : colors.textSecondary}
      testID={testID}
    />
  </View>
);

export const NotificationSettingsScreen: React.FC = () => {
  const { settings, updateSettings, loadSettings } = useNotificationStore();
  const [permissionGranted, setPermissionGranted] = useState(true);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, [loadSettings]);

  const checkPermissions = async () => {
    const enabled = await notificationService.areNotificationsEnabled();
    setPermissionGranted(enabled);
  };

  const handleEnableNotifications = async (enabled: boolean) => {
    if (enabled && !permissionGranted) {
      // Request permissions if not granted
      const granted = await notificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive transaction alerts.',
          [{ text: 'OK' }]
        );
        return;
      }
      setPermissionGranted(true);
    }
    updateSettings({ enabled });
  };

  const handleSettingChange = (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    updateSettings({ [key]: value });
  };

  const notificationsDisabled = !settings.enabled || !permissionGranted;

  return (
    <ScreenContainer safeArea>
      <View style={styles.container}>
        {!permissionGranted && (
          <Card variant="outlined" style={styles.warningCard}>
            <Text variant="body" color={colors.warning}>
              Notifications are disabled in your device settings. Enable them to
              receive transaction alerts.
            </Text>
          </Card>
        )}

        <Card variant="outlined" style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            General
          </Text>

          <SettingRow
            label="Enable Notifications"
            description="Receive push notifications for account activity"
            value={settings.enabled && permissionGranted}
            onValueChange={handleEnableNotifications}
            testID="enable-notifications-switch"
          />
        </Card>

        <Card variant="outlined" style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Notification Types
          </Text>

          <SettingRow
            label="Transaction Alerts"
            description="Get notified when you send or receive money"
            value={settings.transactionAlerts}
            onValueChange={(value) =>
              handleSettingChange('transactionAlerts', value)
            }
            disabled={notificationsDisabled}
            testID="transaction-alerts-switch"
          />

          <View style={styles.divider} />

          <SettingRow
            label="Balance Updates"
            description="Get notified when your balance changes"
            value={settings.balanceUpdates}
            onValueChange={(value) =>
              handleSettingChange('balanceUpdates', value)
            }
            disabled={notificationsDisabled}
            testID="balance-updates-switch"
          />

          <View style={styles.divider} />

          <SettingRow
            label="Security Alerts"
            description="Get notified about security-related events"
            value={settings.securityAlerts}
            onValueChange={(value) =>
              handleSettingChange('securityAlerts', value)
            }
            disabled={notificationsDisabled}
            testID="security-alerts-switch"
          />
        </Card>

        <Card variant="outlined" style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Sound & Vibration
          </Text>

          <SettingRow
            label="Sound"
            description="Play a sound for notifications"
            value={settings.soundEnabled}
            onValueChange={(value) => handleSettingChange('soundEnabled', value)}
            disabled={notificationsDisabled}
            testID="sound-enabled-switch"
          />

          <View style={styles.divider} />

          <SettingRow
            label="Vibration"
            description="Vibrate for notifications"
            value={settings.vibrationEnabled}
            onValueChange={(value) =>
              handleSettingChange('vibrationEnabled', value)
            }
            disabled={notificationsDisabled}
            testID="vibration-enabled-switch"
          />
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  warningCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  section: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
