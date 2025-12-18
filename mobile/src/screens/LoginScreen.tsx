import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer, Text, Input, Button, ErrorMessage } from '../components';
import { colors, spacing } from '../theme';
import { AuthStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { loginSchema, parseError } from '../utils';
import { useToast } from '../context';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { setTokens, setUser, biometricEnabled } = useAuthStore();
  const { showError, showSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as 'email' | 'password';
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setApiError(null);
    try {
      const response = await authService.login({ email, password });
      await setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      showSuccess('Welcome back!');
    } catch (error: unknown) {
      const parsed = parseError(error);
      setApiError(parsed.message);
      if (parsed.isNetworkError) {
        showError('Please check your internet connection');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    // Biometric authentication would be implemented here
    // For now, show a placeholder message
    Alert.alert('Biometric Login', 'Biometric authentication is not yet configured on this device.');
  };

  const navigateToSignup = () => {
    navigation.navigate('Signup');
  };

  const navigateToForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <ScreenContainer scrollable keyboardAvoiding>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="h1" align="center">Welcome Back</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={styles.subtitle}>
            Sign in to your account
          </Text>
        </View>

        <View style={styles.form}>
          {apiError && (
            <ErrorMessage
              message={apiError}
              variant="card"
              onDismiss={() => setApiError(null)}
              onRetry={handleLogin}
              style={styles.errorMessage}
              testID="login-error"
            />
          )}

          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            testID="login-email-input"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text: string) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            error={errors.password}
            testID="login-password-input"
            rightIcon={
              <Text variant="caption" color={colors.primary}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <TouchableOpacity onPress={navigateToForgotPassword} style={styles.forgotPassword}>
            <Text variant="bodySmall" color={colors.primary}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            testID="login-submit-button"
            style={styles.loginButton}
          />

          {biometricEnabled && (
            <Button
              title="Use Biometric"
              onPress={handleBiometricLogin}
              variant="outline"
              testID="login-biometric-button"
              style={styles.biometricButton}
            />
          )}
        </View>

        <View style={styles.footer}>
          <Text variant="body" color={colors.textSecondary}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={navigateToSignup}>
            <Text variant="body" color={colors.primary}>
              Sign Up
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
  errorMessage: {
    marginBottom: spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
  biometricButton: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
