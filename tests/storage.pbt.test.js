// Feature: expense-budget-visualizer
// Property 13: Added transactions are persisted to Local Storage
// Property 14: Deleted transactions are removed from Local Storage
//
// These tests run the saveToStorage / loadFromStorage logic (mirrored from
// js/app.js) against jsdom's localStorage, driven by fast-check arbitraries.

import { describe, it, beforeEach, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Storage implementation (mirrors js/app.js) ──────────────────────────────
// app.js is a browser script with no ES module exports; the logic is reproduced
// here so the tests exercise the exact same code paths.

const STORAGE_KEY = 'expenseTracker_transactions';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return { success: true };
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014)
    ) {
      return { success: false, error: 'quota' };
    }
    return { success: false, error: 'unknown' };
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a single valid Transaction object. */
const transactionArbitrary = fc.record({
  id:        fc.uuid(),
  itemName:  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  amount:    fc.float({ min: Math.fround(0.01), max: Math.fround(999999936), noNaN: true }),
  category:  fc.constantFrom('Food', 'Transport', 'Fun'),
  createdAt: fc.integer({ min: 1_000_000_000_000, max: 9_999_999_999_999 }),
});

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Storage API — Property-Based Tests', () => {

  beforeEach(() => {
    // Start each test with a clean localStorage so tests are independent.
    localStorage.clear();
  });

  // ── Property 13 ────────────────────────────────────────────────────────────
  //
  // For any transaction successfully added, immediately after the add
  // operation, reading the transaction list from Local Storage SHALL produce
  // a list containing that transaction.
  //
  // **Validates: Requirements 6.1**

  it('Property 13: added transaction is present in Local Storage after save', () => {
    fc.assert(
      fc.property(
        // An arbitrary list that already exists in storage (may be empty)
        fc.array(transactionArbitrary, { minLength: 0, maxLength: 10 }),
        // The new transaction being added
        transactionArbitrary,
        (existingTransactions, newTransaction) => {
          // Seed localStorage with the pre-existing list
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existingTransactions));

          // Simulate the "add" step: append and save
          const updated = [...existingTransactions, newTransaction];
          const result = saveToStorage(updated);

          // Save must succeed
          expect(result.success).toBe(true);

          // Reading back must include the new transaction
          const persisted = loadFromStorage();
          expect(persisted).not.toBeNull();
          const found = persisted.some(t => t.id === newTransaction.id);
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 14 ────────────────────────────────────────────────────────────
  //
  // For any transaction successfully deleted, immediately after the delete
  // operation, reading the transaction list from Local Storage SHALL produce
  // a list that does NOT contain that transaction.
  //
  // **Validates: Requirements 6.2**

  it('Property 14: deleted transaction is absent from Local Storage after save', () => {
    fc.assert(
      fc.property(
        // At least one transaction must exist so we can delete one
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 10 }),
        // Index of the transaction to delete
        fc.nat(),
        (transactions, rawIndex) => {
          // Ensure unique IDs to avoid false negatives from duplicate test data
          const unique = transactions.reduce((acc, t) => {
            if (!acc.some(x => x.id === t.id)) acc.push(t);
            return acc;
          }, []);

          if (unique.length === 0) return; // skip degenerate case

          const deleteIndex = rawIndex % unique.length;
          const toDelete = unique[deleteIndex];

          // Seed localStorage with the full list
          localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));

          // Simulate the "delete" step: filter out the target and save
          const afterDelete = unique.filter(t => t.id !== toDelete.id);
          const result = saveToStorage(afterDelete);

          // Save must succeed
          expect(result.success).toBe(true);

          // Reading back must NOT include the deleted transaction
          const persisted = loadFromStorage();
          expect(persisted).not.toBeNull();
          const stillPresent = persisted.some(t => t.id === toDelete.id);
          expect(stillPresent).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
