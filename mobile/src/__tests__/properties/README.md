# Property-Based Tests

This directory contains property-based tests using fast-check library for the mobile app.

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
 * **Feature: fintech-mobile-app, Property 16: UI synchronization**
 * **Validates: Requirements 8.2**
 */
```

## Running Property Tests

```bash
npm test -- --testPathPattern=properties
```
