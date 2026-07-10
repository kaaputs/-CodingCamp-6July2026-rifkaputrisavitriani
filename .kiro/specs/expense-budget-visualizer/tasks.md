# Implementation Plan: Expense and Budget Visualizer

## Overview

Build a single-page, client-side web application using plain HTML, CSS, and Vanilla JavaScript. The app records expense transactions, displays a running total balance, renders a scrollable transaction history, and visualizes spending distribution via a live Chart.js pie chart. All data persists in the browser's Local Storage. No build step, no framework, no backend required.

---

## Tasks

- [x] 1. Scaffold project file structure
  - Create `index.html` at the project root with standard HTML5 boilerplate
  - Create `css/style.css` (empty placeholder, to be filled in subsequent tasks)
  - Create `js/app.js` (empty placeholder, to be filled in subsequent tasks)
  - Link `css/style.css` via `<link rel="stylesheet">` and `js/app.js` via `<script defer>` using relative paths
  - Add Chart.js CDN script tag: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>` before `js/app.js`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Design: Architecture, Chart.js Integration_

- [x] 2. Build HTML structure
  - [x] 2.1 Add Balance section markup
    - Write `<header id="balance-section">` containing `<h1>Total Balance</h1>`, `<p id="balance-display">$0.00</p>`, and `<p id="balance-warning" hidden aria-live="assertive"></p>`
    - _Requirements: 4.1, 4.4, 4.5_
    - _Design: Balance Display Component_

  - [x] 2.2 Add Form Panel markup
    - Write `<form id="transaction-form">` with `<input id="item-name" type="text" maxlength="100">`, `<input id="amount" type="number" step="0.01" min="0.01">`, `<select id="category">` with options `-- Select Category --`, `Food`, `Transport`, `Fun`, a `<button type="submit">Add</button>`, and `<div id="form-errors" aria-live="polite"></div>`
    - _Requirements: 1.1, 1.2_
    - _Design: Form Component_

  - [x] 2.3 Add Transaction List section markup
    - Write `<section id="transaction-list-section">` containing `<ul id="transaction-list"></ul>` and `<p id="empty-list-message" hidden>No transactions recorded yet.</p>`
    - _Requirements: 2.1, 2.2, 2.3_
    - _Design: Transaction List Component_

  - [x] 2.4 Add Chart section markup
    - Write `<section id="chart-section">` containing `<canvas id="spending-chart"></canvas>` and `<p id="chart-placeholder">No spending data available.</p>`
    - _Requirements: 5.6_
    - _Design: Pie Chart Component_

  - [x] 2.5 Wrap all sections in `.app-grid` container
    - Wrap the four sections in a `<div class="app-grid">` to serve as the CSS Grid container
    - _Requirements: 7.1, 7.2, 7.3_
    - _Design: Responsive Layout Strategy_

- [x] 3. Implement CSS base styles and layout
  - [x] 3.1 Write base styles in `css/style.css`
    - Add CSS reset/normalize rules, body font, color palette, and box-sizing
    - Style `#balance-section` for prominent display at page top
    - Style the form inputs, select, button, and error container
    - Style transaction list items (flex row, truncation via `text-overflow: ellipsis`, delete button)
    - Style `#chart-section` and placeholder text
    - _Requirements: 7.1_
    - _Design: Responsive Layout Strategy_

  - [x] 3.2 Implement mobile-first CSS Grid layout
    - Define `.app-grid` with `display: grid; grid-template-columns: 1fr;` and `grid-template-areas: "balance" "form" "list" "chart";` with `gap: 1rem; padding: 1rem;`
    - Apply `grid-area` to each section
    - Set `#transaction-list-section` to `overflow-y: auto; max-height: 400px;`
    - _Requirements: 7.1, 7.2_
    - _Design: Responsive Layout Strategy — Mobile-first layout_

  - [x] 3.3 Add desktop breakpoint media query
    - Add `@media (min-width: 768px)` block setting `.app-grid` to `grid-template-columns: 1fr 1fr;` and `grid-template-areas: "balance balance" "form list" "chart chart";`
    - Add `max-width: 1400px; margin: 0 auto;` container centering for viewports ≥ 1920px
    - _Requirements: 7.2, 7.3, 7.4_
    - _Design: Responsive Layout Strategy — Desktop layout_

- [x] 4. Implement Storage API in `js/app.js`
  - [x] 4.1 Define `STORAGE_KEY` constant and `loadFromStorage()` function
    - Add `const STORAGE_KEY = 'expenseTracker_transactions';`
    - Implement `loadFromStorage()`: reads from `localStorage.getItem(STORAGE_KEY)`, parses JSON, returns the array; returns `null` inside a `try/catch` on any error (parse failure, SecurityError)
    - _Requirements: 6.3, 6.4_
    - _Design: Storage API_

  - [x] 4.2 Implement `saveToStorage(transactions)` function
    - Implement `saveToStorage(transactions)`: calls `localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))` inside `try/catch`; catches `QuotaExceededError` and returns `{ success: false, error: 'quota' }`; returns `{ success: true }` on success
    - _Requirements: 6.1, 6.2, 6.5_
    - _Design: Storage API_

- [x] 5. Define data model and app state
  - [x] 5.1 Add `Transaction` typedef and `appState` object
    - Add JSDoc `@typedef` for `Transaction` with fields: `id` (string), `itemName` (string), `amount` (number), `category` (string), `createdAt` (number)
    - Add `const appState = { transactions: [] };`
    - _Requirements: 6.3_
    - _Design: Data Models_

- [x] 6. Implement `validateInput()` function
  - [x] 6.1 Write `validateInput(input)` pure function
    - Accept `{ itemName, amount, category }` as input object
    - Check `itemName` is non-empty and non-whitespace-only, max 100 chars
    - Check `amount` parses to a finite positive number ≤ 999,999,999
    - Check `category` is one of `["Food", "Transport", "Fun"]`
    - Return `{ valid: boolean, errors: [{ field, message }] }`
    - _Requirements: 1.4, 1.5, 1.6_
    - _Design: Validator_

- [x] 7. Implement utility functions
  - [x] 7.1 Implement `formatAmount(amount)` and `truncateName(name, maxLen)`
    - `formatAmount(amount)`: returns `'$' + amount.toFixed(2)` string
    - `truncateName(name, maxLen)`: returns name unchanged if `name.length <= maxLen`; otherwise returns `name.slice(0, maxLen) + '…'`
    - _Requirements: 2.1, 4.4_
    - _Design: Transaction List Component, Balance Display Component_

  - [x] 7.3 Implement `computeBalance(transactions)` pure function
    - Sum all `amount` values in the array using `reduce`; return `0` for empty array
    - _Requirements: 4.2, 4.3, 4.5_
    - _Design: Balance Display Component_

  - [x] 7.5 Implement `computeChartData(transactions)` function
    - Aggregate `amount` values by `category`; build `labels`, `data`, and `colors` arrays using `CATEGORY_COLORS`; return `{ labels, data, colors }`
    - _Requirements: 5.1, 5.4_
    - _Design: Pie Chart Component_

- [x] 8. Implement Form component functions
  - [x] 8.1 Implement `showFieldError(fieldId, message)` and `clearErrors()`
    - `showFieldError`: create a `<span class="field-error">` element and insert it after the field identified by `fieldId`; also append to `#form-errors`
    - `clearErrors`: remove all existing `.field-error` elements and clear `#form-errors` inner HTML
    - _Requirements: 1.4, 1.5, 1.6_
    - _Design: Form Component, Error Handling_

  - [x] 8.2 Implement `clearForm()` function
    - Reset `#item-name` value to `''`, `#amount` value to `''`, `#category` value to `''` (placeholder)
    - Call `clearErrors()`
    - _Requirements: 1.7_
    - _Design: Form Component_

  - [x] 8.3 Implement `handleFormSubmit(event)` function
    - Call `event.preventDefault()` and `clearErrors()`
    - Read values from `#item-name`, `#amount`, `#category`
    - Call `validateInput({ itemName, amount, category })`; if invalid, call `showFieldError` for each error and return
    - Check balance limit: if `computeBalance(appState.transactions) + parsedAmount > 999999999.99`, show error and return
    - Create a new `Transaction` object with `id: crypto.randomUUID()` (with `Date.now().toString()` fallback), `createdAt: Date.now()`
    - Push to `appState.transactions`
    - Call `saveToStorage(appState.transactions)`; if `success === false` and `error === 'quota'`, show quota error, remove transaction, and return
    - Call `clearForm()` then `renderAll(appState.transactions)`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 4.6, 6.1, 6.5_
    - _Design: Form Component, Event Flow_

- [x] 9. Implement Transaction List component functions
  - [x] 9.1 Implement `renderTransactionList(transactions)` function
    - Sort `transactions` by `createdAt` descending (newest first)
    - Clear `#transaction-list` inner HTML
    - If empty: show `#empty-list-message`, return
    - Otherwise: hide `#empty-list-message`; for each transaction, create `<li data-id="...">` with `.tx-name` (via `truncateName`), `.tx-amount` (via `formatAmount`), `.tx-category`, and `.delete-btn` button; append to `#transaction-list`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.6_
    - _Design: Transaction List Component_

  - [x] 9.3 Implement `handleDeleteClick(event)` function
    - Use event delegation: check `event.target.classList.contains('delete-btn')`
    - Read `id` from the closest `[data-id]` element
    - Show `window.confirm` dialog; if cancelled, return
    - Remove the matching transaction from `appState.transactions`
    - Call `saveToStorage(appState.transactions)` then `renderAll(appState.transactions)`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 6.2_
    - _Design: Transaction List Component, Event Flow_

- [ ] 10. Checkpoint — Ensure core data flow is working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Balance Display component
  - [x] 11.1 Implement `renderBalance(balance)` function
    - Update `#balance-display` text content to `formatAmount(balance)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
    - _Design: Balance Display Component_

- [x] 12. Implement Pie Chart component
  - [x] 12.1 Define `CATEGORY_COLORS` constant and implement `initChart()`
    - Note: `CATEGORY_COLORS` is already defined in `js/app.js`; only `initChart()` needs to be added
    - Implement `initChart()`: get `#spending-chart` canvas context, create `new Chart(ctx, { type: 'pie', ... })` with empty data, responsive option, bottom legend, and tooltip callback formatting values as `$X.XX`; store instance in module-level `let chartInstance = null`
    - _Requirements: 5.1, 5.4, 5.5_
    - _Design: Pie Chart Component, Chart.js Integration_

  - [x] 12.2 Implement `renderChart(chartData)` and `showChartPlaceholder()`
    - `renderChart(chartData)`: assign `chartInstance.data.labels`, `chartInstance.data.datasets[0].data`, `chartInstance.data.datasets[0].backgroundColor`; call `chartInstance.update()`; hide `#chart-placeholder`
    - `showChartPlaceholder()`: show `#chart-placeholder` text; clear chart data via `chartInstance.data.labels = []; chartInstance.data.datasets[0].data = []; chartInstance.update()`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_
    - _Design: Pie Chart Component_

  - [x] 12.3 Write property test for chart data computation
    - **Property 11: Pie chart data proportions match per-category spending**
    - **Property 12: Category colors are always distinct**
    - Covered in `tests/utils.pbt.test.js`
    - **Validates: Requirements 5.1, 5.4**

- [x] 13. Implement `renderAll()` orchestration function
  - [x] 13.1 Write `renderAll(transactions)` function
    - Call `renderBalance(computeBalance(transactions))`
    - Call `renderTransactionList(transactions)`
    - Call `computeChartData(transactions)`; if `chartData.labels.length === 0` call `showChartPlaceholder()`, else call `renderChart(chartData)`
    - _Requirements: 4.2, 4.3, 5.2, 5.3_
    - _Design: Event Flow and State Management_

- [x] 14. Implement app initialization and event wiring
  - [x] 14.1 Write `DOMContentLoaded` initialization handler
    - Call `loadFromStorage()`; if result is non-null array, assign to `appState.transactions`; if null (error), show non-blocking storage warning banner
    - Call `initChart()`
    - Call `renderAll(appState.transactions)`
    - Attach `handleFormSubmit` to `#transaction-form` `submit` event
    - Attach `handleDeleteClick` to `#transaction-list` `click` event (delegation)
    - _Requirements: 6.3, 6.4_
    - _Design: Event Flow — Initialization sequence_

- [x] 15. Implement error handling UI
  - [x] 15.1 Implement storage unavailable / parse-error banner
    - Create a `showStorageWarning(message)` helper that renders a non-blocking `<div id="storage-banner" role="alert">` at the top of `<body>` with the provided message (e.g., "Data could not be loaded. Starting fresh.")
    - Call this helper from the `DOMContentLoaded` handler when `loadFromStorage()` returns `null`
    - _Requirements: 6.4_
    - _Design: Error Handling table_

  - [x] 15.2 Implement quota-exceeded error in form submit flow
    - Inside `handleFormSubmit`, when `saveToStorage` returns `{ success: false, error: 'quota' }`, call `showFieldError` (or append to `#form-errors`) with message: "Storage is full. Transaction not saved."; undo the push to `appState.transactions`
    - Implemented in `handleFormSubmit` as part of task 8.3
    - _Requirements: 6.5_
    - _Design: Error Handling table, Storage API_

  - [x] 15.3 Implement balance limit guard in form submit flow
    - Inside `handleFormSubmit`, before creating the Transaction, check if `computeBalance(appState.transactions) + parsedAmount > 999999999.99`; if so, call `showFieldError` on the amount field with message: "Balance limit reached. Transaction not added."
    - Implemented in `handleFormSubmit` as part of task 8.3
    - _Requirements: 4.6_
    - _Design: Validator, Error Handling table_

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Verify the app opens correctly in a browser by opening `index.html` directly (no server needed)
  - Confirm all automated tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Property tests use **fast-check** (`fc`) and are in the `tests/` directory
- Each property test task explicitly references a Correctness Property from `design.md`
- All storage operations are wrapped in `try/catch` — never let storage errors crash the app
- The Chart.js instance is created once and updated in-place to avoid flicker
- `renderAll()` performs a full re-render on every state change — no partial updates
- The `handleDeleteClick` uses event delegation on the `<ul>` to avoid rebinding listeners on every render
- `CATEGORY_COLORS` is already defined in `js/app.js` — task 12.1 only needs to add `initChart()`

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["4.1", "4.2", "6.1", "7.1", "7.3", "7.5"] },
    { "id": 4, "tasks": ["8.1", "8.2", "8.3", "12.3"] },
    { "id": 5, "tasks": ["9.1", "9.3", "11.1", "12.1"] },
    { "id": 6, "tasks": ["12.2", "13.1"] },
    { "id": 7, "tasks": ["14.1"] },
    { "id": 8, "tasks": ["15.1"] },
    { "id": 9, "tasks": ["16"] }
  ]
}
```
