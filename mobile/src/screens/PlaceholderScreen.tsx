import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Text, Button } from '../components';
import { colors, spacing } from '../theme';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * Placeholder screen component used during development
 * Will be replaced with actual screen implementations in later tasks
 */
export const PlaceholderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text variant="h2" align="center">
          {route.name}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={styles.subtitle}>
          This screen will be implemented in a future task
        </Text>
        {navigation.canGoBack() && (
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.button}
          />
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  button: {
    minWidth: 150,
  },
});
