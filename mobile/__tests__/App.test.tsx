/**
 * @format
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Fintech Mobile App')).toBeTruthy();
  });

  it('renders the welcome subtitle', () => {
    render(<App />);
    expect(screen.getByText('Welcome to your financial dashboard')).toBeTruthy();
  });
});
