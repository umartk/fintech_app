/**
 * Navigation type definitions
 */

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  OTPVerification: { email: string; userId: string };
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  Dashboard: undefined;
  SendMoney: undefined;
  ReceiveMoney: undefined;
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
  Profile: undefined;
  SecuritySettings: undefined;
  PaymentMethods: undefined;
  AddPaymentMethod: undefined;
};

// Navigation prop types for screens
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
