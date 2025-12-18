import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ScreenContainer, Text, Card, LoadingSpinner, Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useTransactionStore, Transaction } from '../store/transactionStore';
import { useAccountStore } from '../store/accountStore';
import { websocketService } from '../services/websocket';
import api from '../services/api';
import { MainStackParamList } from '../navigation/types';

type TransactionDetailRouteProp = RouteProp<MainStackParamList, 'TransactionDetail'>;

/**
 * Transaction Detail screen showing full transaction information with real-time status updates
 * Requirements: 6.2, 6.3, 6.4
 */
export const TransactionDetailScreen: React.FC = () => {
  const route = useRoute<TransactionDetailRouteProp>();
  const { transactionId } = route.params;
  const { account } = useAccountStore();
  const { transactions, updateTransaction } = useTransactionStore();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Find transaction in store or fetch from API
  const fetchTransaction = useCallback(async () => {
    try {
      setError(null);
      
      // First check if transaction exists in store
      const storedTransaction = transactions.find((t) => t.id === transactionId);
      if (storedTransaction) {
        setTransaction(storedTransaction);
        setIsLoading(false);
        return;
      }

      // Fetch from API if not in store
      const response = await api.get(`/api/transactions/${transactionId}`);
      setTransaction(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transaction details');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, transactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.get(`/api/transactions/${transactionId}`);
      setTransaction(response.data);
      updateTransaction(transactionId, response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to refresh transaction');
    } finally {
      setRefreshing(false);
    }
  }, [transactionId, updateTransaction]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  // Listen for real-time transaction updates
  useEffect(() => {
    const unsubscribe = websocketService.onTransactionUpdate((data) => {
      if (data.transactionId === transactionId) {
        setTransaction((prev) =>
          prev
            ? {
                ...prev,
                status: data.status as Transaction['status'],
                processedAt: data.processedAt,
              }
            : prev
        );
      }
    });

    return () => unsubscribe();
  }, [transactionId]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'failed':
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'pending':
        return '⏳';
      case 'failed':
        return '✗';
      case 'cancelled':
        return '⊘';
      default:
        return '•';
    }
  };

  const isOutgoing = transaction?.fromAccountId === account?.id;

  if (isLoading) {
    return (
      <ScreenContainer safeArea>
        <View style={styles.centerContainer}>
          <LoadingSpinner size="large" />
          <Text variant="body" color={colors.textSecondary} style={styles.loadingText}>
            Loading transaction...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error || !transaction) {
    return (
      <ScreenContainer safeArea>
        <View style={styles.centerContainer}>
          <Text variant="h3" color={colors.error} align="center">
            {error || 'Transaction not found'}
          </Text>
          <Button
            title="Retry"
            onPress={fetchTransaction}
            variant="outline"
            style={styles.retryButton}
            testID="retry-button"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer safeArea padding={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        testID="transaction-detail-scroll"
      >
        {/* Amount Card */}
        <Card variant="elevated" style={styles.amountCard}>
          <Text
            variant="h1"
            color={isOutgoing ? colors.error : colors.success}
            align="center"
            testID="transaction-amount"
          >
            {isOutgoing ? '-' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
          </Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(transaction.status) + '20' },
              ]}
            >
              <Text variant="body" color={getStatusColor(transaction.status)}>
                {getStatusIcon(transaction.status)} {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Transaction Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text variant="h3" style={styles.sectionTitle}>
            Transaction Details
          </Text>

          <View style={styles.detailRow}>
            <Text variant="body" color={colors.textSecondary}>
              Type
            </Text>
            <Text variant="body" testID="transaction-type">
              {isOutgoing ? 'Sent' : 'Received'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="body" color={colors.textSecondary}>
              {isOutgoing ? 'To' : 'From'}
            </Text>
            <Text variant="body" testID="transaction-counterparty">
              {transaction.counterpartyName || (isOutgoing ? 'Recipient' : 'Sender')}
            </Text>
          </View>

          {transaction.description && (
            <View style={styles.detailRow}>
              <Text variant="body" color={colors.textSecondary}>
                Description
              </Text>
              <Text variant="body" style={styles.descriptionText} testID="transaction-description">
                {transaction.description}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text variant="body" color={colors.textSecondary}>
              Transaction ID
            </Text>
            <Text variant="caption" color={colors.textLight} testID="transaction-id">
              {transaction.id}
            </Text>
          </View>
        </Card>

        {/* Timestamps */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text variant="h3" style={styles.sectionTitle}>
            Timeline
          </Text>

          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
            <View style={styles.timelineContent}>
              <Text variant="body">Created</Text>
              <Text variant="caption" color={colors.textSecondary} testID="transaction-created-at">
                {formatDate(transaction.createdAt)}
              </Text>
            </View>
          </View>

          {transaction.processedAt && (
            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: getStatusColor(transaction.status) },
                ]}
              />
              <View style={styles.timelineContent}>
                <Text variant="body">
                  {transaction.status === 'completed' ? 'Completed' : 'Processed'}
                </Text>
                <Text variant="caption" color={colors.textSecondary} testID="transaction-processed-at">
                  {formatDate(transaction.processedAt)}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
  },
  scrollContent: {
    padding: spacing.md,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  statusContainer: {
    marginTop: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  detailsCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  descriptionText: {
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
});
