import * as fc from 'fast-check';

// Common arbitraries for property-based testing in mobile app

export const emailArbitrary = fc.emailAddress();

// Generate valid passwords with uppercase, lowercase, digits
export const passwordArbitrary = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 3, unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ') }),
    fc.string({ minLength: 3, maxLength: 5, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz') }),
    fc.string({ minLength: 1, maxLength: 2, unit: fc.constantFrom(...'0123456789') }),
    fc.string({ minLength: 0, maxLength: 2, unit: fc.constantFrom(...'!@#$%^&*') })
  )
  .map(([upper, lower, digits, special]: [string, string, string, string]) => upper + lower + digits + special);

export const positiveAmountArbitrary = fc
  .double({
    min: 0.01,
    max: 1000000,
    noNaN: true,
  })
  .map((n) => Math.round(n * 100) / 100);

export const transactionArbitrary = fc.record({
  id: fc.uuid(),
  fromAccountId: fc.uuid(),
  toAccountId: fc.uuid(),
  amount: positiveAmountArbitrary,
  currency: fc.constantFrom('USD', 'EUR', 'GBP'),
  type: fc.constantFrom('transfer', 'deposit', 'withdrawal'),
  status: fc.constantFrom('pending', 'completed', 'failed', 'cancelled'),
  createdAt: fc.date().map((d) => d.toISOString()),
});

// Property test configuration
export const propertyConfig = {
  numRuns: 100,
  verbose: true,
};
