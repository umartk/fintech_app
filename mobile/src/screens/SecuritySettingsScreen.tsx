import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import {
  ScreenContainer,
  Text,
  Input,
  Button,
  Card,
} from '../components';
import { colors, spacing, typography } from '../theme';
import { useAuthStore } from '../store/authStore';
import { userService, authService } from '../services';

type Props = NativeStackScreenProps<MainStackParamList, 'SecuritySettings'>;

export const SecuritySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { biometricEnabled, setBiometricEnabled, clearAuth } = useAuthStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    try {
      setIsLoading(true);
      await userService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      Alert.alert(
        'Success',
        'Password changed successfully. You will be logged out from all devices.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form and exit editing mode
              setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
              });
              setPasswordErrors({});
              setIsChangingPassword(false);
              
              // Log out user since all sessions are invalidated
              handleLogout();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.message || 'Failed to change password';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      await setBiometricEnabled(enabled);
      Alert.alert(
        'Success',
        `Biometric authentication ${enabled ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      await clearAuth();
      // Navigation will be handled by auth state change
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear local auth even if API call fails
      await clearAuth();
    }
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      'Logout All Devices',
      'This will log you out from all devices. You will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logoutAllDevices();
              await clearAuth();
            } catch (error) {
              console.error('Error during logout all:', error);
              await clearAuth();
            }
          },
        },
      ]
    );
  };

  const cancelPasswordChange = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordErrors({});
    setIsChangingPassword(false);
  };

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.title}>Authentication</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                Use fingerprint or face recognition to log in
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>Password</Text>
            {!isChangingPassword && (
              <TouchableOpacity
                onPress={() => setIsChangingPassword(true)}
                style={styles.changeButton}
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>

          {isChangingPassword ? (
            <View style={styles.passwordForm}>
              <Input
                label="Current Password"
                value={passwordForm.currentPassword}
                onChangeText={(text) =>
                  setPasswordForm({ ...passwordForm, currentPassword: text })
                }
                error={passwordErrors.currentPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Input
                label="New Password"
                value={passwordForm.newPassword}
                onChangeText={(text) =>
                  setPasswordForm({ ...passwordForm, newPassword: text })
                }
                error={passwordErrors.newPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Input
                label="Confirm New Password"
                value={passwordForm.confirmPassword}
                onChangeText={(text) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: text })
                }
                error={passwordErrors.confirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.passwordRequirements}>
                <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                <Text style={styles.requirement}>• At least 8 characters</Text>
                <Text style={styles.requirement}>• One uppercase letter</Text>
                <Text style={styles.requirement}>• One lowercase letter</Text>
                <Text style={styles.requirement}>• One number</Text>
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title="Cancel"
                  onPress={cancelPasswordChange}
                  variant="outline"
                  style={styles.button}
                />
                <Button
                  title="Change Password"
                  onPress={handleChangePassword}
                  loading={isLoading}
                  style={styles.button}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.passwordInfo}>
              Last changed: Not available
            </Text>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Session Management</Text>

          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <Text style={styles.actionText}>Logout</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.actionItem} onPress={handleLogoutAllDevices}>
            <Text style={[styles.actionText, styles.dangerText]}>
              Logout All Devices
            </Text>
          </TouchableOpacity>
          <Text style={styles.actionDescription}>
            This will log you out from all devices and invalidate all active sessions
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  changeButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  passwordForm: {
    marginTop: spacing.md,
  },
  passwordInfo: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  passwordRequirements: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: 8,
    marginVertical: spacing.md,
  },
  requirementsTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  requirement: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  actionItem: {
    paddingVertical: spacing.md,
  },
  actionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  dangerText: {
    color: colors.error,
  },
  actionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});