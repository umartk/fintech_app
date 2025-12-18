import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from './types';
import { colors } from '../theme';

// Implemented screens
import { DashboardScreen } from '../screens/DashboardScreen';
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
        component={PlaceholderScreen}
        options={{ title: 'Send Money' }}
      />
      <Stack.Screen
        name="ReceiveMoney"
        component={PlaceholderScreen}
        options={{ title: 'Receive Money' }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={PlaceholderScreen}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={PlaceholderScreen}
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
