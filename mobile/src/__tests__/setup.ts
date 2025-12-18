// Global test setup for React Native
import 'react-native';
import React from 'react';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// Mock react-native-biometrics
jest.mock('react-native-biometrics', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      isSensorAvailable: jest.fn().mockResolvedValue({
        available: true,
        biometryType: 'TouchID',
      }),
      biometricKeysExist: jest.fn().mockResolvedValue({ keysExist: false }),
      createKeys: jest.fn().mockResolvedValue({ publicKey: 'mock-public-key' }),
      deleteKeys: jest.fn().mockResolvedValue({ keysDeleted: true }),
      simplePrompt: jest.fn().mockResolvedValue({ success: true }),
    })),
    BiometryTypes: {
      TouchID: 'TouchID',
      FaceID: 'FaceID',
      Biometrics: 'Biometrics',
    },
  };
});

// Mock @react-native-clipboard/clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    enableScreens: jest.fn(),
    Screen: View,
    ScreenContainer: View,
    NativeScreen: View,
    NativeScreenContainer: View,
    ScreenStack: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
    ScreenStackHeaderBackButtonImage: View,
    ScreenStackHeaderRightView: View,
    ScreenStackHeaderLeftView: View,
    ScreenStackHeaderCenterView: View,
    ScreenStackHeaderSearchBarView: View,
    SearchBar: View,
    FullWindowOverlay: View,
    useTransitionProgress: () => ({ progress: { value: 1 } }),
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => false,
    }),
    useRoute: () => ({
      name: 'TestScreen',
      params: {},
    }),
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => 
        React.createElement(View, null, children),
      Screen: ({ name, component: Component }: { name: string; component: React.ComponentType }) => 
        React.createElement(View, null, 
          React.createElement(Text, null, name),
          React.createElement(Component, null)
        ),
    }),
  };
});

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (typeof message === 'string' && message.includes('Animated')) return;
  if (typeof message === 'string' && message.includes('act(...)')) return;
  originalWarn(...args);
};
