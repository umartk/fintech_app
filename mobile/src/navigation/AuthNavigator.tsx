import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { colors } from '../theme';

// Placeholder screens - will be implemented in task 13
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Login" component={PlaceholderScreen} />
      <Stack.Screen name="Signup" component={PlaceholderScreen} />
      <Stack.Screen name="OTPVerification" component={PlaceholderScreen} />
      <Stack.Screen name="ForgotPassword" component={PlaceholderScreen} />
    </Stack.Navigator>
  );
};
