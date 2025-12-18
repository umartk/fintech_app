/**
 * Unit tests for authentication screens
 * Tests login form validation, signup flow, and OTP verification
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */

import React from 'react';
import { render, fireEvent, waitFor, RenderOptions } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { LoginScreen } from '../../screens/LoginScreen';
import { SignupScreen } from '../../screens/SignupScreen';
import { OTPVerificationScreen } from '../../screens/OTPVerificationScreen';
import { BiometricSetupScreen } from '../../screens/BiometricSetupScreen';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth';
import { ToastProvider } from '../../context';

// Wrapper component with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ToastProvider>{children}</ToastProvider>;
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: () => true,
  }),
  useRoute: () => ({
    name: 'OTPVerification',
    params: { email: 'test@example.com', userId: 'user-123' },
  }),
}));

// Mock auth service
jest.mock('../../services/auth', () => ({
  authService: {
    login: jest.fn(),
    signup: jest.fn(),
    verifyOTP: jest.fn(),
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      biometricEnabled: false,
      isAuthenticated: false,
      user: null,
    });
  });

  it('renders login form correctly', () => {
    const { getByTestId, getByText } = customRender(<LoginScreen />);

    expect(getByText('Welcome Back')).toBeTruthy();
    expect(getByTestId('login-email-input')).toBeTruthy();
    expect(getByTestId('login-password-input')).toBeTruthy();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('shows validation errors for empty fields', async () => {
    const { getByTestId, queryByText } = customRender(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(queryByText('Invalid email address')).toBeTruthy();
    });
  });

  it('shows validation error for invalid email', async () => {
    const { getByTestId, queryByText } = customRender(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'invalid-email');
    fireEvent.changeText(getByTestId('login-password-input'), 'password123');
    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(queryByText('Invalid email address')).toBeTruthy();
    });
  });

  it('calls login service with valid credentials', async () => {
    const mockResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'test@example.com' },
    };
    (authService.login as jest.Mock).mockResolvedValue(mockResponse);

    const { getByTestId } = customRender(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'Password123');
    fireEvent.press(getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
      });
    });
  });

  it('shows error message on login failure', async () => {
    (authService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

    const { getByTestId, findByTestId } = customRender(<LoginScreen />);

    fireEvent.changeText(getByTestId('login-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'Password123');
    fireEvent.press(getByTestId('login-submit-button'));

    // Now we show error in ErrorMessage component instead of Alert
    await waitFor(() => {
      expect(getByTestId('login-error')).toBeTruthy();
    });
  });

  it('navigates to signup screen', () => {
    const { getByText } = customRender(<LoginScreen />);

    fireEvent.press(getByText('Sign Up'));

    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('shows biometric button when enabled', () => {
    useAuthStore.setState({ biometricEnabled: true });

    const { getByTestId } = customRender(<LoginScreen />);

    expect(getByTestId('login-biometric-button')).toBeTruthy();
  });

  it('hides biometric button when disabled', () => {
    useAuthStore.setState({ biometricEnabled: false });

    const { queryByTestId } = customRender(<LoginScreen />);

    expect(queryByTestId('login-biometric-button')).toBeNull();
  });
});

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders signup form correctly', () => {
    const { getByTestId, getAllByText } = customRender(<SignupScreen />);

    // "Create Account" appears in both header and button
    expect(getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('signup-email-input')).toBeTruthy();
    expect(getByTestId('signup-password-input')).toBeTruthy();
    expect(getByTestId('signup-confirm-password-input')).toBeTruthy();
    expect(getByTestId('signup-submit-button')).toBeTruthy();
  });

  it('shows validation error for weak password', async () => {
    const { getByTestId, queryByText } = customRender(<SignupScreen />);

    fireEvent.changeText(getByTestId('signup-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('signup-password-input'), 'weak');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'weak');
    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      // Password "weak" fails validation - check for error message containing "number"
      expect(queryByText(/contain at least one number/i)).toBeTruthy();
    });
  });

  it('shows validation error for password mismatch', async () => {
    const { getByTestId, queryByText } = customRender(<SignupScreen />);

    fireEvent.changeText(getByTestId('signup-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('signup-password-input'), 'Password123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'Different123');
    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      expect(queryByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('calls signup service and navigates to OTP on success', async () => {
    const mockResponse = { userId: 'user-123', requiresOTP: true, message: 'OTP sent' };
    (authService.signup as jest.Mock).mockResolvedValue(mockResponse);

    const { getByTestId } = customRender(<SignupScreen />);

    fireEvent.changeText(getByTestId('signup-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('signup-password-input'), 'Password123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'Password123');
    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      expect(authService.signup).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('OTPVerification', {
        email: 'test@example.com',
        userId: 'user-123',
      });
    });
  });

  it('shows error message on signup failure', async () => {
    (authService.signup as jest.Mock).mockRejectedValue(new Error('Email already exists'));

    const { getByTestId } = customRender(<SignupScreen />);

    fireEvent.changeText(getByTestId('signup-email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('signup-password-input'), 'Password123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'Password123');
    fireEvent.press(getByTestId('signup-submit-button'));

    // Now we show error in ErrorMessage component instead of Alert
    await waitFor(() => {
      expect(getByTestId('signup-error')).toBeTruthy();
    });
  });

  it('navigates to login screen', () => {
    const { getByText } = customRender(<SignupScreen />);

    fireEvent.press(getByText('Sign In'));

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});

describe('OTPVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders OTP verification form correctly', () => {
    const { getByTestId, getByText } = render(<OTPVerificationScreen />);

    expect(getByText('Verify Email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
    expect(getByTestId('otp-input-0')).toBeTruthy();
    expect(getByTestId('otp-verify-button')).toBeTruthy();
  });

  it('allows entering OTP digits', () => {
    const { getByTestId } = render(<OTPVerificationScreen />);

    fireEvent.changeText(getByTestId('otp-input-0'), '1');
    fireEvent.changeText(getByTestId('otp-input-1'), '2');
    fireEvent.changeText(getByTestId('otp-input-2'), '3');
    fireEvent.changeText(getByTestId('otp-input-3'), '4');
    fireEvent.changeText(getByTestId('otp-input-4'), '5');
    fireEvent.changeText(getByTestId('otp-input-5'), '6');

    expect(getByTestId('otp-input-0').props.value).toBe('1');
    expect(getByTestId('otp-input-5').props.value).toBe('6');
  });

  it('calls verifyOTP service with complete OTP', async () => {
    const mockResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    };
    (authService.verifyOTP as jest.Mock).mockResolvedValue(mockResponse);

    const { getByTestId } = render(<OTPVerificationScreen />);

    // Enter OTP
    fireEvent.changeText(getByTestId('otp-input-0'), '123456');
    fireEvent.press(getByTestId('otp-verify-button'));

    await waitFor(() => {
      expect(authService.verifyOTP).toHaveBeenCalledWith({
        userId: 'user-123',
        otp: '123456',
      });
    });
  });

  it('disables verify button for incomplete OTP', () => {
    const { getByTestId } = render(<OTPVerificationScreen />);

    // Enter only 3 digits
    fireEvent.changeText(getByTestId('otp-input-0'), '1');
    fireEvent.changeText(getByTestId('otp-input-1'), '2');
    fireEvent.changeText(getByTestId('otp-input-2'), '3');

    // Verify button should be disabled when OTP is incomplete
    const verifyButton = getByTestId('otp-verify-button');
    expect(verifyButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows error alert on verification failure', async () => {
    (authService.verifyOTP as jest.Mock).mockRejectedValue(new Error('Invalid OTP'));

    const { getByTestId } = render(<OTPVerificationScreen />);

    fireEvent.changeText(getByTestId('otp-input-0'), '123456');
    fireEvent.press(getByTestId('otp-verify-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Verification Failed', 'Invalid OTP');
    });
  });
});

describe('BiometricSetupScreen', () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ biometricEnabled: false });
  });

  it('renders biometric setup screen correctly', () => {
    const { getByText, getByTestId } = render(
      <BiometricSetupScreen onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    expect(getByText('Biometric Authentication')).toBeTruthy();
    expect(getByTestId('biometric-toggle')).toBeTruthy();
    expect(getByTestId('biometric-continue-button')).toBeTruthy();
    expect(getByTestId('biometric-skip-button')).toBeTruthy();
  });

  it('calls onComplete when continue is pressed', () => {
    const { getByTestId } = render(
      <BiometricSetupScreen onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    fireEvent.press(getByTestId('biometric-continue-button'));

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('calls onSkip when skip is pressed', () => {
    const { getByTestId } = render(
      <BiometricSetupScreen onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    fireEvent.press(getByTestId('biometric-skip-button'));

    expect(mockOnSkip).toHaveBeenCalled();
  });
});
