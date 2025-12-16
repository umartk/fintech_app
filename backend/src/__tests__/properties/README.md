# Property-Based Tests

This directory contains property-based tests using fast-check library.

## Configuration

Each property test runs a minimum of 100 iterations with randomly generated inputs.

## Test Format

Each property test is tagged with:
- Feature name: `fintech-mobile-app`
- Property number and description
- Requirements reference

Example:
```typescript
/**
 * **Feature: fintech-mobile-app, Property 1: Secure user account creation**
 * **Validates: Requirements 1.1**
 */
```

## Running Property Tests

```bash
npm test -- --testPathPattern=properties
```
