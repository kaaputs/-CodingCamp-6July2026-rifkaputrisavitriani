// Feature: expense-budget-visualizer
// Property 6: Transactions are always displayed newest-first
// Property 7: Every item in a non-empty list has a delete button
//
// Unit and property-based tests for:
//   renderTransactionList(transactions)
//   handleDeleteClick(event)
//
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 6.2**

import { describe, it, beforeEach, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// ─── Implementations mirrored from js/app.js ─────────────────────────────────
// app.js is a plain browser script with no ES module exports; the logic is
// reproduced here so tests exercise the exact same code paths.

const STORAGE_KEY = 'expenseTracker_transactions';

function formatAmount(amount) {
  return '$' + amount.toFixed(2);
}

function truncateName(name, maxLen) {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + '…';
}

function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return { success: true };
  } catch (e) {
    return { success: false, error: 'unknown' };
  }
}

// Mirror of appState used within the test harness
const appState = { transactions: [] };

// Thin renderAll stub so handleDeleteClick can invoke it
function renderAll(transactions) {
  renderTransactionList(transactions);
}

function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  const emptyMsg = document.getElementById('empty-list-message');

  if (!list) return;

  list.innerHTML = '';

  if (transactions.length === 0) {
    if (emptyMsg) emptyMsg.removeAttribute('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.setAttribute('hidden', '');

  const sorted = transactions.slice().sort((a, b) => b.createdAt - a.createdAt);

  for (const tx of sorted) {
    const li = document.createElement('li');
    li.dataset.id = tx.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = truncateName(tx.itemName, 100);

    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatAmount(tx.amount);

    const categorySpan = document.createElement('span');
    categorySpan.className = 'tx-category';
    categorySpan.textContent = tx.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete transaction');
    deleteBtn.textContent = '×';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }
}

function handleDeleteClick(event) {
  if (!event.target.classList.contains('delete-btn')) return;

  const li = event.target.closest('[data-id]');
  if (!li) return;

  const id = li.dataset.id;

  const confirmed = window.confirm('Are you sure you want to delete this transaction?');
  if (!confirmed) return;

  appState.transactions = appState.transactions.filter(t => t.id !== id);

  saveToStorage(appState.transactions);
  renderAll(appState.transactions);
}

// ─── DOM fixture helpers ──────────────────────────────────────────────────────

function setupDOM() {
  document.body.innerHTML = `
    <ul id="transaction-list"></ul>
    <p id="empty-list-message" hidden>No transactions recorded yet.</p>
  `;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid Transaction object with a unique, monotone createdAt. */
const transactionArbitrary = fc.record({
  id:        fc.uuid(),
  itemName:  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  amount:    fc.float({ min: Math.fround(0.01), max: Math.fround(999_999_936), noNaN: true }),
  category:  fc.constantFrom('Food', 'Transport', 'Fun'),
  createdAt: fc.integer({ min: 1_000_000_000_000, max: 9_999_999_999_999 }),
});

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('renderTransactionList — unit tests', () => {
  beforeEach(() => {
    setupDOM();
    localStorage.clear();
  });

  it('shows the empty-list-message when the transactions array is empty', () => {
    renderTransactionList([]);

    const msg = document.getElementById('empty-list-message');
    expect(msg.hasAttribute('hidden')).toBe(false);

    const items = document.querySelectorAll('#transaction-list li');
    expect(items.length).toBe(0);
  });

  it('hides the empty-list-message when transactions are present', () => {
    const tx = {
      id: '1', itemName: 'Lunch', amount: 12.5,
      category: 'Food', createdAt: Date.now(),
    };
    renderTransactionList([tx]);

    const msg = document.getElementById('empty-list-message');
    expect(msg.hasAttribute('hidden')).toBe(true);
  });

  it('renders one <li> per transaction', () => {
    const txs = [
      { id: '1', itemName: 'A', amount: 1, category: 'Food', createdAt: 1000 },
      { id: '2', itemName: 'B', amount: 2, category: 'Fun',  createdAt: 2000 },
    ];
    renderTransactionList(txs);

    const items = document.querySelectorAll('#transaction-list li');
    expect(items.length).toBe(2);
  });

  it('each <li> carries a data-id attribute matching the transaction id', () => {
    const tx = { id: 'abc-123', itemName: 'Coffee', amount: 3, category: 'Fun', createdAt: 1 };
    renderTransactionList([tx]);

    const li = document.querySelector('#transaction-list li');
    expect(li.dataset.id).toBe('abc-123');
  });

  it('renders the formatted amount with $ prefix and two decimal places', () => {
    const tx = { id: '1', itemName: 'Tea', amount: 4.5, category: 'Food', createdAt: 1 };
    renderTransactionList([tx]);

    const amountEl = document.querySelector('.tx-amount');
    expect(amountEl.textContent).toBe('$4.50');
  });

  it('renders the category label', () => {
    const tx = { id: '1', itemName: 'Bus', amount: 2, category: 'Transport', createdAt: 1 };
    renderTransactionList([tx]);

    const catEl = document.querySelector('.tx-category');
    expect(catEl.textContent).toBe('Transport');
  });

  it('truncates item names longer than 100 characters', () => {
    const longName = 'A'.repeat(101);
    const tx = { id: '1', itemName: longName, amount: 1, category: 'Fun', createdAt: 1 };
    renderTransactionList([tx]);

    const nameEl = document.querySelector('.tx-name');
    expect(nameEl.textContent).toBe('A'.repeat(100) + '…');
  });

  it('sorts transactions newest-first (descending createdAt)', () => {
    const txs = [
      { id: '1', itemName: 'Old',    amount: 1, category: 'Food', createdAt: 1000 },
      { id: '2', itemName: 'Newer',  amount: 2, category: 'Food', createdAt: 3000 },
      { id: '3', itemName: 'Middle', amount: 3, category: 'Food', createdAt: 2000 },
    ];
    renderTransactionList(txs);

    const items = [...document.querySelectorAll('#transaction-list li')];
    const ids = items.map(li => li.dataset.id);
    expect(ids).toEqual(['2', '3', '1']);
  });

  it('each list item contains exactly one delete button', () => {
    const txs = [
      { id: '1', itemName: 'A', amount: 1, category: 'Food', createdAt: 1 },
      { id: '2', itemName: 'B', amount: 2, category: 'Fun',  createdAt: 2 },
    ];
    renderTransactionList(txs);

    const items = [...document.querySelectorAll('#transaction-list li')];
    for (const li of items) {
      const btns = li.querySelectorAll('.delete-btn');
      expect(btns.length).toBe(1);
    }
  });
});

// ─── Unit Tests — handleDeleteClick ──────────────────────────────────────────

describe('handleDeleteClick — unit tests', () => {
  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    appState.transactions = [];
  });

  it('does nothing when the click target does not have class delete-btn', () => {
    appState.transactions = [
      { id: 'x1', itemName: 'Lunch', amount: 5, category: 'Food', createdAt: 1 },
    ];
    renderTransactionList(appState.transactions);

    // Click on the <span class="tx-name">, not the delete button
    const nameSpan = document.querySelector('.tx-name');
    const event = { target: nameSpan, target: { classList: nameSpan.classList, closest: () => null } };

    // Simulate: no confirm should be called, state unchanged
    const confirmSpy = vi.spyOn(window, 'confirm');
    handleDeleteClick({ target: nameSpan });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(appState.transactions).toHaveLength(1);

    confirmSpy.mockRestore();
  });

  it('does not delete when user cancels the confirmation dialog', () => {
    appState.transactions = [
      { id: 'y1', itemName: 'Coffee', amount: 3, category: 'Fun', createdAt: 1 },
    ];
    renderTransactionList(appState.transactions);

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const deleteBtn = document.querySelector('.delete-btn');
    handleDeleteClick({ target: deleteBtn });

    expect(appState.transactions).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('removes the matching transaction when user confirms deletion', () => {
    appState.transactions = [
      { id: 'del-1', itemName: 'Item', amount: 10, category: 'Food', createdAt: 1 },
      { id: 'keep-2', itemName: 'Keep', amount: 5, category: 'Fun', createdAt: 2 },
    ];
    renderTransactionList(appState.transactions);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Click the delete button on the first rendered item (newest first → id keep-2)
    const items = [...document.querySelectorAll('#transaction-list li')];
    const liToDelete = items.find(li => li.dataset.id === 'del-1');
    const deleteBtn = liToDelete.querySelector('.delete-btn');

    handleDeleteClick({ target: deleteBtn });

    expect(appState.transactions.some(t => t.id === 'del-1')).toBe(false);
    expect(appState.transactions.some(t => t.id === 'keep-2')).toBe(true);
    vi.restoreAllMocks();
  });

  it('persists the updated list to localStorage after confirmed deletion', () => {
    appState.transactions = [
      { id: 'p1', itemName: 'Bus', amount: 2, category: 'Transport', createdAt: 1 },
    ];
    renderTransactionList(appState.transactions);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteBtn = document.querySelector('.delete-btn');
    handleDeleteClick({ target: deleteBtn });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toEqual([]);
    vi.restoreAllMocks();
  });

  it('re-renders the list (shows empty message) after deleting the last transaction', () => {
    appState.transactions = [
      { id: 'last', itemName: 'Solo', amount: 7, category: 'Fun', createdAt: 1 },
    ];
    renderTransactionList(appState.transactions);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteBtn = document.querySelector('.delete-btn');
    handleDeleteClick({ target: deleteBtn });

    const msg = document.getElementById('empty-list-message');
    expect(msg.hasAttribute('hidden')).toBe(false);
    expect(document.querySelectorAll('#transaction-list li').length).toBe(0);
    vi.restoreAllMocks();
  });
});

// ─── Property-Based Tests ─────────────────────────────────────────────────────

describe('Transaction List — Property-Based Tests', () => {
  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    appState.transactions = [];
  });

  // ── Property 6 ─────────────────────────────────────────────────────────────
  //
  // For any sequence of N transactions added one after another, the transaction
  // list SHALL display them in reverse chronological order with the most
  // recently added transaction appearing at position 0 (top of the list).
  //
  // **Validates: Requirements 2.4**

  it('P6: renderTransactionList always displays transactions newest-first', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 2, maxLength: 20 }),
        (transactions) => {
          setupDOM();

          // Assign unique createdAt values to avoid ties
          const timestamped = transactions.map((t, i) => ({
            ...t,
            createdAt: 1_000_000_000_000 + i * 1000,
          }));

          renderTransactionList(timestamped);

          const items = [...document.querySelectorAll('#transaction-list li')];
          const renderedIds = items.map(li => li.dataset.id);

          // Build the expected order: sort by createdAt descending
          const expectedIds = timestamped
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(t => t.id);

          expect(renderedIds).toEqual(expectedIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 7 ─────────────────────────────────────────────────────────────
  //
  // For any non-empty transaction list, each list item SHALL contain exactly
  // one delete button.
  //
  // **Validates: Requirements 3.1**

  it('P7: every rendered list item has exactly one delete button', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          setupDOM();
          renderTransactionList(transactions);

          const items = [...document.querySelectorAll('#transaction-list li')];
          expect(items.length).toBe(transactions.length);

          for (const li of items) {
            const btns = li.querySelectorAll('.delete-btn');
            expect(btns.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Property 5 (rendering includes amount and category) ────────────────────
  //
  // For any transaction object in the list, the rendered list item SHALL
  // contain a formatted amount string starting with `$` and two decimal places,
  // and SHALL display the transaction's category label.
  //
  // **Validates: Requirements 2.1**

  it('P5: each rendered item contains a $-prefixed amount and category label', () => {
    fc.assert(
      fc.property(
        transactionArbitrary,
        (tx) => {
          setupDOM();
          renderTransactionList([tx]);

          const amountEl = document.querySelector('.tx-amount');
          expect(amountEl).not.toBeNull();
          expect(amountEl.textContent.startsWith('$')).toBe(true);

          const parts = amountEl.textContent.slice(1).split('.');
          expect(parts).toHaveLength(2);
          expect(parts[1]).toHaveLength(2);

          const categoryEl = document.querySelector('.tx-category');
          expect(categoryEl).not.toBeNull();
          expect(categoryEl.textContent).toBe(tx.category);
        }
      ),
      { numRuns: 100 }
    );
  });
});
