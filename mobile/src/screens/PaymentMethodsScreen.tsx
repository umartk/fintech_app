import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/types';
import {
  ScreenContainer,
  Text,
  Button,
  LoadingSpinner,
  Card,
} from '../components';
import { colors, spacing, typography } from '../theme';
import { paymentMethodService, PaymentMethod } from '../services';

type Props = NativeStackScreenProps<MainStackParamList, 'PaymentMethods'>;

export const PaymentMethodsScreen: React.FC<Props> = ({ navigation }) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPaymentMethods = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const methods = await paymentMethodService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  // Reload when screen comes into focus (e.g., after adding a new payment method)
  useFocusEffect(
    useCallback(() => {
      loadPaymentMethods();
    }, [])
  );

  const handleRefresh = () => {
    loadPaymentMethods(true);
  };

  const handleRemovePaymentMethod = (paymentMethod: PaymentMethod) => {
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove ${paymentMethod.maskedAccountNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentMethodService.removePaymentMethod(paymentMethod.id);
              await loadPaymentMethods();
              Alert.alert('Success', 'Payment method removed successfully');
            } catch (error) {
              console.error('Error removing payment method:', error);
              Alert.alert('Error', 'Failed to remove payment method');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (paymentMethod: PaymentMethod) => {
    if (paymentMethod.isDefault) {
      return; // Already default
    }

    try {
      await paymentMethodService.setDefaultPaymentMethod(paymentMethod.id);
      await loadPaymentMethods();
      Alert.alert('Success', 'Default payment method updated');
    } catch (error) {
      console.error('Error setting default payment method:', error);
      Alert.alert('Error', 'Failed to update default payment method');
    }
  };

  const getPaymentMethodIcon = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'BANK_ACCOUNT':
        return '🏦';
      case 'DEBIT_CARD':
        return '💳';
      case 'CREDIT_CARD':
        return '💳';
      default:
        return '💳';
    }
  };

  const getPaymentMethodTypeName = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'BANK_ACCOUNT':
        return 'Bank Account';
      case 'DEBIT_CARD':
        return 'Debit Card';
      case 'CREDIT_CARD':
        return 'Credit Card';
      default:
        return 'Payment Method';
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Payment Methods</Text>
          <Button
            title="Add New"
            onPress={() => navigation.navigate('AddPaymentMethod')}
            size="sm"
          />
        </View>

        {paymentMethods.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Payment Methods</Text>
            <Text style={styles.emptyDescription}>
              Add a payment method to fund your account or withdraw money
            </Text>
            <Button
              title="Add Payment Method"
              onPress={() => navigation.navigate('AddPaymentMethod')}
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <Card key={method.id} style={styles.methodCard}>
                <View style={styles.methodHeader}>
                  <View style={styles.methodInfo}>
                    <View style={styles.methodTitleRow}>
                      <Text style={styles.methodIcon}>
                        {getPaymentMethodIcon(method.type)}
                      </Text>
                      <View style={styles.methodDetails}>
                        <Text style={styles.methodType}>
                          {getPaymentMethodTypeName(method.type)}
                        </Text>
                        <Text style={styles.methodProvider}>{method.provider}</Text>
                      </View>
                    </View>
                    <Text style={styles.methodNumber}>
                      {method.maskedAccountNumber}
                    </Text>
                  </View>

                  <View style={styles.methodStatus}>
                    {method.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.verificationBadge,
                        method.isVerified
                          ? styles.verifiedBadge
                          : styles.unverifiedBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.verificationText,
                          method.isVerified
                            ? styles.verifiedText
                            : styles.unverifiedText,
                        ]}
                      >
                        {method.isVerified ? 'Verified' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.methodActions}>
                  {!method.isDefault && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSetDefault(method)}
                    >
                      <Text style={styles.actionButtonText}>Set as Default</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemovePaymentMethod(method)}
                  >
                    <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.methodDate}>
                  Added {new Date(method.createdAt).toLocaleDateString()}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 200,
  },
  methodsList: {
    gap: spacing.md,
  },
  methodCard: {
    marginBottom: spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  methodDetails: {
    flex: 1,
  },
  methodType: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  methodProvider: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  methodNumber: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  methodStatus: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  defaultBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  defaultText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  verificationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  verifiedBadge: {
    backgroundColor: colors.success + '20',
  },
  unverifiedBadge: {
    backgroundColor: colors.warning + '20',
  },
  verificationText: {
    ...typography.caption,
    fontWeight: '500',
  },
  verifiedText: {
    color: colors.success,
  },
  unverifiedText: {
    color: colors.warning,
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  removeButton: {
    borderColor: colors.error,
  },
  removeButtonText: {
    color: colors.error,
  },
  methodDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});