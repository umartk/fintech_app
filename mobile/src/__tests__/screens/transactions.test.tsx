/**
 * Unit tests for transaction screens
 * Tests send money form validation, transaction history display, and real-time updates
 * Requirements: 4.1, 5.2, 6.2, 6.3
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SendMoneyScreen } from '../../screens/SendMoneyScreen';
import { TransactionHistoryScreen } from '../../screens/TransactionHistoryScreen';
import { TransactionDetailScreen } from '../../screens/TransactionDetailScreen';
import { ReceiveMoneyScreen } from '../../screens/ReceiveMoneyScreen';
import { useAccountStore } from '../../store/accountStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { websocketService } from '../../services/websocket';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
  }),
  useRoute: () => ({
    name: 'TransactionDetail',
    params: { transactionId: 'tx-123' },
  }),
}));

// Mock API
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock WebSocket service
jest.mock('../../services/websocket', () => ({
  websocketService: {
    connect: jest.fn(),
    onTransactionUpdate: jest.fn(() => jest.fn()),
    onBalanceUpdate: jest.fn(() => jest.fn()),
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock @react-native-clipboard/clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
}));

// Mock Share module
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn().mockResolvedValue({}),
}));

const mockAccount = {
  id: 'account-123',
  userId: 'user-123',
  balance: 1000,
  currency: 'USD',
  status: 'active' as const,
};

const mockTransaction = {
  id: 'tx-123',
  fromAccountId: 'account-123',
  toAccountId: 'account-456',
  amount: 100,
  currency: 'USD',
  type: 'transfer' as const,
  status: 'completed' as const,
  description: 'Test payment',
  createdAt: '2025-12-18T10:00:00Z',
  processedAt: '2025-12-18T10:01:00Z',
  counterpartyName: 'John Doe',
};

const mockTransactions = [
  mockTransaction,
  {
    ...mockTransaction,
    id: 'tx-124',
    amount: 50,
    status: 'pending' as const,
    counterpartyName: 'Jane Smith',
  },
];

describe('SendMoneyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountStore.setState({ account: mockAccount });
    useTransactionStore.setState({ transactions: [] });
  });

  it('renders send money form correctly', () => {
    const { getByTestId, getByText } = render(<SendMoneyScreen />);

    expect(getByText('Available Balance')).toBeTruthy();
    expect(getByTestId('send-recipient-input')).toBeTruthy();
    expect(getByTestId('send-amount-input')).toBeTruthy();
    expect(getByTestId('send-description-input')).toBeTruthy();
    expect(getByTestId('send-submit-button')).toBeTruthy();
  });

  it('disables submit button when recipient is empty', () => {
    const { getByTestId } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-amount-input'), '100');

    // Button should be disabled when recipient is empty
    const submitButton = getByTestId('send-submit-button');
    expect(submitButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows validation error for invalid email on submit', async () => {
    const { getByTestId, queryByText } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'invalid-email');
    fireEvent.changeText(getByTestId('send-amount-input'), '100');
    fireEvent.press(getByTestId('send-submit-button'));

    await waitFor(() => {
      expect(queryByText('Invalid email address')).toBeTruthy();
    });
  });

  it('disables submit button when amount is empty', () => {
    const { getByTestId } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'test@example.com');

    // Button should be disabled when amount is empty
    const submitButton = getByTestId('send-submit-button');
    expect(submitButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows validation error for insufficient funds on submit', async () => {
    const { getByTestId, queryByText } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('send-amount-input'), '2000');
    fireEvent.press(getByTestId('send-submit-button'));

    await waitFor(() => {
      expect(queryByText('Insufficient funds')).toBeTruthy();
    });
  });

  it('calls API with valid form data', async () => {
    const mockResponse = { data: { transaction: mockTransaction } };
    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const { getByTestId } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'recipient@example.com');
    fireEvent.changeText(getByTestId('send-amount-input'), '100');
    fireEvent.changeText(getByTestId('send-description-input'), 'Test payment');
    fireEvent.press(getByTestId('send-submit-button'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/transactions/transfer', {
        recipientEmail: 'recipient@example.com',
        amount: 100,
        description: 'Test payment',
      });
    });
  });

  it('shows success alert on successful transfer', async () => {
    const mockResponse = { data: { transaction: mockTransaction } };
    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const { getByTestId } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'recipient@example.com');
    fireEvent.changeText(getByTestId('send-amount-input'), '100');
    fireEvent.press(getByTestId('send-submit-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Transfer Initiated',
        expect.stringContaining('recipient@example.com'),
        expect.any(Array)
      );
    });
  });

  it('shows error alert on transfer failure', async () => {
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Recipient not found' } },
    });

    const { getByTestId } = render(<SendMoneyScreen />);

    fireEvent.changeText(getByTestId('send-recipient-input'), 'recipient@example.com');
    fireEvent.changeText(getByTestId('send-amount-input'), '100');
    fireEvent.press(getByTestId('send-submit-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Transfer Failed', 'Recipient not found');
    });
  });
});

describe('TransactionHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountStore.setState({ account: mockAccount });
    useTransactionStore.setState({
      transactions: [],
      isLoading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
    });
  });

  it('renders transaction history list', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { transactions: mockTransactions, hasMore: false },
    });

    const { getByTestId } = render(<TransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('transaction-history-list')).toBeTruthy();
    });
  });

  it('fetches transactions on mount', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { transactions: mockTransactions, hasMore: false },
    });

    render(<TransactionHistoryScreen />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/transactions', {
        params: { page: 1, limit: 20 },
      });
    });
  });

  it('displays empty state when no transactions', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { transactions: [], hasMore: false },
    });

    const { getByText } = render(<TransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByText('No transactions yet')).toBeTruthy();
    });
  });

  it('navigates to transaction detail on item press', async () => {
    useTransactionStore.setState({ transactions: mockTransactions });
    (api.get as jest.Mock).mockResolvedValue({
      data: { transactions: mockTransactions, hasMore: false },
    });

    const { getByTestId } = render(<TransactionHistoryScreen />);

    await waitFor(() => {
      const transactionItem = getByTestId('transaction-item-tx-123');
      fireEvent.press(transactionItem);
    });

    expect(mockNavigate).toHaveBeenCalledWith('TransactionDetail', { transactionId: 'tx-123' });
  });

  it('shows error state on fetch failure', async () => {
    (api.get as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Failed to load transactions' } },
    });

    const { getByText, getByTestId } = render(<TransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByText('Failed to load transactions')).toBeTruthy();
      expect(getByTestId('retry-button')).toBeTruthy();
    });
  });
});

describe('TransactionDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountStore.setState({ account: mockAccount });
    useTransactionStore.setState({ transactions: [mockTransaction] });
  });

  it('renders transaction details from store', async () => {
    const { getByTestId } = render(<TransactionDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('transaction-amount')).toBeTruthy();
      expect(getByTestId('transaction-type')).toBeTruthy();
      expect(getByTestId('transaction-id')).toBeTruthy();
    });
  });

  it('displays correct amount with sign for outgoing transaction', async () => {
    const { getByTestId } = render(<TransactionDetailScreen />);

    await waitFor(() => {
      const amountText = getByTestId('transaction-amount');
      expect(amountText.props.children.join('')).toContain('-');
    });
  });

  it('fetches transaction from API if not in store', async () => {
    useTransactionStore.setState({ transactions: [] });
    (api.get as jest.Mock).mockResolvedValue({ data: mockTransaction });

    render(<TransactionDetailScreen />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/transactions/tx-123');
    });
  });

  it('shows error state on fetch failure', async () => {
    useTransactionStore.setState({ transactions: [] });
    (api.get as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Transaction not found' } },
    });

    const { getByText, getByTestId } = render(<TransactionDetailScreen />);

    await waitFor(() => {
      expect(getByText('Transaction not found')).toBeTruthy();
      expect(getByTestId('retry-button')).toBeTruthy();
    });
  });

  it('subscribes to real-time transaction updates', () => {
    render(<TransactionDetailScreen />);

    expect(websocketService.onTransactionUpdate).toHaveBeenCalled();
  });
});

describe('ReceiveMoneyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-123', email: 'user@example.com', firstName: 'Test' },
    });
  });

  it('renders receive money screen correctly', () => {
    const { getByTestId, getByText } = render(<ReceiveMoneyScreen />);

    expect(getByText('Scan to Pay')).toBeTruthy();
    expect(getByTestId('qr-code-container')).toBeTruthy();
    expect(getByTestId('receive-amount-input')).toBeTruthy();
    expect(getByTestId('share-payment-button')).toBeTruthy();
    expect(getByTestId('copy-link-button')).toBeTruthy();
  });

  it('displays user email in QR code area', () => {
    const { getAllByText } = render(<ReceiveMoneyScreen />);

    // Email appears in both QR code area and below it
    expect(getAllByText('user@example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('allows entering request amount', () => {
    const { getByTestId } = render(<ReceiveMoneyScreen />);

    fireEvent.changeText(getByTestId('receive-amount-input'), '50');

    expect(getByTestId('receive-amount-input').props.value).toBe('50');
  });

  it('shows copy confirmation on copy link press', async () => {
    const { getByTestId } = render(<ReceiveMoneyScreen />);

    fireEvent.press(getByTestId('copy-link-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Copied', 'Payment link copied to clipboard');
    });
  });
});
