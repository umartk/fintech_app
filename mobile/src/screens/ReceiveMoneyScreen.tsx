import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Share,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { ScreenContainer, Text, Card, Button, Input } from '../components';
import { colors, spacing, borderRadius } from '../theme';
import { useAuthStore } from '../store/authStore';

/**
 * Receive Money screen with QR code generation and sharing
 * Requirements: 5.2, 5.3, 5.5
 */
export const ReceiveMoneyScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [requestAmount, setRequestAmount] = useState('');

  // Generate a simple payment link/identifier
  const paymentIdentifier = useMemo(() => {
    const baseId = user?.email || user?.id || 'unknown';
    const amount = requestAmount ? `?amount=${requestAmount}` : '';
    return `fintech://pay/${encodeURIComponent(baseId)}${amount}`;
  }, [user, requestAmount]);

  // Generate QR code data (simplified - in production would use a QR library)
  const qrCodeData = useMemo(() => {
    return JSON.stringify({
      type: 'payment_request',
      recipient: user?.email,
      recipientId: user?.id,
      amount: requestAmount ? parseFloat(requestAmount) : undefined,
      timestamp: new Date().toISOString(),
    });
  }, [user, requestAmount]);

  const handleShare = async () => {
    try {
      const message = requestAmount
        ? `Send me ${formatCurrency(parseFloat(requestAmount))} via Fintech App: ${paymentIdentifier}`
        : `Send me money via Fintech App: ${paymentIdentifier}`;

      await Share.share({
        message,
        title: 'Request Payment',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(paymentIdentifier);
    Alert.alert('Copied', 'Payment link copied to clipboard');
  };

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setRequestAmount(cleaned);
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  return (
    <ScreenContainer safeArea>
      <View style={styles.container}>
        {/* QR Code Display */}
        <Card variant="elevated" style={styles.qrCard}>
          <Text variant="h3" align="center" style={styles.title}>
            Scan to Pay
          </Text>
          
          {/* QR Code Placeholder - In production, use react-native-qrcode-svg */}
          <View style={styles.qrContainer} testID="qr-code-container">
            <View style={styles.qrPlaceholder}>
              <Text variant="caption" color={colors.textSecondary} align="center">
                QR Code
              </Text>
              <Text variant="caption" color={colors.textLight} align="center" style={styles.qrData}>
                {user?.email}
              </Text>
              {requestAmount && (
                <Text variant="body" color={colors.primary} align="center" style={styles.qrAmount}>
                  {formatCurrency(parseFloat(requestAmount))}
                </Text>
              )}
            </View>
          </View>

          <Text variant="body" align="center" color={colors.textSecondary} style={styles.email}>
            {user?.email}
          </Text>
        </Card>

        {/* Request Amount */}
        <Card variant="outlined" style={styles.amountCard}>
          <Input
            label="Request Amount (Optional)"
            placeholder="0.00"
            value={requestAmount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            leftIcon={<Text variant="body" color={colors.textSecondary}>$</Text>}
            testID="receive-amount-input"
          />
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Share Payment Link"
            onPress={handleShare}
            style={styles.shareButton}
            testID="share-payment-button"
          />
          
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyLink}
            testID="copy-link-button"
          >
            <Text variant="body" color={colors.primary}>
              Copy Payment Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <Card variant="outlined" style={styles.instructionsCard}>
          <Text variant="caption" color={colors.textSecondary}>
            How to receive money:
          </Text>
          <View style={styles.instructionItem}>
            <Text variant="body">1. Share your QR code or payment link</Text>
          </View>
          <View style={styles.instructionItem}>
            <Text variant="body">2. The sender scans or opens the link</Text>
          </View>
          <View style={styles.instructionItem}>
            <Text variant="body">3. Money is sent directly to your account</Text>
          </View>
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  qrCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  qrContainer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  qrData: {
    marginTop: spacing.xs,
    fontSize: 10,
  },
  qrAmount: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  email: {
    marginTop: spacing.xs,
  },
  amountCard: {
    marginBottom: spacing.md,
  },
  actions: {
    marginBottom: spacing.md,
  },
  shareButton: {
    marginBottom: spacing.sm,
  },
  copyButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  instructionsCard: {
    marginTop: 'auto',
  },
  instructionItem: {
    marginTop: spacing.xs,
  },
});
