import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer, Text, Card, LoadingSpinner, Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useTransactionStore, Transaction } from '../store/transactionStore';
import { useAccountStore } from '../store/accountStore';
import { websocketService } from '../services/websocket';
import api from '../services/api';
import { MainStackParamList } from '../navigation/types';

type TransactionHistoryNavigationProp = NativeStackNavigationProp<MainStackParamList, 'TransactionHistory'>;

const PAGE_SIZE = 20;

/**
 * Transaction History screen with pagination and real-time updates
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export const TransactionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<TransactionHistoryNavigationProp>();
  const { account } = useAccountStore();
  const {
    transactions,
    setTransactions,
    appendTransactions,
    updateTransaction,
    hasMore,
    setHasMore,
    currentPage,
    incrementPage,
    resetPagination,
    isLoading,
    setLoading,
    error,
    setError,
  } = useTransactionStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTransactions = useCallback(async (page: number = 1, refresh: boolean = false) => {
    try {
      if (refresh) {
        setLoading(true);
        resetPagination();
      }
      setError(null);

      const response = await api.get('/api/transactions', {
        params: { page, limit: PAGE_SIZE },
      });

      const { transactions: newTransactions, hasMore: moreAvailable } = response.data;

      if (refresh || page === 1) {
        setTransactions(newTransactions);
      } else {
        appendTransactions(newTransactions);
      }

      setHasMore(moreAvailable);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [setTransactions, appendTransactions, setHasMore, resetPagination, setLoading, setError]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions(1, true);
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || isLoading) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;
    incrementPage();
    await fetchTransactions(nextPage);
  }, [loadingMore, hasMore, isLoading, currentPage, incrementPage, fetchTransactions]);

  useEffect(() => {
    fetchTransactions(1, true);
  }, []);

  // Listen for real-time transaction updates
  useEffect(() => {
    const unsubscribe = websocketService.onTransactionUpdate((data) => {
      updateTransaction(data.transactionId, {
        status: data.status as Transaction['status'],
        processedAt: data.processedAt,
      });
    });

    return () => unsubscribe();
  }, [updateTransaction]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isOutgoing = item.fromAccountId === account?.id;
    const sign = isOutgoing ? '-' : '+';
    const amountColor = isOutgoing ? colors.error : colors.success;
    const counterparty = item.counterpartyName || (isOutgoing ? 'Sent' : 'Received');

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })}
        testID={`transaction-item-${item.id}`}
      >
        <View style={styles.transactionIcon}>
          <Text variant="h3" color={amountColor}>
            {isOutgoing ? '↑' : '↓'}
          </Text>
        </View>

        <View style={styles.transactionInfo}>
          <Text variant="body" numberOfLines={1}>
            {counterparty}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {formatDate(item.createdAt)}
          </Text>
          {item.description && (
            <Text variant="caption" color={colors.textLight} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>

        <View style={styles.transactionAmount}>
          <Text variant="body" color={amountColor}>
            {sign}{formatCurrency(item.amount, item.currency)}
          </Text>
          <Text variant="caption" color={getStatusColor(item.status)}>
            {item.status}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption" color={colors.textSecondary} style={styles.footerText}>
          Loading more...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <LoadingSpinner size="large" />
          <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
            Loading transactions...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="body" color={colors.error} align="center">
            {error}
          </Text>
          <Button
            title="Retry"
            onPress={() => fetchTransactions(1, true)}
            variant="outline"
            style={styles.retryButton}
            testID="retry-button"
          />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text variant="h3" align="center" style={styles.emptyTitle}>
          No transactions yet
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={styles.emptyText}>
          Your transaction history will appear here once you start sending or receiving money.
        </Text>
        <Button
          title="Send Money"
          onPress={() => navigation.navigate('SendMoney')}
          style={styles.emptyButton}
          testID="empty-send-button"
        />
      </View>
    );
  };

  return (
    <ScreenContainer safeArea padding={false}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContent,
          transactions.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        testID="transaction-history-list"
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: spacing.sm,
  },
  emptyListContent: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  footerText: {
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyButton: {
    minWidth: 150,
  },
  retryButton: {
    marginTop: spacing.md,
  },
});
