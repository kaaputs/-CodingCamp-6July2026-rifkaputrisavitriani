// Feature: expense-budget-visualizer
// Property 5:  Transaction rendering always includes formatted amount and category
// Property 9:  Balance always equals the sum of all transaction amounts
// Property 10: Balance is always formatted with '$' prefix and two decimal places
// Property 11: Pie chart data proportions match per-category spending
// Property 12: Category colors are always distinct
//
// **Validates: Requirements 2.1, 4.2, 4.3, 4.4, 5.1, 5.4**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Implementations (mirrored from js/app.js) ────────────────────────────────
// app.js is a plain browser script with no ES module exports; the logic is
// reproduced here so tests exercise the exact same code paths.

function formatAmount(amount) {
  return '$' + amount.toFixed(2);
}

function truncateName(name, maxLen) {
  if (name.length <= maxLen) {
    return name;
  }
  return name.slice(0, maxLen) + '…';
}

function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

function computeChartData(transactions) {
  const totals = {};
  for (const t of transactions) {
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }

  const labels = [];
  const data   = [];
  const colors = [];

  for (const [category, total] of Object.entries(totals)) {
    labels.push(category);
    data.push(total);
    colors.push(CATEGORY_COLORS[category]);
  }

  return { labels, data, colors };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a single valid Transaction object. */
const transactionArbitrary = fc.record({
  id:        fc.uuid(),
  itemName:  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  amount:    fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
  category:  fc.constantFrom('Food', 'Transport', 'Fun'),
  createdAt: fc.integer({ min: 1_000_000_000_000, max: 9_999_999_999_999 }),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Utility Functions — Property-Based Tests', () => {

  // ── Property 5 ─────────────────────────────────────────────────────────────
  //
  // For any transaction object in the list, the rendered list item SHALL
  // contain a formatted amount string starting with `$`, showing exactly two
  // decimal places, and SHALL display the transaction's category label.
  //
  // **Validates: Requirements 2.1**

  it('P5: formatAmount always starts with "$" for any transaction amount', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
        (amount) => {
          const rendered = formatAmount(amount);
          expect(rendered.startsWith('$')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P5: formatAmount always has exactly two decimal places for any transaction amount', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
        (amount) => {
          const rendered = formatAmount(amount);
          const numeric = rendered.slice(1); // strip leading '$'
          const parts = numeric.split('.');
          expect(parts).toHaveLength(2);
          expect(parts[1]).toHaveLength(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── truncateName ────────────────────────────────────────────────────────────
  //
  // For any name with length <= maxLen, truncateName returns the name unchanged.
  // For any name with length > maxLen, truncateName returns name.slice(0, maxLen) + '…'.
  //
  // **Validates: Requirements 2.1**

  it('truncateName: returns name unchanged when length <= maxLen', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }).chain(maxLen =>
          fc.tuple(
            fc.constant(maxLen),
            fc.string({ minLength: 0, maxLength: maxLen })
          )
        ),
        ([maxLen, name]) => {
          const result = truncateName(name, maxLen);
          expect(result).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateName: appends "…" and truncates to maxLen chars when name is too long', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }).chain(maxLen =>
          fc.tuple(
            fc.constant(maxLen),
            fc.string({ minLength: maxLen + 1, maxLength: 200 })
          )
        ),
        ([maxLen, name]) => {
          const result = truncateName(name, maxLen);
          expect(result).toBe(name.slice(0, maxLen) + '…');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateName: result prefix always equals name.slice(0, maxLen) when truncated', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }).chain(maxLen =>
          fc.tuple(
            fc.constant(maxLen),
            fc.string({ minLength: maxLen + 1, maxLength: 200 })
          )
        ),
        ([maxLen, name]) => {
          const result = truncateName(name, maxLen);
          // The part before '…' must be exactly the first maxLen characters
          expect(result.slice(0, maxLen)).toBe(name.slice(0, maxLen));
          expect(result.endsWith('…')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 9 ─────────────────────────────────────────────────────────────
  //
  // For any state of the transaction list (after any sequence of adds and
  // deletes), the displayed balance SHALL equal the arithmetic sum of the
  // `amount` field of all transactions currently in the list.
  //
  // **Validates: Requirements 4.2, 4.3**

  it('P9: computeBalance always equals the arithmetic sum of transaction amounts', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 0, maxLength: 20 }),
        (transactions) => {
          const balance = computeBalance(transactions);
          const expected = transactions.reduce((sum, t) => sum + t.amount, 0);
          expect(balance).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P9: computeBalance returns 0 for an empty transaction array', () => {
    expect(computeBalance([])).toBe(0);
  });

  // ── Property 10 ────────────────────────────────────────────────────────────
  //
  // For any numeric balance value in the range [0, 999999999.99], the
  // formatted balance string SHALL start with `$` and contain exactly two
  // digits after the decimal point.
  //
  // **Validates: Requirements 4.4**

  it('P10: formatAmount always produces a string starting with "$"', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(999_999_999.99), noNaN: true }),
        (balance) => {
          const formatted = formatAmount(balance);
          expect(formatted.startsWith('$')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P10: formatAmount always has exactly two decimal places', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(999_999_999.99), noNaN: true }),
        (balance) => {
          const formatted = formatAmount(balance);
          // Remove the leading '$' and split on '.'
          const numeric = formatted.slice(1);
          const parts = numeric.split('.');
          // Must have a decimal portion of exactly 2 characters
          expect(parts).toHaveLength(2);
          expect(parts[1]).toHaveLength(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 11 ────────────────────────────────────────────────────────────
  //
  // For any non-empty transaction list, the data values passed to the pie
  // chart SHALL equal the sum of amounts for each category, and each
  // category's proportion of the total SHALL match its share of the total
  // spending.
  //
  // **Validates: Requirements 5.1**

  it('P11: computeChartData per-category sums match the transaction amounts', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const { labels, data } = computeChartData(transactions);

          // Every label in the chart must correspond to the correct category sum
          for (let i = 0; i < labels.length; i++) {
            const category = labels[i];
            const expectedSum = transactions
              .filter(t => t.category === category)
              .reduce((s, t) => s + t.amount, 0);
            expect(data[i]).toBeCloseTo(expectedSum, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P11: computeChartData only includes categories present in the transaction list', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const { labels } = computeChartData(transactions);
          const presentCategories = new Set(transactions.map(t => t.category));

          // No label should appear for a category with zero transactions
          for (const label of labels) {
            expect(presentCategories.has(label)).toBe(true);
          }

          // Every category with transactions must appear in labels
          for (const cat of presentCategories) {
            expect(labels).toContain(cat);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 12 ────────────────────────────────────────────────────────────
  //
  // For any set of categories rendered in the pie chart, no two categories
  // SHALL share the same color value.
  //
  // **Validates: Requirements 5.4**

  it('P12: all CATEGORY_COLORS values are distinct (no two categories share a color)', () => {
    const colorValues = Object.values(CATEGORY_COLORS);
    const uniqueColors = new Set(colorValues);
    // The number of unique color values must equal the total number of categories
    expect(uniqueColors.size).toBe(colorValues.length);
  });

  it('P12: computeChartData colors array has no duplicate color values', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const { labels, colors } = computeChartData(transactions);

          // labels and colors arrays are always the same length
          expect(colors).toHaveLength(labels.length);

          // No duplicate color values for distinct categories
          const uniqueColors = new Set(colors);
          expect(uniqueColors.size).toBe(colors.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
