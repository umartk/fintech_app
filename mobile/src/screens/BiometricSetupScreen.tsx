import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import { ScreenContainer, Text, Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useAuthStore } from '../store/authStore';
import { biometricService, BiometricType } from '../services';

interface BiometricSetupScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const BiometricSetupScreen: React.FC<BiometricSetupScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const { biometricEnabled, setBiometricEnabled, accessToken, refreshToken, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(biometricEnabled);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('None');

  useEffect(() => {
    const checkBiometric = async () => {
      const status = await biometricService.checkAvailability();
      setBiometricAvailable(status.available);
      setBiometricType(status.biometryType);
    };
    checkBiometric();
  }, []);

  const getBiometricTypeName = (): string => {
    return biometricService.getBiometricTypeName(biometricType);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    setLocalEnabled(value);
    
    if (value) {
      // Enable biometric with current credentials
      if (!accessToken || !refreshToken || !user?.email) {
        Alert.alert('Error', 'Please log in first to enable biometric authentication.');
        setLocalEnabled(false);
        return;
      }

      Alert.alert(
        `Enable ${getBiometricTypeName()}`,
        `Would you like to enable ${getBiometricTypeName()} for faster login?`,
        [
          {
            text: 'Cancel',
            onPress: () => setLocalEnabled(false),
            style: 'cancel',
          },
          {
            text: 'Enable',
            onPress: async () => {
              setIsLoading(true);
              try {
                const result = await biometricService.enableBiometric({
                  email: user.email,
                  accessToken,
                  refreshToken,
                });

                if (result.success) {
                  await setBiometricEnabled(true);
                  Alert.alert('Success', `${getBiometricTypeName()} has been enabled.`);
                } else {
                  setLocalEnabled(false);
                  Alert.alert('Error', result.error || 'Failed to enable biometric authentication.');
                }
              } catch (error) {
                setLocalEnabled(false);
                Alert.alert('Error', 'Failed to enable biometric authentication.');
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } else {
      // Disable biometric
      setIsLoading(true);
      try {
        await biometricService.disableBiometric();
        await setBiometricEnabled(false);
      } catch (error) {
        setLocalEnabled(true);
        Alert.alert('Error', 'Failed to disable biometric authentication.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleComplete = () => {
    onComplete?.();
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text variant="h1" align="center">🔐</Text>
          </View>
          <Text variant="h2" align="center" style={styles.title}>
            Biometric Authentication
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={styles.subtitle}>
            Enable fingerprint or face recognition for faster and more secure login
          </Text>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="body">Enable {getBiometricTypeName()}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {biometricAvailable 
                  ? `Use ${getBiometricTypeName()} to sign in`
                  : 'Biometric authentication is not available on this device'}
              </Text>
            </View>
            <Switch
              value={localEnabled}
              onValueChange={handleToggleBiometric}
              disabled={isLoading || !biometricAvailable}
              trackColor={{ false: colors.gray300, true: colors.primaryLight }}
              thumbColor={localEnabled ? colors.primary : colors.gray100}
              testID="biometric-toggle"
            />
          </View>
        </View>

        <View style={styles.benefits}>
          <Text variant="bodySmall" color={colors.textSecondary} style={styles.benefitTitle}>
            Benefits of biometric authentication:
          </Text>
          <View style={styles.benefitItem}>
            <Text variant="body">✓ Faster login experience</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text variant="body">✓ Enhanced security</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text variant="body">✓ No need to remember passwords</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleComplete}
            testID="biometric-continue-button"
            style={styles.continueButton}
          />
          <Button
            title="Skip for now"
            onPress={handleSkip}
            variant="ghost"
            testID="biometric-skip-button"
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    paddingHorizontal: spacing.lg,
  },
  settingCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  benefits: {
    marginBottom: spacing.xl,
  },
  benefitTitle: {
    marginBottom: spacing.sm,
  },
  benefitItem: {
    paddingVertical: spacing.xs,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
  continueButton: {
    marginBottom: spacing.sm,
  },
});
