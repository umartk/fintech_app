import {
  PrismaClient,
  KycStatus,
  Role,
  AccountStatus,
  TransactionType,
  TransactionStatus,
  PaymentMethodType,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Simple encryption for demo purposes - in production use proper encryption service
function encryptData(data: string): string {
  return Buffer.from(data).toString('base64');
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

async function main() {
  console.log('Seeding database...');

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 10);

  // User 1: Alice - Verified user with balance
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      passwordHash,
      kycStatus: KycStatus.VERIFIED,
      role: Role.USER,
      profile: {
        create: {
          firstName: 'Alice',
          lastName: 'Smith',
          phoneNumber: '+1234567890',
          dateOfBirth: new Date('1990-05-15'),
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA',
          },
        },
      },
      account: {
        create: {
          balance: 1000.0,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
        },
      },
    },
    include: { account: true },
  });

  // User 2: Bob - Verified user with balance
  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      passwordHash,
      kycStatus: KycStatus.VERIFIED,
      role: Role.USER,
      profile: {
        create: {
          firstName: 'Bob',
          lastName: 'Johnson',
          phoneNumber: '+1987654321',
          dateOfBirth: new Date('1985-08-22'),
          address: {
            street: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90001',
            country: 'USA',
          },
        },
      },
      account: {
        create: {
          balance: 500.0,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
        },
      },
    },
    include: { account: true },
  });

  // User 3: Charlie - Pending KYC user
  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      passwordHash,
      kycStatus: KycStatus.PENDING,
      role: Role.USER,
      profile: {
        create: {
          firstName: 'Charlie',
          lastName: 'Brown',
        },
      },
      account: {
        create: {
          balance: 0,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
        },
      },
    },
    include: { account: true },
  });

  // User 4: Diana - Suspended account
  const user4 = await prisma.user.upsert({
    where: { email: 'diana@example.com' },
    update: {},
    create: {
      email: 'diana@example.com',
      passwordHash,
      kycStatus: KycStatus.VERIFIED,
      role: Role.USER,
      profile: {
        create: {
          firstName: 'Diana',
          lastName: 'Prince',
        },
      },
      account: {
        create: {
          balance: 250.0,
          currency: 'USD',
          status: AccountStatus.SUSPENDED,
        },
      },
    },
    include: { account: true },
  });

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      kycStatus: KycStatus.VERIFIED,
      role: Role.ADMIN,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
        },
      },
      account: {
        create: {
          balance: 0,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
        },
      },
    },
    include: { account: true },
  });

  console.log('Created users:', {
    user1: user1.id,
    user2: user2.id,
    user3: user3.id,
    user4: user4.id,
    admin: admin.id,
  });

  // Create payment methods for users
  const bankAccountNumber = '1234567890123456';
  const cardNumber = '4111111111111111';

  await prisma.paymentMethod.createMany({
    data: [
      {
        userId: user1.id,
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Chase Bank',
        maskedAccountNumber: maskAccountNumber(bankAccountNumber),
        encryptedData: encryptData(JSON.stringify({ accountNumber: bankAccountNumber, routingNumber: '021000021' })),
        isVerified: true,
        isDefault: true,
        isActive: true,
        metadata: { bankName: 'Chase Bank', accountType: 'checking' },
      },
      {
        userId: user1.id,
        type: PaymentMethodType.DEBIT_CARD,
        provider: 'Visa',
        maskedAccountNumber: maskAccountNumber(cardNumber),
        encryptedData: encryptData(JSON.stringify({ cardNumber, expiryDate: '12/25', cvv: '123' })),
        isVerified: true,
        isDefault: false,
        isActive: true,
        metadata: { cardBrand: 'Visa', cardType: 'debit' },
      },
      {
        userId: user2.id,
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Bank of America',
        maskedAccountNumber: maskAccountNumber('9876543210987654'),
        encryptedData: encryptData(JSON.stringify({ accountNumber: '9876543210987654', routingNumber: '026009593' })),
        isVerified: true,
        isDefault: true,
        isActive: true,
        metadata: { bankName: 'Bank of America', accountType: 'savings' },
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created payment methods');

  // Create sample transactions between users
  if (user1.account && user2.account) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    await prisma.transaction.createMany({
      data: [
        // Completed transfer from Alice to Bob
        {
          fromAccountId: user1.account.id,
          toAccountId: user2.account.id,
          amount: 50.0,
          currency: 'USD',
          type: TransactionType.TRANSFER,
          status: TransactionStatus.COMPLETED,
          description: 'Lunch payment',
          idempotencyKey: crypto.randomUUID(),
          createdAt: oneWeekAgo,
          processedAt: oneWeekAgo,
        },
        // Completed transfer from Bob to Alice
        {
          fromAccountId: user2.account.id,
          toAccountId: user1.account.id,
          amount: 25.0,
          currency: 'USD',
          type: TransactionType.TRANSFER,
          status: TransactionStatus.COMPLETED,
          description: 'Coffee refund',
          idempotencyKey: crypto.randomUUID(),
          createdAt: oneDayAgo,
          processedAt: oneDayAgo,
        },
        // Pending transfer
        {
          fromAccountId: user1.account.id,
          toAccountId: user2.account.id,
          amount: 100.0,
          currency: 'USD',
          type: TransactionType.TRANSFER,
          status: TransactionStatus.PENDING,
          description: 'Monthly subscription',
          idempotencyKey: crypto.randomUUID(),
          createdAt: oneHourAgo,
        },
        // Failed transfer (insufficient funds scenario for testing)
        {
          fromAccountId: user2.account.id,
          toAccountId: user1.account.id,
          amount: 1000.0,
          currency: 'USD',
          type: TransactionType.TRANSFER,
          status: TransactionStatus.FAILED,
          description: 'Large transfer attempt',
          idempotencyKey: crypto.randomUUID(),
          createdAt: oneDayAgo,
          metadata: { failureReason: 'Insufficient funds' },
        },
      ],
      skipDuplicates: true,
    });

    console.log('Created sample transactions');
  }

  // Create OTP codes for testing (expired and valid)
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  const expiredOtpExpiry = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

  await prisma.otpCode.createMany({
    data: [
      {
        userId: user3.id,
        code: '123456',
        expiresAt: otpExpiry,
        verified: false,
      },
      {
        userId: user3.id,
        code: '654321',
        expiresAt: expiredOtpExpiry,
        verified: false,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created OTP codes');

  // Create refresh tokens for testing
  const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await prisma.refreshToken.createMany({
    data: [
      {
        userId: user1.id,
        token: crypto.randomUUID(),
        deviceId: 'device-ios-001',
        expiresAt: refreshTokenExpiry,
      },
      {
        userId: user1.id,
        token: crypto.randomUUID(),
        deviceId: 'device-android-001',
        expiresAt: refreshTokenExpiry,
      },
      {
        userId: user2.id,
        token: crypto.randomUUID(),
        deviceId: 'device-ios-002',
        expiresAt: refreshTokenExpiry,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created refresh tokens');
  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
