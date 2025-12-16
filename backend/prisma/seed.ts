import { PrismaClient, KycStatus, Role, AccountStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 10);

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
  });

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
  });

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
  });

  console.log('Created users:', { user1: user1.id, user2: user2.id, admin: admin.id });
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
