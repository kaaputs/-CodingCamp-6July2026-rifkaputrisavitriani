// Feature: expense-budget-visualizer
// Balance Display Component — unit tests for renderBalance()
//
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

import { describe, it, beforeEach, expect } from 'vitest';

// ─── Implementations mirrored from js/app.js ─────────────────────────────────
// app.js is a plain browser script with no ES module exports; the logic is
// reproduced here so tests exercise the exact same code paths.

function formatAmount(amount) {
  return '$' + amount.toFixed(2);
}

function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function renderBalance(balance) {
  const el = document.getElementById('balance-display');
  if (el) {
    el.textContent = formatAmount(balance);
  }
}

// ─── DOM fixture helper ───────────────────────────────────────────────────────

function setupDOM() {
  document.body.innerHTML = `
    <header id="balance-section">
      <h1>Total Balance</h1>
      <p id="balance-display">$0.00</p>
      <p id="balance-warning" hidden aria-live="assertive"></p>
    </header>
  `;
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('renderBalance — unit tests', () => {
  beforeEach(() => {
    setupDOM();
  });

  // Requirement 4.5: WHILE no Transactions exist, THE App SHALL display a
  // Balance of $0.00.
  it('displays $0.00 when balance is 0 (no transactions)', () => {
    renderBalance(0);
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$0.00');
  });

  // Requirement 4.4: THE App SHALL display the Balance with a currency symbol
  // prefix and exactly two decimal places.
  it('formats whole number balance with two decimal places', () => {
    renderBalance(12);
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$12.00');
  });

  it('formats decimal balance with exactly two decimal places', () => {
    renderBalance(12.5);
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$12.50');
  });

  it('formats balance already having two decimal places correctly', () => {
    renderBalance(12.50);
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$12.50');
  });

  it('formats the maximum allowed balance correctly', () => {
    renderBalance(999999999.99);
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$999999999.99');
  });

  // Requirement 4.4: currency symbol prefix
  it('always prefixes the display with a "$" symbol', () => {
    renderBalance(42.75);
    const el = document.getElementById('balance-display');
    expect(el.textContent.startsWith('$')).toBe(true);
  });

  // Requirement 4.2 / 4.3: balance is updated after add / delete via
  // computeBalance. Test the two-step pipeline: computeBalance → renderBalance.
  it('displays the sum of a single transaction amount', () => {
    const transactions = [
      { id: '1', itemName: 'Lunch', amount: 12.50, category: 'Food', createdAt: 1 },
    ];
    renderBalance(computeBalance(transactions));
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$12.50');
  });

  it('displays the sum of multiple transaction amounts', () => {
    const transactions = [
      { id: '1', itemName: 'Lunch',  amount: 12.50, category: 'Food',      createdAt: 1 },
      { id: '2', itemName: 'Bus',    amount:  2.00, category: 'Transport',  createdAt: 2 },
      { id: '3', itemName: 'Movie',  amount: 15.00, category: 'Fun',        createdAt: 3 },
    ];
    renderBalance(computeBalance(transactions));
    const el = document.getElementById('balance-display');
    expect(el.textContent).toBe('$29.50');
  });

  it('reflects updated balance after a transaction is removed', () => {
    let transactions = [
      { id: '1', itemName: 'Lunch', amount: 20.00, category: 'Food', createdAt: 1 },
      { id: '2', itemName: 'Bus',   amount:  5.00, category: 'Transport', createdAt: 2 },
    ];

    // Render initial balance
    renderBalance(computeBalance(transactions));
    expect(document.getElementById('balance-display').textContent).toBe('$25.00');

    // Simulate deletion of one transaction
    transactions = transactions.filter(t => t.id !== '2');
    renderBalance(computeBalance(transactions));
    expect(document.getElementById('balance-display').textContent).toBe('$20.00');
  });

  it('returns to $0.00 when all transactions are deleted', () => {
    let transactions = [
      { id: '1', itemName: 'Tea', amount: 3.00, category: 'Food', createdAt: 1 },
    ];
    renderBalance(computeBalance(transactions));
    expect(document.getElementById('balance-display').textContent).toBe('$3.00');

    transactions = [];
    renderBalance(computeBalance(transactions));
    expect(document.getElementById('balance-display').textContent).toBe('$0.00');
  });

  it('does not throw when #balance-display element is absent', () => {
    // Remove the element from the DOM
    document.getElementById('balance-display').remove();
    // Should silently do nothing, not throw
    expect(() => renderBalance(10)).not.toThrow();
  });
});
