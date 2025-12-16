import * as fc from 'fast-check';

// Common arbitraries for property-based testing

export const emailArbitrary = fc.emailAddress();

export const passwordArbitrary = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 1, maxLength: 3 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 3, maxLength: 5 }),
    fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 2 }),
    fc.stringOf(fc.constantFrom(...'!@#$%^&*'), { minLength: 0, maxLength: 2 })
  )
  .map(([upper, lower, digits, special]) => upper + lower + digits + special);

export const positiveAmountArbitrary = fc.double({
  min: 0.01,
  max: 1000000,
  noNaN: true,
}).map((n) => Math.round(n * 100) / 100);

export const userIdArbitrary = fc.uuid();

export const transactionIdArbitrary = fc.uuid();

export const currencyArbitrary = fc.constantFrom('USD', 'EUR', 'GBP');

// Property test configuration
export const propertyConfig = {
  numRuns: 100,
  verbose: true,
};
