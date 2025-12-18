import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer, Text, Input, Button } from '../components';
import { colors, spacing } from '../theme';
import { AuthStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { signupSchema } from '../utils/validation';

type SignupScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { setPendingVerification } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const result = signupSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string; confirmPassword?: string } = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as 'email' | 'password' | 'confirmPassword';
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await authService.signup({ email, password });
      setPendingVerification(response.userId, email);
      navigation.navigate('OTPVerification', { email, userId: response.userId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <ScreenContainer scrollable keyboardAvoiding>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="h1" align="center">Create Account</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={styles.subtitle}>
            Sign up to get started
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            testID="signup-email-input"
          />

          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            error={errors.password}
            testID="signup-password-input"
            rightIcon={
              <Text variant="caption" color={colors.primary}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            error={errors.confirmPassword}
            testID="signup-confirm-password-input"
            rightIcon={
              <Text variant="caption" color={colors.primary}>
                {showConfirmPassword ? 'Hide' : 'Show'}
              </Text>
            }
            onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
          />

          <View style={styles.passwordHints}>
            <Text variant="caption" color={colors.textSecondary}>
              Password must contain:
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              • At least 8 characters
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              • One uppercase letter
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              • One lowercase letter
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              • One number
            </Text>
          </View>

          <Button
            title="Create Account"
            onPress={handleSignup}
            loading={isLoading}
            disabled={isLoading}
            testID="signup-submit-button"
            style={styles.signupButton}
          />
        </View>

        <View style={styles.footer}>
          <Text variant="body" color={colors.textSecondary}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={navigateToLogin}>
            <Text variant="body" color={colors.primary}>
              Sign In
            </Text>
          </TouchableOpacity>
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
    marginBottom: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  form: {
    marginBottom: spacing.xl,
  },
  passwordHints: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  signupButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
