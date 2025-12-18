import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import {
  ScreenContainer,
  Text,
  Input,
  Button,
  Card,
} from '../components';
import { colors, spacing, typography } from '../theme';
import { paymentMethodService, AddPaymentMethodRequest } from '../services';

type Props = NativeStackScreenProps<MainStackParamList, 'AddPaymentMethod'>;

type PaymentMethodType = 'BANK_ACCOUNT' | 'DEBIT_CARD' | 'CREDIT_CARD';

export const AddPaymentMethodScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState<PaymentMethodType>('BANK_ACCOUNT');
  const [formData, setFormData] = useState({
    provider: '',
    accountNumber: '',
    routingNumber: '',
    expiryDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const paymentMethodTypes = [
    { type: 'BANK_ACCOUNT' as PaymentMethodType, label: 'Bank Account', icon: '🏦' },
    { type: 'DEBIT_CARD' as PaymentMethodType, label: 'Debit Card', icon: '💳' },
    { type: 'CREDIT_CARD' as PaymentMethodType, label: 'Credit Card', icon: '💳' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.provider.trim()) {
      newErrors.provider = 'Provider is required';
    }

    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (selectedType === 'BANK_ACCOUNT') {
      if (!/^\d{4,17}$/.test(formData.accountNumber)) {
        newErrors.accountNumber = 'Bank account number must be 4-17 digits';
      }
    } else {
      // Card validation
      if (!/^\d{13,19}$/.test(formData.accountNumber)) {
        newErrors.accountNumber = 'Card number must be 13-19 digits';
      }
    }

    if (selectedType === 'BANK_ACCOUNT') {
      if (!formData.routingNumber.trim()) {
        newErrors.routingNumber = 'Routing number is required';
      } else if (!/^\d{9}$/.test(formData.routingNumber)) {
        newErrors.routingNumber = 'Routing number must be 9 digits';
      }
    } else {
      // Card expiry validation
      if (!formData.expiryDate.trim()) {
        newErrors.expiryDate = 'Expiry date is required';
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(formData.expiryDate)) {
        newErrors.expiryDate = 'Expiry date must be in MM/YY format';
      } else {
        // Check if card is expired
        const [month, year] = formData.expiryDate.split('/');
        const expiry = new Date(2000 + parseInt(year), parseInt(month), 0);
        if (expiry < new Date()) {
          newErrors.expiryDate = 'Card has expired';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      
      const requestData: AddPaymentMethodRequest = {
        type: selectedType,
        provider: formData.provider,
        accountNumber: formData.accountNumber,
      };

      if (selectedType === 'BANK_ACCOUNT') {
        requestData.routingNumber = formData.routingNumber;
      } else {
        requestData.expiryDate = formData.expiryDate;
      }

      await paymentMethodService.addPaymentMethod(requestData);
      
      Alert.alert(
        'Success',
        'Payment method added successfully. Verification may take a few moments.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      const errorMessage = error.response?.data?.message || 'Failed to add payment method';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeSelect = (type: PaymentMethodType) => {
    setSelectedType(type);
    // Clear form when switching types
    setFormData({
      provider: '',
      accountNumber: '',
      routingNumber: '',
      expiryDate: '',
    });
    setErrors({});
  };

  const formatExpiryDate = (text: string): string => {
    // Remove non-digits
    const digits = text.replace(/\D/g, '');
    
    // Add slash after 2 digits
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2, 4);
    }
    
    return digits;
  };

  const handleExpiryDateChange = (text: string): void => {
    const formatted = formatExpiryDate(text);
    setFormData({ ...formData, expiryDate: formatted });
  };

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Add Payment Method</Text>

        <Card style={styles.typeSelector}>
          <Text style={styles.sectionTitle}>Select Type</Text>
          <View style={styles.typeOptions}>
            {paymentMethodTypes.map((option) => (
              <TouchableOpacity
                key={option.type}
                style={[
                  styles.typeOption,
                  selectedType === option.type && styles.selectedTypeOption,
                ]}
                onPress={() => handleTypeSelect(option.type)}
              >
                <Text style={styles.typeIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === option.type && styles.selectedTypeLabel,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Payment Method Details</Text>

          <Input
            label="Provider"
            value={formData.provider}
            onChangeText={(text: string) => setFormData({ ...formData, provider: text })}
            error={errors.provider}
            placeholder={
              selectedType === 'BANK_ACCOUNT'
                ? 'e.g., Chase Bank'
                : 'e.g., Visa, Mastercard'
            }
          />

          <Input
            label={
              selectedType === 'BANK_ACCOUNT' ? 'Account Number' : 'Card Number'
            }
            value={formData.accountNumber}
            onChangeText={(text: string) =>
              setFormData({ ...formData, accountNumber: text.replace(/\D/g, '') })
            }
            error={errors.accountNumber}
            placeholder={
              selectedType === 'BANK_ACCOUNT'
                ? '1234567890123456'
                : '1234 5678 9012 3456'
            }
            keyboardType="numeric"
            maxLength={selectedType === 'BANK_ACCOUNT' ? 17 : 19}
          />

          {selectedType === 'BANK_ACCOUNT' ? (
            <Input
              label="Routing Number"
              value={formData.routingNumber}
              onChangeText={(text: string) =>
                setFormData({ ...formData, routingNumber: text.replace(/\D/g, '') })
              }
              error={errors.routingNumber}
              placeholder="123456789"
              keyboardType="numeric"
              maxLength={9}
            />
          ) : (
            <Input
              label="Expiry Date"
              value={formData.expiryDate}
              onChangeText={handleExpiryDateChange}
              error={errors.expiryDate}
              placeholder="MM/YY"
              keyboardType="numeric"
              maxLength={5}
            />
          )}

          <View style={styles.securityNote}>
            <Text style={styles.securityTitle}>🔒 Security Notice</Text>
            <Text style={styles.securityText}>
              Your payment information is encrypted and stored securely. We never
              store your full account details.
            </Text>
          </View>

          <Button
            title="Add Payment Method"
            onPress={handleSubmit}
            loading={isLoading}
            style={styles.submitButton}
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  typeSelector: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  selectedTypeOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  selectedTypeLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  formCard: {
    marginBottom: spacing.md,
  },
  securityNote: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: 8,
    marginVertical: spacing.md,
  },
  securityTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  securityText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});