/**
 * Fintech Mobile App
 * Main entry point with navigation and providers
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { StatusBar, useColorScheme, AppState, AppStateStatus, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { RootNavigator } from './src/navigation';
import { colors } from './src/theme';
import { notificationService } from './src/services/notifications';
import { websocketService } from './src/services/websocket';
import { useNotificationStore } from './src/store/notificationStore';
import { useAuthStore } from './src/store/authStore';
import { useAppStore } from './src/store/appStore';
import { RootStackParamList } from './src/navigation/types';
import { ErrorBoundary, NetworkStatus } from './src/components';
import { ToastProvider } from './src/context';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const appState = useRef(AppState.currentState);
  const { addNotification, loadNotifications, loadSettings } = useNotificationStore();
  const { isAuthenticated } = useAuthStore();
  const { setOnline } = useAppStore();

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, [setOnline]);

  // Initialize notifications and load stored data
  useEffect(() => {
    const initializeNotifications = async () => {
      await loadSettings();
      await loadNotifications();

      if (isAuthenticated) {
        await notificationService.initialize();
      }
    };

    initializeNotifications();
  }, [isAuthenticated, loadNotifications, loadSettings]);

  // Set up notification handler to add notifications to store
  useEffect(() => {
    const unsubscribe = notificationService.onNotification((notification) => {
      addNotification(notification);
    });

    return () => {
      unsubscribe();
    };
  }, [addNotification]);

  // Handle WebSocket transaction updates and create notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribeTransaction = websocketService.onTransactionUpdate((data) => {
      // Create notification for transaction status changes
      if (data.status === 'completed') {
        notificationService.handleNotification({
          type: 'transaction_completed',
          title: 'Transaction Completed',
          body: 'Your transaction has been processed successfully',
          transactionId: data.transactionId,
        });
      } else if (data.status === 'failed') {
        notificationService.handleNotification({
          type: 'transaction_failed',
          title: 'Transaction Failed',
          body: 'Your transaction could not be processed',
          transactionId: data.transactionId,
        });
      }
    });

    return () => {
      unsubscribeTransaction();
    };
  }, [isAuthenticated]);

  // Handle app state changes for reconnection
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated
      ) {
        // App has come to foreground, reconnect WebSocket if needed
        if (!websocketService.isConnected()) {
          websocketService.connect();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  const handleRetryConnection = () => {
    NetInfo.fetch().then((state) => {
      setOnline(state.isConnected ?? false);
    });
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={colors.background}
          />
          <View style={{ flex: 1 }}>
            <NetworkStatus onRetry={handleRetryConnection} testID="network-status" />
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </View>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
