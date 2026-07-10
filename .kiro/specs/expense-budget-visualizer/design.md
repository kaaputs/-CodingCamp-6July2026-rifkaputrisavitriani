# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a single-page, client-side web application built with plain HTML, CSS, and Vanilla JavaScript. It allows users to record expense transactions (name, amount, category), view a running total balance, browse a scrollable history list, and visualize spending distribution through a live pie chart. All data is persisted in the browser's Local Storage — no server, no build step, and no framework required.

The app must run in any modern browser (Chrome, Firefox, Edge, Safari) by simply opening `index.html` from the local file system.

---

## Architecture

The application follows a simple **Model-View-Controller (MVC)-inspired** pattern implemented entirely inside a single `js/app.js` file. There is no module bundler; the architecture relies on a single global application state object and a set of pure utility functions that manipulate it.

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │  Form Panel  │  │ Transaction List │  │ Pie Chart  │  │
│  └──────┬───────┘  └────────┬────────┘  └─────┬──────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                             │                            │
│                   ┌─────────▼──────────┐                 │
│                   │   js/app.js        │                 │
│                   │  ┌──────────────┐  │                 │
│                   │  │  App State   │  │                 │
│                   │  │  (in-memory) │  │                 │
│                   │  └──────┬───────┘  │                 │
│                   │         │          │                 │
│                   │  ┌──────▼───────┐  │                 │
│                   │  │  StorageAPI  │  │                 │
│                   │  │(LocalStorage)│  │                 │
│                   │  └──────────────┘  │                 │
│                   │  ┌──────────────┐  │                 │
│                   │  │  Chart.js    │  │                 │
│                   │  │  Instance    │  │                 │
│                   │  └──────────────┘  │                 │
│                   └────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

**Data flow:**
1. User interacts with the DOM (form submit, delete button click).
2. An event handler in `app.js` validates input and updates the in-memory state array.
3. The state is persisted to Local Storage.
4. All UI sections (balance, transaction list, pie chart) are re-rendered from the updated state.

---

## Components and Interfaces

### 1. Form Component

**Responsibility:** Render and manage the transaction input form.

**DOM structure:**
```html
<form id="transaction-form">
  <input  id="item-name"  type="text"   maxlength="100" />
  <input  id="amount"     type="number" step="0.01" min="0.01" />
  <select id="category">
    <option value="">-- Select Category --</option>
    <option value="Food">Food</option>
    <option value="Transport">Transport</option>
    <option value="Fun">Fun</option>
  </select>
  <button type="submit">Add</button>
  <div id="form-errors" aria-live="polite"></div>
</form>
```

**Functions in app.js:**
- `handleFormSubmit(event)` — intercepts form submit, runs validation, calls `addTransaction`.
- `clearForm()` — resets all fields and clears error messages after a successful add.
- `showFieldError(fieldId, message)` — renders an inline error message next to the field.
- `clearErrors()` — removes all existing error messages.

---

### 2. Validator

**Responsibility:** Pure validation logic, decoupled from DOM manipulation.

**Functions:**
```js
/**
 * Validates a raw form input object.
 * @param {{ itemName: string, amount: string, category: string }} input
 * @returns {{ valid: boolean, errors: { field: string, message: string }[] }}
 */
function validateInput(input)
```

Validation rules:
- `itemName` must be a non-empty, non-whitespace-only string, max 100 characters.
- `amount` must parse to a finite positive number, ≤ 999,999,999.
- `category` must be one of `["Food", "Transport", "Fun"]`.
- The running balance after addition must not exceed 999,999,999.99.

---

### 3. Transaction List Component

**Responsibility:** Render the sorted transaction list and handle delete interactions.

**DOM structure:**
```html
<section id="transaction-list-section">
  <ul id="transaction-list"></ul>
  <p  id="empty-list-message" hidden>No transactions recorded yet.</p>
</section>
```

Each list item:
```html
<li data-id="<uuid>">
  <span class="tx-name">Lunch</span>
  <span class="tx-amount">$12.50</span>
  <span class="tx-category">Food</span>
  <button class="delete-btn" aria-label="Delete transaction">×</button>
</li>
```

**Functions:**
- `renderTransactionList(transactions)` — clears and re-renders the entire `<ul>` from the state array, sorted newest-first.
- `handleDeleteClick(event)` — reads `data-id` from the clicked button's parent `<li>`, shows confirmation dialog, calls `deleteTransaction(id)`.
- `formatAmount(amount)` — returns a string like `$12.50`, always with currency symbol and two decimal places.
- `truncateName(name, maxLen)` — returns the name truncated to `maxLen` characters with `"…"` appended if truncation occurred.

---

### 4. Balance Display Component

**Responsibility:** Show the current total balance.

**DOM structure:**
```html
<header id="balance-section">
  <h1>Total Balance</h1>
  <p id="balance-display">$0.00</p>
  <p id="balance-warning" hidden aria-live="assertive"></p>
</header>
```

**Functions:**
- `computeBalance(transactions)` — pure function, returns the sum of all `amount` values.
- `renderBalance(balance)` — updates `#balance-display` text content.

---

### 5. Pie Chart Component

**Responsibility:** Render and update the Chart.js pie chart.

**DOM structure:**
```html
<section id="chart-section">
  <canvas id="spending-chart"></canvas>
  <p id="chart-placeholder">No spending data available.</p>
</section>
```

**Functions:**
- `computeChartData(transactions)` — aggregates amounts by category, returns `{ labels, data, colors }`.
- `renderChart(chartData)` — calls `chart.data = chartData; chart.update()` on the existing Chart.js instance.
- `initChart()` — creates the Chart.js instance on `#spending-chart`.

**Category colors (fixed):**
```js
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};
```

---

### 6. Storage API

**Responsibility:** Abstract all Local Storage access behind a safe interface.

**Functions:**
```js
const STORAGE_KEY = 'expenseTracker_transactions';

function loadFromStorage()  // returns Transaction[] or null on error
function saveToStorage(transactions)  // returns { success: boolean, error?: string }
```

Both functions are wrapped in `try/catch` to handle:
- `JSON.parse` failures (corrupted data).
- `QuotaExceededError` (storage full).
- `SecurityError` (storage unavailable, e.g., private browsing in some browsers).

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID (crypto.randomUUID() or a timestamp fallback)
 * @property {string}  itemName  - Descriptive label, 1–100 characters
 * @property {number}  amount    - Positive number, max 2 decimal places, ≤ 999999999
 * @property {string}  category  - One of "Food" | "Transport" | "Fun"
 * @property {number}  createdAt - Unix timestamp (Date.now()) for sort order
 */
```

### App State

```js
/**
 * The single source of truth for all runtime data.
 * @type {{ transactions: Transaction[] }}
 */
const appState = {
  transactions: [],
};
```

### Local Storage Schema

Key: `expenseTracker_transactions`  
Value: JSON-serialized `Transaction[]`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "itemName": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1720000000000
  }
]
```

### Chart Data Object

```js
/**
 * @typedef {Object} ChartData
 * @property {string[]} labels  - Category names with at least one transaction
 * @property {number[]} data    - Sum of amounts per category (same order as labels)
 * @property {string[]} colors  - Hex color per category (same order as labels)
 */
```

---

## Event Flow and State Management

All state mutations follow a single, predictable pattern:

```
User Action
    │
    ▼
Event Handler (validate input)
    │
    ▼
Mutate appState.transactions
    │
    ├──► saveToStorage(appState.transactions)
    │
    └──► renderAll(appState.transactions)
              │
              ├──► renderBalance(computeBalance(transactions))
              ├──► renderTransactionList(transactions)
              └──► renderChart(computeChartData(transactions))
```

**Key function:**
```js
function renderAll(transactions) {
  renderBalance(computeBalance(transactions));
  renderTransactionList(transactions);
  const chartData = computeChartData(transactions);
  if (chartData.labels.length === 0) {
    showChartPlaceholder();
  } else {
    renderChart(chartData);
  }
}
```

There is no partial update — every mutation triggers a full re-render of all three UI regions. This keeps the logic simple and avoids state drift between components.

**Initialization sequence (on `DOMContentLoaded`):**
1. Call `loadFromStorage()` → populate `appState.transactions`.
2. If load fails, show non-blocking warning, keep `appState.transactions = []`.
3. Call `initChart()` to create the Chart.js instance.
4. Call `renderAll(appState.transactions)`.
5. Attach event listeners (form submit, transaction list click delegation).

---

## Chart.js Integration

Chart.js is loaded from a CDN in `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

The chart instance is created once on startup and updated in place (no destroy/re-create):

```js
let chartInstance = null;

function initChart() {
  const ctx = document.getElementById('spending-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: $${ctx.parsed.toFixed(2)}` } },
      },
    },
  });
}

function renderChart(chartData) {
  chartInstance.data.labels = chartData.labels;
  chartInstance.data.datasets[0].data = chartData.data;
  chartInstance.data.datasets[0].backgroundColor = chartData.colors;
  chartInstance.update();
}
```

**Rationale for update-in-place:** Destroying and recreating the chart on every state change causes a visible flicker and loses animation continuity. Chart.js `update()` applies smooth transitions automatically.

---

## Responsive Layout Strategy

The layout uses **CSS Grid** at the page level with a **Flexbox** fallback for inner components.

### Mobile-first layout (< 768px)

```css
.app-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas:
    "balance"
    "form"
    "list"
    "chart";
  gap: 1rem;
  padding: 1rem;
}
```

### Desktop layout (≥ 768px)

```css
@media (min-width: 768px) {
  .app-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "balance  balance"
      "form     list"
      "chart    chart";
  }
}
```

The transaction list section uses `overflow-y: auto` with a fixed `max-height` (e.g., `400px`) to enable vertical scrolling independent of the page.

**Breakpoints summary:**

| Viewport | Layout |
|---|---|
| 320px – 767px | Single column, stacked vertically |
| 768px – 1919px | Two-column grid, form + list side by side, chart below |
| ≥ 1920px | Centered container with `max-width: 1400px` |

---

## Error Handling

| Scenario | Detection | User-Facing Response |
|---|---|---|
| Empty/whitespace item name | `validateInput()` | Inline error below `#item-name` |
| Non-positive or non-numeric amount | `validateInput()` | Inline error below `#amount` |
| Amount > 999,999,999 | `validateInput()` | Inline error below `#amount` |
| Balance would exceed $999,999,999.99 | `validateInput()` + current balance check | Inline error in form |
| Local Storage unavailable | `try/catch` in `loadFromStorage` | Non-blocking banner at top of page |
| Corrupted Local Storage data (JSON parse error) | `try/catch` in `loadFromStorage` | Same non-blocking banner, app starts empty |
| Local Storage quota exceeded | Catch `QuotaExceededError` in `saveToStorage` | Error message in form, transaction not added |

All error messages are rendered in `aria-live` regions to support screen readers. Errors are cleared when the user starts editing the relevant field again.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transactions are always added to the list

*For any* valid transaction (non-empty item name, positive amount ≤ 999,999,999, valid category), submitting it through the add flow SHALL result in the transaction appearing in the transaction list.

**Validates: Requirements 1.3**

---

### Property 2: Invalid item names are always rejected

*For any* string composed entirely of whitespace characters (including the empty string), attempting to add it as an item name SHALL be rejected without modifying the transaction list.

**Validates: Requirements 1.4**

---

### Property 3: Invalid amounts are always rejected

*For any* value that is not a finite positive number (including 0, negative numbers, and NaN), submitting it as an amount SHALL be rejected without modifying the transaction list.

**Validates: Requirements 1.5**

---

### Property 4: Form is cleared after every successful add

*For any* valid transaction successfully added, all form input fields SHALL be empty and the category select SHALL be reset to its placeholder state immediately after the add.

**Validates: Requirements 1.7**

---

### Property 5: Transaction rendering always includes amount, currency symbol, and category

*For any* transaction object in the list, the rendered list item SHALL contain a formatted amount string starting with `$`, showing exactly two decimal places, and SHALL display the transaction's category label.

**Validates: Requirements 2.1**

---

### Property 6: Transactions are always displayed newest-first

*For any* sequence of N transactions added one after another, the transaction list SHALL display them in reverse chronological order with the most recently added transaction appearing at position 0 (top of the list).

**Validates: Requirements 2.4**

---

### Property 7: Every item in a non-empty list has a delete button

*For any* non-empty transaction list, each list item SHALL contain exactly one delete button.

**Validates: Requirements 3.1**

---

### Property 8: Confirmed deletion removes the transaction and updates balance

*For any* transaction present in the list, confirming its deletion SHALL result in: (a) the transaction no longer appearing in the list, and (b) the displayed balance equaling the sum of all remaining transaction amounts.

**Validates: Requirements 3.3, 3.5**

---

### Property 9: Balance always equals the sum of all transaction amounts

*For any* state of the transaction list (after any sequence of adds and deletes), the displayed balance SHALL equal the arithmetic sum of the `amount` field of all transactions currently in the list.

**Validates: Requirements 4.2, 4.3**

---

### Property 10: Balance is always formatted with currency symbol and two decimal places

*For any* numeric balance value in the range [0, 999999999.99], the formatted balance string SHALL start with `$` and contain exactly two digits after the decimal point.

**Validates: Requirements 4.4**

---

### Property 11: Pie chart data proportions match per-category spending

*For any* non-empty transaction list, the data values passed to the pie chart SHALL equal the sum of amounts for each category, and each category's proportion of the total SHALL match its share of the total spending.

**Validates: Requirements 5.1**

---

### Property 12: Category colors are always distinct

*For any* set of categories rendered in the pie chart, no two categories SHALL share the same color value.

**Validates: Requirements 5.4**

---

### Property 13: Added transactions are persisted to Local Storage

*For any* transaction successfully added, immediately after the add operation, reading the transaction list from Local Storage SHALL produce a list containing that transaction.

**Validates: Requirements 6.1**

---

### Property 14: Deleted transactions are removed from Local Storage

*For any* transaction successfully deleted, immediately after the delete operation, reading the transaction list from Local Storage SHALL produce a list that does not contain that transaction.

**Validates: Requirements 6.2**

---

### Property 15: App load restores persisted transactions

*For any* set of transactions saved to Local Storage before the app initializes, after initialization completes, the transaction list, balance, and chart SHALL reflect the full set of stored transactions.

**Validates: Requirements 6.3**

---

## Testing Strategy

### Unit Tests (Example-Based)

Use a minimal test runner (e.g., plain `console.assert` helpers or a lightweight library like `uvu`). Focus on:

- `validateInput()` with specific valid and invalid inputs (empty name, zero amount, missing category, amount at boundary values).
- `formatAmount()` with specific amounts: `0`, `0.1`, `1`, `1000`, `999999999.99`.
- `computeBalance()` with empty array, single transaction, multiple transactions.
- `computeChartData()` with one transaction per category, multiple transactions in same category.
- `truncateName()` with strings at and above 100 characters.
- `loadFromStorage()` with mocked invalid JSON returning empty state.
- DOM state checks: empty list shows placeholder, non-empty list hides placeholder.

### Property-Based Tests

Use **[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript property-based testing library). Run each property test with a minimum of **100 iterations**.

Tag format: `// Feature: expense-budget-visualizer, Property {N}: {property_text}`

**Properties to implement as property-based tests:**

| Property | Generator | Assertion |
|---|---|---|
| P1: Valid transaction added to list | `fc.record({ itemName: fc.string({ minLength: 1 }), amount: fc.float({ min: 0.01, max: 999999999 }), category: fc.constantFrom('Food','Transport','Fun') })` | List contains the added transaction |
| P2: Whitespace names rejected | `fc.string().filter(s => s.trim() === '')` | List unchanged, error displayed |
| P3: Invalid amounts rejected | `fc.oneof(fc.constant(0), fc.float({ max: 0 }), fc.constant(NaN))` | List unchanged, error displayed |
| P4: Form cleared after add | Same as P1 | All form fields empty after successful add |
| P5: Rendering includes amount and category | `fc.record({ amount: fc.float({ min: 0.01 }), category: fc.constantFrom(...) })` | Rendered HTML contains `$X.XX` and category name |
| P6: Newest-first sort | `fc.array(transactionArbitrary, { minLength: 2, maxLength: 20 })` | `createdAt` values are non-increasing in rendered order |
| P7: Delete buttons per item | `fc.array(transactionArbitrary, { minLength: 1, maxLength: 20 })` | `deleteButtons.length === transactions.length` |
| P8: Deletion removes and updates balance | `fc.array(transactionArbitrary, { minLength: 1 })` with random index | Deleted item absent; balance equals sum of rest |
| P9: Balance equals sum | `fc.array(fc.float({ min: 0.01, max: 999999999 }))` | `displayedBalance === transactions.reduce((s, t) => s + t.amount, 0)` |
| P10: Balance format | `fc.float({ min: 0, max: 999999999.99 })` | `formatted.startsWith('$')` and has exactly two decimal places |
| P11: Chart data proportions | `fc.array(transactionArbitrary, { minLength: 1 })` | Per-category sums match chart dataset values |
| P12: Distinct category colors | All valid categories | All values in `CATEGORY_COLORS` are unique strings |
| P13: Persistence after add | Same as P1 | `JSON.parse(localStorage.getItem(STORAGE_KEY))` contains added transaction |
| P14: Persistence after delete | `fc.array(transactionArbitrary, { minLength: 1 })` | LocalStorage list excludes deleted transaction |
| P15: Load restores state | Seed LocalStorage with arbitrary transactions | After `initApp()`, displayed list matches seeded data |

### Integration / Smoke Tests

- Open `index.html` in each target browser (Chrome, Firefox, Edge, Safari) and verify:
  - App renders without console errors.
  - Transactions survive a page reload.
  - Layout renders correctly at 320px, 768px, and 1280px viewport widths.
  - Chart updates after add and delete.
