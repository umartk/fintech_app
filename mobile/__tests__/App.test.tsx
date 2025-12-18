/**
 * @format
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

// Mock the auth store to control authentication state
jest.mock('../src/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
    loadStoredAuth: jest.fn(),
  })),
}));

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);
    // The app should render the Login placeholder screen when not authenticated
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeTruthy();
    });
  });

  it('shows placeholder screen for unauthenticated users', async () => {
    render(<App />);
    await waitFor(() => {
      // Use getAllByText since there may be multiple screens rendered
      const placeholderTexts = screen.getAllByText('This screen will be implemented in a future task');
      expect(placeholderTexts.length).toBeGreaterThan(0);
    });
  });
});
