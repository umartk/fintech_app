import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer, Text, Card, LoadingSpinner, Button } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useAccountStore } from '../store/accountStore';
import { useTransactionStore, Transaction } from '../store/transactionStore';
import { useAuthStore } from '../store/authStore';
import { websocketService } from '../services/websocket';
import api from '../services/api';
import { MainStackParamList } from '../navigation/types';

type DashboardNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Dashboard'>;

/**
 * Dashboard screen displaying account balance and recent transactions
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user } = useAuthStore();
  const {
    account,
    isLoading: accountLoading,
    error: accountError,
    setAccount,
    setLoading: setAccountLoading,
    setError: setAccountError,
    updateBalance,
    cacheAccountData,
    loadCachedData,
  } = useAccountStore();

  const {
    transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    setTransactions,
    updateTransaction,
    setLoading: setTransactionsLoading,
    setError: setTransactionsError,
    cacheTransactions,
    loadCachedTransactions,
  } = useTransactionStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch account data from API
  const fetchAccountData = useCallback(async () => {
    try {
      setAccountLoading(true);
      setAccountError(null);
      const response = await api.get('/api/users/account');
      setAccount(response.data);
      await cacheAccountData();
    } catch (error: any) {
      setAccountError(error.response?.data?.message || 'Failed to load account data');
      // Try to load cached data on error
      await loadCachedData();
    } finally {
      setAccountLoading(false);
    }
  }, [setAccount, setAccountLoading, setAccountError, cacheAccountData, loadCachedData]);

  // Fetch recent transactions from API
  const fetchTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      setTransactionsError(null);
      const response = await api.get('/api/transactions', {
        params: { page: 1, limit: 10 },
      });
      setTransactions(response.data.transactions || []);
      await cacheTransactions();
    } catch (error: any) {
      setTransactionsError(error.response?.data?.message || 'Failed to load transactions');
      // Try to load cached transactions on error
      await loadCachedTransactions();
    } finally {
      setTransactionsLoading(false);
    }
  }, [setTransactions, setTransactionsLoading, setTransactionsError, cacheTransactions, loadCachedTransactions]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAccountData(), fetchTransactions()]);
    setRefreshing(false);
  }, [fetchAccountData, fetchTransactions]);

  // Initial data load
  useEffect(() => {
    fetchAccountData();
    fetchTransactions();
  }, [fetchAccountData, fetchTransactions]);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    websocketService.connect();

    const unsubscribeBalance = websocketService.onBalanceUpdate((data) => {
      updateBalance(data.balance);
    });

    const unsubscribeTransaction = websocketService.onTransactionUpdate((data) => {
      updateTransaction(data.transactionId, {
        status: data.status as Transaction['status'],
        processedAt: data.processedAt,
      });
    });

    return () => {
      unsubscribeBalance();
      unsubscribeTransaction();
    };
  }, [updateBalance, updateTransaction]);

  // Format currency for display
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get transaction display info
  const getTransactionInfo = (transaction: Transaction) => {
    const isOutgoing = transaction.fromAccountId === account?.id;
    const sign = isOutgoing ? '-' : '+';
    const color = isOutgoing ? colors.error : colors.success;
    const counterparty = transaction.counterpartyName || (isOutgoing ? 'Sent' : 'Received');
    return { sign, color, counterparty };
  };

  // Render balance card
  const renderBalanceCard = () => {
    if (accountLoading && !account) {
      return (
        <Card variant="elevated" style={styles.balanceCard}>
          <LoadingSpinner size="small" />
          <Text variant="caption" color={colors.textSecondary} style={styles.loadingText}>
            Loading balance...
          </Text>
        </Card>
      );
    }

    if (accountError && !account) {
      return (
        <Card variant="elevated" style={styles.balanceCard}>
          <Text variant="body" color={colors.error} align="center">
            {accountError}
          </Text>
          <Button
            title="Retry"
            onPress={fetchAccountData}
            variant="outline"
            size="sm"
            style={styles.retryButton}
          />
        </Card>
      );
    }

    return (
      <Card variant="elevated" style={styles.balanceCard}>
        <Text variant="caption" color={colors.textSecondary}>
          Available Balance
        </Text>
        <Text variant="h1" style={styles.balanceAmount}>
          {formatCurrency(account?.balance || 0, account?.currency)}
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SendMoney')}
            testID="send-money-button"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
              <Text variant="body" color={colors.white}>↑</Text>
            </View>
            <Text variant="caption">Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReceiveMoney')}
            testID="receive-money-button"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
              <Text variant="body" color={colors.white}>↓</Text>
            </View>
            <Text variant="caption">Receive</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  // Render transaction item
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const { sign, color, counterparty } = getTransactionInfo(item);

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })}
        testID={`transaction-item-${item.id}`}
      >
        <View style={styles.transactionInfo}>
          <Text variant="body" numberOfLines={1}>
            {counterparty}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text variant="body" color={color}>
            {sign}{formatCurrency(item.amount, item.currency)}
          </Text>
          <Text
            variant="caption"
            color={item.status === 'completed' ? colors.success : colors.warning}
          >
            {item.status}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state for transactions
  const renderEmptyState = () => {
    if (transactionsLoading) {
      return (
        <View style={styles.emptyState}>
          <LoadingSpinner size="small" />
          <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
            Loading transactions...
          </Text>
        </View>
      );
    }

    if (transactionsError) {
      return (
        <View style={styles.emptyState}>
          <Text variant="body" color={colors.error} align="center">
            {transactionsError}
          </Text>
          <Button
            title="Retry"
            onPress={fetchTransactions}
            variant="outline"
            size="sm"
            style={styles.retryButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text variant="h3" align="center" style={styles.emptyTitle}>
          No transactions yet
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={styles.emptyText}>
          Start by sending or receiving money to see your transaction history here.
        </Text>
        <Button
          title="Send Money"
          onPress={() => navigation.navigate('SendMoney')}
          style={styles.emptyButton}
          testID="empty-state-send-button"
        />
      </View>
    );
  };

  // Render transactions header
  const renderTransactionsHeader = () => (
    <View style={styles.sectionHeader}>
      <Text variant="h3">Recent Transactions</Text>
      {transactions.length > 0 && (
        <TouchableOpacity
          onPress={() => navigation.navigate('TransactionHistory')}
          testID="view-all-transactions"
        >
          <Text variant="body" color={colors.primary}>
            View All
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScreenContainer safeArea padding={false}>
      <View style={styles.header}>
        <Text variant="h2">
          Hello, {user?.firstName || 'there'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          testID="profile-button"
        >
          <View style={styles.profileIcon}>
            <Text variant="body" color={colors.white}>
              {user?.firstName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        ListHeaderComponent={
          <>
            {renderBalanceCard()}
            {renderTransactionsHeader()}
          </>
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            testID="refresh-control"
          />
        }
        showsVerticalScrollIndicator={false}
        testID="dashboard-list"
      />
    </ScreenContainer>
  );
};


const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  balanceAmount: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 150,
  },
  retryButton: {
    marginTop: spacing.md,
  },
});
