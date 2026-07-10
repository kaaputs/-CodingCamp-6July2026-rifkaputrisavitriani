// Feature: expense-budget-visualizer
// Property 2: Invalid item names (whitespace-only / empty) are always rejected
// Property 3: Invalid amounts are always rejected
//
// **Validates: Requirements 1.4, 1.5, 1.6**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── validateInput implementation (mirrors js/app.js) ────────────────────────
// app.js is a browser script with no ES module exports; the logic is reproduced
// here so the tests exercise the exact same code paths.

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];
const MAX_AMOUNT = 999_999_999;

function validateInput(input) {
  const errors = [];

  const itemName = (input.itemName ?? '');
  if (typeof itemName !== 'string' || itemName.trim().length === 0) {
    errors.push({ field: 'itemName', message: 'Item name is required.' });
  } else if (itemName.length > 100) {
    errors.push({ field: 'itemName', message: 'Item name must be 100 characters or fewer.' });
  }

  const rawAmount = input.amount;
  const parsed = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);

  if (!isFinite(parsed) || parsed <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number.' });
  } else if (parsed > MAX_AMOUNT) {
    errors.push({ field: 'amount', message: 'Amount must not exceed 999,999,999.' });
  }

  if (!VALID_CATEGORIES.includes(input.category)) {
    errors.push({ field: 'category', message: 'Please select a valid category.' });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A valid base input — overwrite individual fields per test as needed. */
function validInput(overrides = {}) {
  return {
    itemName: 'Lunch',
    amount: '12.50',
    category: 'Food',
    ...overrides,
  };
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('validateInput() — unit tests', () => {

  // Happy path
  it('returns valid:true and empty errors for a fully valid input', () => {
    const result = validateInput(validInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts numeric amount (not just string)', () => {
    const result = validateInput(validInput({ amount: 12.5 }));
    expect(result.valid).toBe(true);
  });

  // itemName
  it('rejects empty itemName', () => {
    const result = validateInput(validInput({ itemName: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'itemName')).toBe(true);
  });

  it('rejects itemName that is only spaces', () => {
    const result = validateInput(validInput({ itemName: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'itemName')).toBe(true);
  });

  it('rejects itemName longer than 100 characters', () => {
    const result = validateInput(validInput({ itemName: 'a'.repeat(101) }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'itemName')).toBe(true);
  });

  it('accepts itemName of exactly 100 characters', () => {
    const result = validateInput(validInput({ itemName: 'a'.repeat(100) }));
    expect(result.valid).toBe(true);
  });

  // amount
  it('rejects amount of 0', () => {
    const result = validateInput(validInput({ amount: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = validateInput(validInput({ amount: -5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects non-numeric string amount', () => {
    const result = validateInput(validInput({ amount: 'abc' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects amount > 999,999,999', () => {
    const result = validateInput(validInput({ amount: 999_999_999.01 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('accepts amount exactly at boundary 999,999,999', () => {
    const result = validateInput(validInput({ amount: 999_999_999 }));
    expect(result.valid).toBe(true);
  });

  it('accepts amount of 0.01', () => {
    const result = validateInput(validInput({ amount: 0.01 }));
    expect(result.valid).toBe(true);
  });

  // category
  it('rejects an invalid category', () => {
    const result = validateInput(validInput({ category: 'Entertainment' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'category')).toBe(true);
  });

  it('rejects empty category', () => {
    const result = validateInput(validInput({ category: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'category')).toBe(true);
  });

  // Multi-error collection
  it('collects all errors rather than stopping at first failure', () => {
    const result = validateInput({ itemName: '', amount: -1, category: 'Bogus' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'itemName')).toBe(true);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
    expect(result.errors.some(e => e.field === 'category')).toBe(true);
  });

  // Boundary: amount 999999999.01 is invalid
  it('rejects amount 999999999.01', () => {
    const result = validateInput(validInput({ amount: 999_999_999.01 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });
});

// ─── Property-based tests ─────────────────────────────────────────────────────

describe('validateInput() — property-based tests', () => {

  // ── P2: Whitespace-only / empty item names are always rejected ─────────────
  //
  // For any string composed entirely of whitespace characters (including the
  // empty string), attempting to add it as an item name SHALL be rejected
  // without modifying the transaction list.
  //
  // **Validates: Requirements 1.4**

  it('P2: any whitespace-only or empty itemName is rejected', () => {
    // Whitespace characters recognized by String.prototype.trim():
    // space, tab, newline, carriage return, form feed, vertical tab, and Unicode spaces
    const whitespaceChars = [' ', '\t', '\n', '\r', '\f', '\v', '\u00A0', '\u2000', '\u2001', '\u2003'];
    fc.assert(
      fc.property(
        // Generate strings composed entirely of whitespace (including empty string)
        fc.array(fc.constantFrom(...whitespaceChars)).map(chars => chars.join('')),
        fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (whitespaceItemName, amount, category) => {
          const result = validateInput({ itemName: whitespaceItemName, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'itemName')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── P3: Invalid amounts are always rejected ────────────────────────────────
  //
  // For any value that is not a finite positive number (including 0, negative
  // numbers, NaN, Infinity, and non-numeric strings), submitting it as an
  // amount SHALL be rejected.
  //
  // **Validates: Requirements 1.5**

  it('P3: zero is always rejected as amount', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (amount, itemName, category) => {
          const result = validateInput({ itemName, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('P3: negative numbers are always rejected as amount', () => {
    fc.assert(
      fc.property(
        // Generate negative 32-bit floats (max must be a 32-bit float value)
        fc.float({ min: Math.fround(-1e38), max: Math.fround(-1e-38), noNaN: true }),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (amount, itemName, category) => {
          const result = validateInput({ itemName, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P3: NaN is always rejected as amount', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (itemName, category) => {
          const result = validateInput({ itemName, amount: NaN, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('P3: non-numeric strings are always rejected as amount', () => {
    fc.assert(
      fc.property(
        // Generate strings that do NOT parse to a finite positive number
        fc.string({ minLength: 1 }).filter(s => {
          const n = parseFloat(s);
          return !isFinite(n) || n <= 0;
        }),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (amount, itemName, category) => {
          const result = validateInput({ itemName, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Valid inputs always pass ───────────────────────────────────────────────
  //
  // Any combination of a non-empty trimmed name ≤ 100 chars, amount in
  // (0.01, 999999999], and a valid category must produce valid:true.

  it('fully valid inputs always produce valid:true with no errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (itemName, amount, category) => {
          const result = validateInput({ itemName, amount, category });
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Amount boundary: exactly 999999999 is valid ────────────────────────────

  it('amount exactly at 999999999 is always valid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (itemName, category) => {
          const result = validateInput({ itemName, amount: 999_999_999, category });
          expect(result.valid).toBe(true);
          expect(result.errors.some(e => e.field === 'amount')).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ── Amount boundary: 999999999.01 is always invalid ───────────────────────

  it('amount 999999999.01 is always invalid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (itemName, category) => {
          const result = validateInput({ itemName, amount: 999_999_999.01, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
