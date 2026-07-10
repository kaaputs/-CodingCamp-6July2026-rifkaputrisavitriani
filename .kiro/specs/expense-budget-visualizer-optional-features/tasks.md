# Implementation Plan: Expense & Budget Visualizer — Optional Features

## Overview

Three purely additive enhancements to the existing MVP: Custom Categories, Sort Transactions, and Dark/Light Mode. All new code is appended to `js/app.js` and `css/style.css`. No MVP functions, DOM elements, or behaviors are removed or modified. Each feature owns its own independent localStorage key.

Implementation order follows these dependency rules:
1. CSS dark-mode variables must exist before theme JS reads them
2. `appState` extensions and `VALID_CATEGORIES` fix must precede category handlers
3. Sort infrastructure must exist before sort UI is wired
4. HTML structural additions (sections, inline script) are done early so JS can query them

---

## Tasks

- [x] 1. Add inline theme-prevention script and HTML structural additions to `index.html`
  - Add the flash-of-wrong-theme inline `<script>` in `<head>` (before `app.js` defer tag) that reads `localStorage.theme` and sets `data-theme` on `<html>` synchronously
  - Add `<section id="category-management">` with `<input id="new-category-input">`, `<button id="add-category-btn">`, `<div id="category-list">`, and `<div id="category-errors" aria-live="polite">` inside `.app-grid` before the transaction form
  - Add `<div id="sort-controls" role="group" aria-label="Sort transactions">` with `<select id="sort-key-select">` (options: Date/Amount/Category) and `<button id="sort-direction-btn">` immediately before `<ul id="transaction-list">` inside `#transaction-list-section`
  - Add `<button id="theme-toggle-btn" type="button" aria-label="Switch to dark mode">` as first child of `<body>`
  - Update static `<select id="category">` HTML to remove the three hard-coded `<option>` values for Food/Transport/Fun (they will be rebuilt dynamically by `syncCategorySelect()`)
  - _Requirements: 1.1, 5.1, 5.2, 8.1, 9.3_

- [x] 2. Extend `appState` and fix `VALID_CATEGORIES` reference in `js/app.js`
  - Append `categories: []`, `sort: { key: 'date', direction: 'desc' }`, and `theme: 'light'` fields to the `appState` object literal
  - Append `const CUSTOM_CATEGORY_COLOR_POOL = [...]` constant with the eight colors defined in the design
  - Replace the hard-coded `VALID_CATEGORIES` array check inside `validateInput()` with a reference to `appState.categories` so validation accepts custom categories
  - _Requirements: 1.2, 1.3, 4.1_

- [x] 3. Implement Dark/Light Mode CSS and component styles in `css/style.css`
  - Append `[data-theme="dark"]` variable block overriding all thirteen `--color-*` custom properties as specified in the design
  - Append `#theme-toggle-btn` styles (fixed position top-right, accessible focus ring, z-index above grid, transition)
  - Append `#category-management` styles (grid-area: categories, flex column layout, card style matching existing panels)
  - Append `#sort-controls` styles (inline flex row, gap, matching form input height)
  - Append `.category-edit-btn` and `.category-delete-btn` styles (reuse `.delete-btn` sizing and hover pattern)
  - Append `.category-error` and `#category-errors` styles (reuse `.field-error` pattern)
  - Update `.app-grid` `grid-template-areas` for mobile (add `"categories"` row before `"form"`) and desktop breakpoint (add `"categories form"` row before `"list"`)
  - Update `#category-management { grid-area: categories; }` assignment
  - _Requirements: 8.3, 8.4, 8.5, 1.1_

- [x] 4. Implement Dark/Light Mode JS functions in `js/app.js`
  - Append `initTheme()`: reads `localStorage.theme`, validates (`"dark"`/`"light"` only), falls back to `window.matchMedia('(prefers-color-scheme: dark)')` on missing/invalid, calls `applyTheme()`
  - Append `applyTheme(theme)`: sets `document.documentElement.setAttribute('data-theme', theme)`, updates `appState.theme`, updates `#theme-toggle-btn` `aria-label` and button text/icon
  - Append `handleThemeToggle()`: flips `appState.theme`, calls `applyTheme()`, writes new value to `localStorage.theme`
  - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4_

- [x] 5. Implement Custom Categories JS functions in `js/app.js`
  - Append `loadCategories()`: reads/parses `localStorage.categories`, validates (must be array), re-injects missing built-ins, populates `appState.categories`, calls `saveCategories()` if repair was needed, then calls `renderCategoryManagement()` and `syncCategorySelect()`
  - Append `saveCategories()`: writes `appState.categories` to `localStorage` under key `'categories'` wrapped in try/catch; calls `showStorageWarning()` on quota error
  - Append `syncCategorySelect()`: rebuilds `<select id="category">` options from `appState.categories` (built-ins first, then custom), preserves currently-selected value if still valid
  - Append `renderCategoryManagement()`: clears `#category-list`, renders read-only rows for built-ins and editable rows (with edit/delete buttons, correct `aria-label` attributes) for custom categories
  - Append `handleAddCategory()`: reads `#new-category-input`, validates (non-empty, ≤30 chars, no duplicate case-insensitive), shows errors in `#category-errors`, on success pushes to `appState.categories`, calls `saveCategories()`, `syncCategorySelect()`, `renderCategoryManagement()`
  - Append `handleEditCategory(oldName)`: validates new name, updates `appState.categories` and matching transaction `.category` fields, calls `saveCategories()`, `saveToStorage()`, `syncCategorySelect()`, `renderAll()`
  - Append `handleDeleteCategory(name)`: guards built-in names (shows error in `#category-errors`), shows first `window.confirm`, counts affected transactions, shows second `window.confirm` with count if > 0, on confirm removes category and transactions, calls `saveCategories()`, `saveToStorage()`, `renderAll()`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3_

- [x] 6. Implement Sort Transactions JS functions in `js/app.js`
  - Append `loadSortPreference()`: reads/parses `localStorage.sortPreference`, validates `key` ∈ `{date, amount, category}` and `direction` ∈ `{asc, desc}`, falls back to `{ key: 'date', direction: 'desc' }` on missing/invalid, calls `showStorageWarning()` on invalid, populates `appState.sort`, calls `renderSortControls()`
  - Append `saveSortPreference()`: writes `appState.sort` to `localStorage` under key `'sortPreference'` wrapped in try/catch; calls `showStorageWarning()` on quota error
  - Append `applySortToTransactions(transactions, sort)`: pure function — returns sorted shallow copy; handles `date`/`amount`/`category` keys, `asc`/`desc` direction, tiebreaker of `createdAt` desc then original index asc
  - Append `renderSortControls()`: syncs `#sort-key-select` value and `#sort-direction-btn` text/`aria-label` to `appState.sort`
  - Append `handleSortChange()`: reads current `#sort-key-select` value and `#sort-direction-btn` state, updates `appState.sort`, calls `saveSortPreference()`, calls `renderTransactionList(appState.transactions)`
  - Update `renderTransactionList()` to call `applySortToTransactions(transactions, appState.sort)` instead of the hard-coded `createdAt` descending sort
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 7. Update `computeChartData()` for custom category colors in `js/app.js`
  - Modify `computeChartData()` to fall back to `CUSTOM_CATEGORY_COLOR_POOL` for categories not present in `CATEGORY_COLORS`, using `index % pool.length` where index is position in `appState.categories` minus 3 built-ins
  - _Requirements: 1.2 (chart stays correct after adding custom categories)_

- [x] 8. Extend `renderAll()` and update `DOMContentLoaded` handler in `js/app.js`
  - Add `renderCategoryManagement()` call inside `renderAll()` so the category management UI stays in sync after every state change
  - Update the `DOMContentLoaded` handler to call `initTheme()` → `loadCategories()` → `loadSortPreference()` (in that order) before the existing `initChart()` and `renderAll()` calls
  - Add event listeners for `#add-category-btn` (click → `handleAddCategory`), `#category-list` (click delegation for `.category-edit-btn` and `.category-delete-btn`), `#sort-key-select` (change → `handleSortChange`), `#sort-direction-btn` (click → `handleSortChange`), and `#theme-toggle-btn` (click → `handleThemeToggle`)
  - _Requirements: 1.1, 4.1, 5.1, 5.2, 7.2, 8.1, 9.3_

- [x] 9. Checkpoint — Smoke test the full integration
  - Ensure all three features work together end-to-end: add a custom category, add a transaction with it, sort by category, toggle dark mode, reload and verify all preferences restored
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write unit and property-based tests for Custom Categories
  - [ ] 10.1 Create `tests/categories.test.js` with unit tests
    - Test `renderCategoryManagement()` renders edit/delete controls only for custom categories
    - Test `handleAddCategory()` clears input on success and updates the select
    - Test `handleDeleteCategory()` with built-in name shows error without mutation
    - Test `syncCategorySelect()` preserves currently-selected value after rebuild
    - Test `loadCategories()` fallback and repair paths with known inputs
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.7, 4.2, 4.3_

- [ ] 11. Write unit and property-based tests for Sort Transactions
  - [ ] 11.1 Create `tests/sort.test.js` with unit tests
    - Test `applySortToTransactions()` with known fixture arrays for each key and direction
    - Test `renderSortControls()` syncs select value and button label from `appState.sort`
    - Test `loadSortPreference()` default fallback with no stored value
    - Test that `renderTransactionList()` now uses `appState.sort` (not always `createdAt desc`)
    - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.3_


- [ ] 12. Write unit and property-based tests for Dark/Light Mode
  - [ ] 12.1 Create `tests/theme.test.js` with unit tests
    - Test `applyTheme('dark')` sets `document.documentElement.dataset.theme === 'dark'` and updates `#theme-toggle-btn` aria-label
    - Test `applyTheme('light')` restores light scheme
    - Test `initTheme()` with no stored value reads `matchMedia` and does not write to localStorage
    - Test `initTheme()` with stored `"dark"` applies dark theme
    - Test `handleThemeToggle()` toggles from light→dark and persists to localStorage
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

- [x] 13. Install fast-check dev dependency
  - Run `npm install --save-dev fast-check` to add the PBT library required by `*.pbt.test.js` files
  - Verify it appears in `package.json` devDependencies and that existing tests still pass with `vitest --run`
  - _Requirements: (testing infrastructure)_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run` and confirm all tests in `tests/categories.test.js`, `tests/sort.test.js`, `tests/theme.test.js`, and optionally the PBT test files pass with zero failures
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- The inline `<script>` in task 1 is the only modification to `index.html` that touches the `<head>`; everything else in HTML is new additive content
- `renderTransactionList()` modification in task 6 is the only change to an existing MVP function body — it replaces a 2-line inline sort with a call to the new `applySortToTransactions()` helper, preserving identical behavior for the default `{ key: 'date', direction: 'desc' }` case
- All `localStorage` read/write operations are wrapped in try/catch following the existing MVP pattern
- Property tests use a minimum of 100 iterations per `fc.assert` call, tagged with `// Feature: expense-budget-visualizer-optional-features, Property N: <text>`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["4.1", "5.1", "6.1", "7.1"] },
    { "id": 3, "tasks": ["8.1"] },
    { "id": 4, "tasks": ["10.1", "10.2", "11.1", "11.2", "12.1", "12.2"] },
    { "id": 5, "tasks": ["13.1"] }
  ]
}
```

> **Note on task numbering in the dependency graph**: the tasks above use a single decimal level for sub-tasks (e.g., `10.1`, `10.2`) but tasks 1–9, 13, and 14 are top-level and not included in the graph per the rules. The graph lists the leaf sub-tasks only. Top-level tasks 1–8 are represented as a single sequential group since most depend on the prior; the graph above condenses them into waves by independence.
