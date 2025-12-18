import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer, Text, Card, Button, Input, ErrorMessage, ConfirmationModal } from '../components';
import { colors, spacing } from '../theme';
import { useAccountStore } from '../store/accountStore';
import { useTransactionStore } from '../store/transactionStore';
import { useAppStore } from '../store/appStore';
import api from '../services/api';
import { notificationService } from '../services/notifications';
import { MainStackParamList } from '../navigation/types';
import { validateEmail, parseError } from '../utils';
import { useToast } from '../context';

type SendMoneyNavigationProp = NativeStackNavigationProp<MainStackParamList, 'SendMoney'>;

/**
 * Send Money screen for initiating money transfers
 * Requirements: 4.1, 4.4
 */
export const SendMoneyScreen: React.FC = () => {
  const navigation = useNavigation<SendMoneyNavigationProp>();
  const { account } = useAccountStore();
  const { addTransaction } = useTransactionStore();
  const { isOnline } = useAppStore();
  const { showSuccess, showError } = useToast();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const validateForm = useCallback((): boolean => {
    const newErrors: { recipient?: string; amount?: string } = {};

    if (!recipient.trim()) {
      newErrors.recipient = 'Recipient email is required';
    } else if (!validateEmail(recipient.trim())) {
      newErrors.recipient = 'Invalid email address';
    }

    const amountNum = parseFloat(amount);
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (account && amountNum > account.balance) {
      newErrors.amount = 'Insufficient funds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [recipient, amount, account]);

  const handleSendMoney = useCallback(async () => {
    if (!validateForm()) return;

    // Check offline status (Requirements: 12.2)
    if (!isOnline) {
      showError('Cannot send money while offline');
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const response = await api.post('/api/transactions/transfer', {
        recipientEmail: recipient.trim(),
        amount: parseFloat(amount),
        description: description.trim() || undefined,
      });

      const transaction = response.data.transaction;
      addTransaction(transaction);

      // Create notification for sent money (Requirements: 4.4)
      notificationService.createTransactionNotification(
        'sent',
        transaction.id,
        parseFloat(amount),
        account?.currency || 'USD',
        recipient.trim()
      );

      showSuccess(`${formatCurrency(parseFloat(amount))} sent successfully!`);
      setShowConfirmation(true);
    } catch (error: unknown) {
      const parsed = parseError(error);
      setApiError(parsed.message);
      if (parsed.isNetworkError) {
        showError('Please check your internet connection');
      }
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, recipient, amount, description, addTransaction, isOnline, showSuccess, showError, account?.currency]);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleRecipientChange = (text: string) => {
    setRecipient(text);
    if (errors.recipient) setErrors((prev) => ({ ...prev, recipient: undefined }));
  };

  return (
    <ScreenContainer safeArea>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Balance Card */}
          <Card variant="outlined" style={styles.balanceCard}>
            <Text variant="caption" color={colors.textSecondary}>
              Available Balance
            </Text>
            <Text variant="h2" style={styles.balanceAmount}>
              {formatCurrency(account?.balance || 0, account?.currency)}
            </Text>
          </Card>

          {/* Error Message */}
          {apiError && (
            <ErrorMessage
              message={apiError}
              variant="card"
              onDismiss={() => setApiError(null)}
              onRetry={handleSendMoney}
              style={styles.errorMessage}
              testID="send-error"
            />
          )}

          {/* Send Form */}
          <View style={styles.form}>
            <Input
              label="Recipient Email"
              placeholder="Enter recipient's email"
              value={recipient}
              onChangeText={handleRecipientChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.recipient}
              testID="send-recipient-input"
            />

            <Input
              label="Amount"
              placeholder="0.00"
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              error={errors.amount}
              leftIcon={<Text variant="body" color={colors.textSecondary}>$</Text>}
              testID="send-amount-input"
            />

            <Input
              label="Description (Optional)"
              placeholder="What's this for?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              testID="send-description-input"
            />
          </View>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <Card variant="elevated" style={styles.summaryCard}>
              <Text variant="caption" color={colors.textSecondary}>
                Transfer Summary
              </Text>
              <View style={styles.summaryRow}>
                <Text variant="body">Amount</Text>
                <Text variant="body">{formatCurrency(parseFloat(amount) || 0)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="body">Fee</Text>
                <Text variant="body" color={colors.success}>Free</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text variant="h3">Total</Text>
                <Text variant="h3">{formatCurrency(parseFloat(amount) || 0)}</Text>
              </View>
            </Card>
          )}
        </ScrollView>

        {/* Send Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? 'Sending...' : 'Send Money'}
            onPress={handleSendMoney}
            loading={isLoading}
            disabled={isLoading || !recipient || !amount || !isOnline}
            testID="send-submit-button"
          />
          {!isOnline && (
            <Text variant="caption" color={colors.warning} align="center" style={styles.offlineText}>
              You are offline. Sending money is not available.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Success Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmation}
        title="Transfer Initiated"
        message={`${formatCurrency(parseFloat(amount) || 0)} is being sent to ${recipient}`}
        type="success"
        confirmLabel="Done"
        onDismiss={() => {
          setShowConfirmation(false);
          navigation.goBack();
        }}
        testID="send-confirmation-modal"
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
  },
  balanceCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceAmount: {
    marginTop: spacing.xs,
  },
  errorMessage: {
    marginBottom: spacing.md,
  },
  form: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    marginTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  totalRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonContainer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  offlineText: {
    marginTop: spacing.sm,
  },
});
