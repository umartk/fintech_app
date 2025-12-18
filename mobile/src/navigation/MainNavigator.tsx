import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from './types';
import { colors } from '../theme';

// Implemented screens
import { DashboardScreen } from '../screens/DashboardScreen';
import { SendMoneyScreen } from '../screens/SendMoneyScreen';
import { ReceiveMoneyScreen } from '../screens/ReceiveMoneyScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
// Placeholder screens - will be implemented in later tasks
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SendMoney"
        component={SendMoneyScreen}
        options={{ title: 'Send Money' }}
      />
      <Stack.Screen
        name="ReceiveMoney"
        component={ReceiveMoneyScreen}
        options={{ title: 'Receive Money' }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: 'Transaction Details' }}
      />
      <Stack.Screen
        name="Profile"
        component={PlaceholderScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="SecuritySettings"
        component={PlaceholderScreen}
        options={{ title: 'Security Settings' }}
      />
      <Stack.Screen
        name="PaymentMethods"
        component={PlaceholderScreen}
        options={{ title: 'Payment Methods' }}
      />
      <Stack.Screen
        name="AddPaymentMethod"
        component={PlaceholderScreen}
        options={{ title: 'Add Payment Method' }}
      />
    </Stack.Navigator>
  );
};
