# Design Document

## Feature: Expense & Budget Visualizer — Optional Features

**Spec:** expense-budget-visualizer-optional-features
**Workflow:** Requirements-First
**Features covered:** Custom Categories, Sort Transactions, Dark/Light Mode

---

## Overview

This design extends the existing Expense & Budget Visualizer MVP with three independent,
purely additive enhancements. All new code is appended to the single `js/app.js` and
`css/style.css` files. No MVP functions, DOM elements, or behaviors are removed or modified.
No new external libraries are introduced.

The three features share one architectural pattern: each owns its own localStorage key
(`categories`, `sortPreference`, `theme`) that is fully independent of the MVP's
`expenseTracker_transactions` key, preventing any risk of data corruption.

---

## Architecture

The app remains a single-page vanilla JS application with no build step. The overall
architecture does not change — `appState` remains the single runtime source of truth and
`renderAll()` remains the orchestration entry-point.

Each feature introduces a small state extension:

| Feature            | Runtime state added to `appState`      | localStorage key   |
|--------------------|----------------------------------------|--------------------|
| Custom Categories  | `appState.categories: string[]`        | `categories`       |
| Sort Transactions  | `appState.sort: { key, direction }`    | `sortPreference`   |
| Dark/Light Mode    | `appState.theme: 'light' \| 'dark'`   | `theme`            |


### Integration points with existing MVP code

- `VALID_CATEGORIES` is replaced by a reference to `appState.categories`, making the
  category list dynamic. `validateInput()` is updated to read from `appState.categories`
  instead of the hard-coded array.
- `renderTransactionList()` is extended to accept an optional sort parameter (defaulting
  to `appState.sort`) and applies sorting before rendering instead of always sorting
  by `createdAt` descending.
- `computeChartData()` is updated to fall back to a generated color for custom categories
  not present in the existing `CATEGORY_COLORS` map.
- `renderAll()` calls the new `renderCategoryManagement()` so the category management UI
  stays in sync after any state change.
- The `DOMContentLoaded` handler is extended to call the three new init functions:
  `initTheme()`, `loadCategories()`, and `loadSortPreference()`, in that order, before
  the existing `initChart()` and `renderAll()` calls.

### Execution order on page load

```
DOMContentLoaded
  → initTheme()           // apply theme before any paint (synchronous)
  → loadCategories()      // restore Category_Registry, repair if needed
  → loadSortPreference()  // restore sort state
  → initChart()           // existing
  → renderAll()           // existing, now sort-aware and category-aware
  → attachEventListeners() // existing + new listeners
```

---

## Components and Interfaces

### Feature 1: Custom Categories

#### New DOM elements (injected into `index.html` by JS, or added statically)

A `<section id="category-management">` is injected into the `.app-grid` before the
transaction form. It contains:

- `<input id="new-category-input" type="text" maxlength="30" aria-label="New category name">`
- `<button id="add-category-btn" type="button">Add Category</button>`
- `<div id="category-list">` — rendered list of all Custom_Categories, each row having:
  - A `<span>` showing the category name
  - An edit `<button class="category-edit-btn">` with `aria-label="Edit [name]"`
  - A delete `<button class="category-delete-btn">` with `aria-label="Delete [name]"`
- `<div id="category-errors" aria-live="polite">` — inline error region

Built-in categories (`Food`, `Transport`, `Fun`) are listed read-only (no edit/delete controls).

#### New JS functions

```
loadCategories()
  → reads 'categories' from localStorage
  → validates (must be array); falls back to built-ins on failure
  → ensures built-ins are present (re-injects if missing)
  → populates appState.categories
  → calls saveCategories() if repair was needed
  → calls renderCategoryManagement() and syncCategorySelect()

saveCategories()
  → writes appState.categories to localStorage under key 'categories'

renderCategoryManagement()
  → clears #category-list, re-renders one row per custom category

syncCategorySelect()
  → rebuilds <select id="category"> options from appState.categories
  → preserves any currently-selected value if still valid

handleAddCategory()
  → reads #new-category-input value, validates, pushes to appState.categories
  → calls saveCategories(), syncCategorySelect(), renderCategoryManagement()

handleEditCategory(oldName)
  → prompts for new name (inline edit UX or prompt()), validates
  → updates appState.categories, updates matching transactions
  → calls saveCategories(), saveToStorage(), syncCategorySelect(), renderAll()

handleDeleteCategory(name)
  → guards against built-in deletion
  → shows confirmation (window.confirm or inline dialog)
  → if transactions exist: shows secondary confirmation with count
  → removes category + affected transactions on confirm
  → calls saveCategories(), saveToStorage(), renderAll()
```


### Feature 2: Sort Transactions

#### New DOM elements

Injected inside `#transaction-list-section`, immediately before `<ul id="transaction-list">`:

```html
<div id="sort-controls" role="group" aria-label="Sort transactions">
  <select id="sort-key-select" aria-label="Sort by">
    <option value="date">Date</option>
    <option value="amount">Amount</option>
    <option value="category">Category</option>
  </select>
  <button id="sort-direction-btn" type="button" aria-label="Sort ascending">Asc</button>
</div>
```

#### New JS functions

```
loadSortPreference()
  → reads 'sortPreference' from localStorage
  → validates (must have valid key and direction enums)
  → falls back to { key: 'date', direction: 'desc' } on invalid/missing
  → populates appState.sort
  → calls renderSortControls()

saveSortPreference()
  → writes appState.sort to localStorage under key 'sortPreference'

renderSortControls()
  → syncs #sort-key-select value and #sort-direction-btn label/aria-label
    to appState.sort

applySortToTransactions(transactions, sort)
  → pure function; returns a sorted shallow copy of transactions
  → sort.key = 'date'     → sort by createdAt numerically
  → sort.key = 'amount'   → sort by amount numerically
  → sort.key = 'category' → sort by category lexicographically (case-insensitive)
  → direction = 'asc' / 'desc' flips the comparator
  → tiebreaker: createdAt desc, then original array index asc

handleSortChange()
  → reads current select value + button state
  → updates appState.sort
  → calls saveSortPreference(), renderTransactionList(appState.transactions)
```

`renderTransactionList()` is updated to call `applySortToTransactions()` using
`appState.sort` instead of always sorting by `createdAt desc`.

---

### Feature 3: Dark/Light Mode

#### New DOM elements

A `<button id="theme-toggle-btn" type="button">` is injected as the first child of
`<body>` (or positioned absolutely via CSS). Its `aria-label` reflects the action:
- When current theme is `light`: `"Switch to dark mode"`
- When current theme is `dark`: `"Switch to light mode"`

The button displays a text label or icon (sun/moon).

#### New JS functions

```
initTheme()
  → reads 'theme' from localStorage (synchronous, before any render)
  → if valid ('light' or 'dark'): applies it
  → if invalid: logs warning, falls back to OS detection
  → if missing: reads window.matchMedia('(prefers-color-scheme: dark)')
    → applies 'dark' or 'light' without writing to localStorage
  → calls applyTheme(theme)

applyTheme(theme)
  → sets document.documentElement.setAttribute('data-theme', theme)
  → updates appState.theme
  → updates #theme-toggle-btn aria-label and visual state

handleThemeToggle()
  → flips appState.theme ('light' → 'dark' or 'dark' → 'light')
  → calls applyTheme(appState.theme)
  → writes appState.theme to localStorage under key 'theme'
```


---

## Data Models

### Category_Registry

Stored in `localStorage` under key `categories` as a JSON array of strings.

```json
["Food", "Transport", "Fun", "Healthcare", "Gym"]
```

- Built-ins are always the first three entries (after repair/re-injection).
- Custom categories are appended in insertion order.
- Maximum name length: 30 characters.
- Names are unique within the registry (case-insensitive comparison).
- The runtime representation is `appState.categories: string[]`.

### Sort Preference

Stored in `localStorage` under key `sortPreference` as a JSON object.

```json
{ "key": "date", "direction": "desc" }
```

- `key`: `"date"` | `"amount"` | `"category"`
- `direction`: `"asc"` | `"desc"`
- Default (missing or invalid): `{ key: "date", direction: "desc" }`
- Runtime: `appState.sort: { key: string, direction: string }`

### Theme Preference

Stored in `localStorage` under key `theme` as a plain string.

```
"dark"   or   "light"
```

- Only these two string values are valid.
- On first visit (no stored value): derived from OS `prefers-color-scheme`, not persisted.
- After manual toggle: persisted, overrides OS detection for all subsequent loads.
- Runtime: `appState.theme: 'light' | 'dark'`

### Category Color Extension

`CATEGORY_COLORS` is extended at runtime with generated colors for custom categories.
A deterministic palette rotation assigns a color from a predefined pool when a new
custom category is added, so the pie chart always has a distinct color per slice.

```javascript
// Pool of colors for custom categories (appended after built-ins)
const CUSTOM_CATEGORY_COLOR_POOL = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF',
  '#7BC8A4', '#E7805B', '#A8D8EA', '#AA96DA'
];
```

Color assignment: `CUSTOM_CATEGORY_COLOR_POOL[index % CUSTOM_CATEGORY_COLOR_POOL.length]`
where `index` is the position of the custom category within `appState.categories` minus
the three built-ins.

---

## CSS Architecture

### Dark theme token block (appended to `css/style.css`)

All dark-mode colors are defined in a `[data-theme="dark"]` block that overrides the
`:root` custom properties. No existing MVP CSS rules change.

```css
[data-theme="dark"] {
  --color-bg:             #0f1117;
  --color-surface:        #1c1f26;
  --color-border:         #2e3340;
  --color-text:           #e2e8f0;
  --color-text-muted:     #94a3b8;
  --color-primary:        #6366f1;
  --color-primary-hover:  #818cf8;
  --color-danger:         #f87171;
  --color-danger-bg:      #3b1414;
  --color-success:        #4ade80;
  --color-warning-bg:     #2d2009;
  --color-warning-border: #d97706;
}
```

Because all existing MVP rules already use `var(--color-*)` custom properties,
toggling `data-theme` on `<html>` is sufficient to re-theme every section.

### New UI component styles (appended to `css/style.css`)

- `#theme-toggle-btn` — fixed/absolute position (top-right), accessible focus ring,
  transitions for smooth icon swap.
- `#category-management` — new grid area slot; flex column layout matching existing panels.
- `#sort-controls` — inline flex row above the transaction list, matching form input style.
- `.category-edit-btn`, `.category-delete-btn` — reuse `.delete-btn` pattern for sizing
  and hover states.
- `.category-error`, `#category-errors` — reuse `.field-error` pattern.
- `#category-management` dark-mode variants inherit automatically via CSS variables.

### Grid layout extension

The `.app-grid` gains a new `"categories"` area placed before the form:

```css
/* Mobile */
grid-template-areas:
  "balance"
  "categories"
  "form"
  "list"
  "chart";

/* Desktop (≥768px) */
grid-template-areas:
  "balance     balance"
  "categories  form"
  "list        list"
  "chart       chart";
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system should do.
Properties serve as the bridge between human-readable specifications and machine-verifiable
correctness guarantees.*

---

### Property 1: Valid category add grows the registry

*For any* category registry and any non-empty, non-whitespace, max-30-character category
name that does not already exist in the registry (case-insensitive), calling `handleAddCategory()`
with that name SHALL result in the registry containing exactly one more entry, the new
entry being the submitted name, and the `<select id="category">` containing a matching option.

**Validates: Requirements 1.2, 1.6**

---

### Property 2: Invalid category names are always rejected

*For any* category name that is empty, whitespace-only, longer than 30 characters, or
already present in the registry (case-insensitive), calling `handleAddCategory()` with
that name SHALL leave `appState.categories` unchanged and display an inline error message.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 3: Category add persists to localStorage

*For any* valid new category name, after `handleAddCategory()` succeeds, reading the
`categories` key from `localStorage` and parsing it SHALL produce an array that contains
the newly added name.

**Validates: Requirements 1.6**

---

### Property 4: Category management UI reflects the registry

*For any* `appState.categories` array that contains at least one custom category,
`renderCategoryManagement()` SHALL render exactly one edit control and one delete control
for each custom category, and no edit or delete controls for built-in categories.

**Validates: Requirements 2.1, 3.1**

---

### Property 5: Rename updates registry and all matching transactions

*For any* custom category `oldName` present in the registry and any valid new name
`newName` (non-empty, non-whitespace, max 30 chars, not already in registry, different
from `oldName`), calling `handleEditCategory(oldName, newName)` SHALL update
`appState.categories` to contain `newName` instead of `oldName`, and every transaction
whose `category` was `oldName` SHALL now have `category === newName`.

**Validates: Requirements 2.2, 2.6**

---

### Property 6: Same-name rename is a no-op

*For any* custom category name, calling `handleEditCategory(name, nameVariant)` where
`nameVariant` differs only in letter casing SHALL leave `appState.categories` and
`appState.transactions` identical to their pre-call state.

**Validates: Requirements 2.5**

---

### Property 7: Invalid rename leaves state unchanged

*For any* invalid new name (empty, whitespace-only, > 30 chars, or duplicate in registry),
calling `handleEditCategory(oldName, invalidName)` SHALL leave `appState.categories` and
`appState.transactions` unchanged and display an inline error.

**Validates: Requirements 2.4**

---

### Property 8: Confirmed deletion removes category and its transactions

*For any* custom category name present in the registry, after confirming deletion
(including second confirmation when transactions exist), `appState.categories` SHALL NOT
contain the deleted name and every transaction with `category === deletedName` SHALL be
absent from `appState.transactions`.

**Validates: Requirements 3.3, 3.5, 3.8**

---

### Property 9: Cancelled deletion leaves state unchanged

*For any* custom category (with or without associated transactions), cancelling at
either confirmation prompt SHALL leave `appState.categories` and `appState.transactions`
bit-for-bit identical to their pre-cancel state.

**Validates: Requirements 3.6**

---

### Property 10: Built-in categories cannot be deleted

*For any* of the three built-in category names (`"Food"`, `"Transport"`, `"Fun"`),
attempting `handleDeleteCategory(builtInName)` SHALL leave `appState.categories`
unchanged and display an inline error message.

**Validates: Requirements 3.7**

---

### Property 11: Category load round-trip restores stored registry

*For any* valid array of category names stored under `localStorage.categories`, calling
`loadCategories()` SHALL populate `appState.categories` such that all stored custom
categories appear (in their original order) and all three built-in categories are present
at the start of the array.

**Validates: Requirements 4.1**

---

### Property 12: Invalid stored registry falls back to built-ins

*For any* value stored under `localStorage.categories` that is not a valid JSON array
(including `null`, non-parsable strings, non-array types), `loadCategories()` SHALL
populate `appState.categories` with exactly the three built-in categories and call
`showStorageWarning()`.

**Validates: Requirements 4.2**

---

### Property 13: Missing built-ins are re-injected and persisted

*For any* stored category array that is missing one or more built-in categories,
`loadCategories()` SHALL produce an `appState.categories` that begins with all three
built-ins and SHALL write the corrected array back to `localStorage.categories`.

**Validates: Requirements 4.3**

---

### Property 14: Sort never mutates the transactions array

*For any* `appState.transactions` array and any sort setting `{ key, direction }`,
calling `applySortToTransactions(transactions, sort)` SHALL return a new array (not
modifying the original reference), and every transaction in the original array SHALL
still appear in `appState.transactions` unchanged after rendering.

**Validates: Requirements 5.3**

---

### Property 15: Sort produces deterministic order for all key types

*For any* array of transactions and any `{ key, direction }` combination, calling
`applySortToTransactions()` twice with identical inputs SHALL produce arrays with
identical element ordering, and:
- key `"date"`: elements are ordered by `createdAt` (asc = oldest first, desc = newest first)
- key `"amount"`: elements are ordered numerically by `amount`
- key `"category"`: elements are ordered lexicographically (case-insensitive) by `category`
- Ties are resolved by `createdAt` descending then original array index ascending.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

---

### Property 16: Sort preference persists and restores correctly

*For any* valid `{ key, direction }` sort preference, after `handleSortChange()` writes
it to localStorage, calling `loadSortPreference()` in a fresh context SHALL restore
`appState.sort` to the same `key` and `direction` values.

**Validates: Requirements 7.1, 7.2**

---

### Property 17: Invalid stored sort preference falls back to defaults

*For any* invalid value stored under `localStorage.sortPreference` (non-object, missing
fields, invalid enum values, non-parsable JSON), `loadSortPreference()` SHALL set
`appState.sort` to `{ key: 'date', direction: 'desc' }` and call `showStorageWarning()`.

**Validates: Requirements 7.4**

---

### Property 18: Theme toggle always produces the opposite theme

*For any* current value of `appState.theme` (`"light"` or `"dark"`), calling
`handleThemeToggle()` SHALL set `appState.theme` to the complementary value, update
`document.documentElement.dataset.theme` to that value, update the toggle button's
`aria-label`, and write the new value to `localStorage.theme`.

**Validates: Requirements 8.2, 9.2**

---

### Property 19: OS preference is used on first visit without persisting

*For any* OS-level color scheme preference (`"dark"` or `"light"` as reported by
`prefers-color-scheme`), when no `theme` key exists in localStorage, `initTheme()`
SHALL apply the matching theme to `document.documentElement` without writing anything
to `localStorage.theme`.

**Validates: Requirements 9.1**

---

### Property 20: Invalid stored theme falls back to OS preference

*For any* value stored under `localStorage.theme` that is not exactly `"dark"` or
`"light"`, `initTheme()` SHALL discard the stored value, apply the OS-detected theme,
call `showStorageWarning()`, and leave `localStorage.theme` absent (or remove it).

**Validates: Requirements 9.4**


---

## Error Handling

### Category validation errors

All category validation (add, edit, delete-built-in) writes inline error messages into
`#category-errors` (an `aria-live="polite"` region) using the same `.field-error` CSS
class already used by the transaction form. Errors are cleared before each new operation
attempt. No validation error throws an exception or leaves `appState` in a partial state.

### localStorage failures

All three new storage functions (`saveCategories`, `saveSortPreference`, theme persistence
in `handleThemeToggle`) wrap their `localStorage.setItem` calls in try/catch. On
`QuotaExceededError` they call `showStorageWarning()` consistent with the MVP pattern.

All three load functions (`loadCategories`, `loadSortPreference`, `initTheme`) wrap
`localStorage.getItem` + `JSON.parse` in try/catch. On any error they fall back to safe
defaults and call `showStorageWarning()`.

### Cascade delete with transactions

Before the second confirmation for deleting a category with transactions, the exact count
of affected transactions is computed from `appState.transactions`. The message reads:
`"This will also delete {n} transaction(s). This cannot be undone. Confirm?"`.

### Theme init before first paint

`initTheme()` must be called synchronously before `initChart()` and `renderAll()` to
prevent a flash of the wrong theme. Because `js/app.js` is loaded with `defer`, the
inline-script pattern (a tiny `<script>` tag in `<head>`) is used to apply the theme
token synchronously. The full `initTheme()` function in `app.js` then runs on
`DOMContentLoaded` to wire up the toggle button and sync `appState.theme`.

Specifically, `index.html` gains the following inline script in `<head>`:

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      var pref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', pref);
    }
  })();
</script>
```

This is strictly additive — it does not modify any existing `<head>` content.

---

## Testing Strategy

### Framework

The existing test setup uses **Vitest** (already present in `package.json` with
`vitest.config.js`). All new tests are added to the `tests/` directory following the
existing naming convention:

- `tests/categories.test.js` — unit and property tests for Custom Categories logic
- `tests/sort.test.js` — unit and property tests for Sort Transactions logic
- `tests/theme.test.js` — unit and property tests for Dark/Light Mode logic

Property-based tests use **fast-check** (`fc`), which is the standard PBT library for
JavaScript. It must be added as a dev dependency:

```
npm install --save-dev fast-check
```

### Unit tests

Unit tests cover:
- Specific examples for each feature (UI rendering checks, specific known inputs)
- Error path examples (built-in delete guard, form error messages)
- Integration between features (e.g., adding a category updates the select and chart)
- Default fallback values on first load

### Property-based tests

Each property in this document maps to exactly one property-based test using `fc.assert`
with a minimum of **100 iterations**. Each test is tagged with a comment in the format:

```js
// Feature: expense-budget-visualizer-optional-features, Property N: <property text>
```

**Property test outline:**

| Test file                      | Properties tested      | fast-check arbitraries used                              |
|-------------------------------|------------------------|----------------------------------------------------------|
| `categories.pbt.test.js`      | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 | `fc.string()`, `fc.array()`, `fc.constantFrom()` |
| `sort.pbt.test.js`            | 14, 15, 16, 17         | `fc.array(fc.record(...))`, `fc.constantFrom()`          |
| `theme.pbt.test.js`           | 18, 19, 20             | `fc.constantFrom('light','dark')`, `fc.string()`         |

### Dual coverage approach

Unit tests handle:
- DOM rendering checks (category management area exists, sort controls exist, theme button exists)
- Sequential UI interaction flows (add → edit → delete category)
- Dark/light visual spot-checks (computed style assertions on key elements)

Property tests handle:
- All data-layer correctness guarantees (validation, persistence round-trips, sort ordering,
  theme toggling, cascade delete)
- Edge cases generated automatically (whitespace names, tied sort values, invalid localStorage
  entries)

### Accessibility testing notes

Keyboard operability for all new controls (category management inputs, sort controls,
theme toggle) is verified by:
1. Confirming each new interactive element has a valid `tabindex` (natural DOM order) and
   visible focus ring (`focus-visible` styles).
2. Confirming `aria-label` attributes are present and correctly updated on state changes
   (verified in unit tests via `element.getAttribute('aria-label')`).
3. Confirming `aria-live` regions (`#category-errors`, `#form-errors`) are present so
   screen readers announce validation feedback.

Full WCAG compliance validation requires manual testing with assistive technologies
and expert accessibility review beyond the scope of automated tests.
