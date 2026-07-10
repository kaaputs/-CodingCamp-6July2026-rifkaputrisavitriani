// js/app.js — Expense and Budget Visualizer

// ─── Storage API ─────────────────────────────────────────────────────────────

/** Key used to store the transaction list in Local Storage. */
const STORAGE_KEY = 'expenseTracker_transactions';

/**
 * Reads the transaction list from Local Storage and parses it as JSON.
 *
 * Returns the parsed Transaction array on success, or `null` if:
 *   - Local Storage is unavailable (SecurityError in private browsing)
 *   - The stored value cannot be parsed as valid JSON (corrupted data)
 *
 * @returns {Transaction[] | null}
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Key doesn't exist yet — no stored data, treat as empty (not an error)
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    // JSON.parse failure (SyntaxError) or storage unavailable (SecurityError)
    return null;
  }
}

/**
 * Serialises the transaction list and writes it to Local Storage.
 *
 * @param {Transaction[]} transactions - The current transaction array to persist.
 * @returns {{ success: boolean, error?: string }}
 *   Returns `{ success: true }` on a successful write.
 *   Returns `{ success: false, error: 'quota' }` when the storage quota is exceeded.
 */
function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return { success: true };
  } catch (e) {
    // QuotaExceededError (DOMException) is thrown when the storage is full.
    // Also catches SecurityError in environments where storage is restricted.
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||  // Firefox legacy name
        e.code === 22 ||                             // Legacy numeric code
        e.code === 1014)                             // Firefox legacy code
    ) {
      return { success: false, error: 'quota' };
    }
    // Re-throw any unexpected error to avoid silently swallowing bugs,
    // but return a generic failure so the caller stays stable.
    return { success: false, error: 'unknown' };
  }
}

// ─── Data Models ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID (crypto.randomUUID() or a timestamp fallback)
 * @property {string}  itemName  - Descriptive label, 1–100 characters
 * @property {number}  amount    - Positive number, max 2 decimal places, ≤ 999999999
 * @property {string}  category  - One of "Food" | "Transport" | "Fun"
 * @property {number}  createdAt - Unix timestamp (Date.now()) for sort order
 */

/**
 * The single source of truth for all runtime data.
 * @type {{ transactions: Transaction[], categories: string[], sort: { key: string, direction: string }, theme: string }}
 */
const appState = {
  transactions: [],
  categories: [],
  sort: { key: 'date', direction: 'desc' },
  theme: 'light',
};

// ─── Validator ────────────────────────────────────────────────────────────────

/** Valid category values. */
const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

/** Pool of colors for custom categories (appended after built-ins). */
const CUSTOM_CATEGORY_COLOR_POOL = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF',
  '#7BC8A4', '#E7805B', '#A8D8EA', '#AA96DA'
];

/** Maximum allowed transaction amount. */
const MAX_AMOUNT = 999_999_999;

/**
 * Validates a raw form input object.
 *
 * Collects ALL field errors (does not short-circuit on first failure).
 *
 * @param {{ itemName: string, amount: string|number, category: string }} input
 * @returns {{ valid: boolean, errors: { field: string, message: string }[] }}
 */
function validateInput(input) {
  const errors = [];

  // ── itemName ────────────────────────────────────────────────────────────────
  const itemName = (input.itemName ?? '');
  if (typeof itemName !== 'string' || itemName.trim().length === 0) {
    errors.push({ field: 'itemName', message: 'Item name is required.' });
  } else if (itemName.length > 100) {
    errors.push({ field: 'itemName', message: 'Item name must be 100 characters or fewer.' });
  }

  // ── amount ──────────────────────────────────────────────────────────────────
  const rawAmount = input.amount;
  const parsed = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);

  if (!isFinite(parsed) || parsed <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number.' });
  } else if (parsed > MAX_AMOUNT) {
    errors.push({ field: 'amount', message: 'Amount must not exceed 999,999,999.' });
  }

  // ── category ────────────────────────────────────────────────────────────────
  if (!appState.categories.includes(input.category)) {
    errors.push({ field: 'category', message: 'Please select a valid category.' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Formats a numeric amount as a currency string with a `$` prefix and exactly
 * two decimal places.
 *
 * @param {number} amount - The numeric amount to format.
 * @returns {string} e.g. `"$12.50"`, `"$0.00"`, `"$999999999.99"`
 */
function formatAmount(amount) {
  return '$' + amount.toFixed(2);
}

/**
 * Truncates a name to at most `maxLen` characters. If truncation occurs, an
 * ellipsis character (`…`) is appended to indicate the name was shortened.
 *
 * @param {string} name   - The original name string.
 * @param {number} maxLen - Maximum number of characters before truncation.
 * @returns {string} The original name, or `name.slice(0, maxLen) + '…'` if truncated.
 */
function truncateName(name, maxLen) {
  if (name.length <= maxLen) {
    return name;
  }
  return name.slice(0, maxLen) + '…';
}

/**
 * Computes the running total balance from an array of transactions.
 *
 * Pure function — does not read or mutate any external state.
 *
 * @param {Transaction[]} transactions - Array of transaction objects.
 * @returns {number} The arithmetic sum of all `amount` values; `0` for an empty array.
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

// ─── Balance Display Component ────────────────────────────────────────────────

/**
 * Updates the `#balance-display` element to show the current balance formatted
 * with a currency symbol and exactly two decimal places.
 *
 * @param {number} balance - The current total balance to display.
 */
function renderBalance(balance) {
  const el = document.getElementById('balance-display');
  if (el) {
    el.textContent = formatAmount(balance);
  }
}

/** Fixed color map for each spending category. */
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

/**
 * Aggregates transaction amounts by category and builds the data structure
 * required by Chart.js for a pie chart.
 *
 * Only categories that have at least one transaction appear in the output.
 *
 * @param {Transaction[]} transactions - Array of transaction objects.
 * @returns {{ labels: string[], data: number[], colors: string[] }}
 */
function computeChartData(transactions) {
  // Aggregate amounts per category, preserving insertion order
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

    // Use the fixed CATEGORY_COLORS map for built-ins; fall back to the
    // rotating custom-color pool for any category not present in the map.
    let color = CATEGORY_COLORS[category];
    if (color === undefined) {
      const index = appState.categories.indexOf(category) - 3;
      color = CUSTOM_CATEGORY_COLOR_POOL[
        ((index % CUSTOM_CATEGORY_COLOR_POOL.length) + CUSTOM_CATEGORY_COLOR_POOL.length)
        % CUSTOM_CATEGORY_COLOR_POOL.length
      ];
    }
    colors.push(color);
  }

  return { labels, data, colors };
}

// ─── Form Error Helpers ───────────────────────────────────────────────────────

/**
 * Renders an inline error message immediately after the specified field in the
 * DOM and also appends a copy to the `#form-errors` accessibility container.
 *
 * @param {string} fieldId  - The `id` of the form field that has an error.
 * @param {string} message  - The human-readable error message to display.
 */
function showFieldError(fieldId, message) {
  const span = document.createElement('span');
  span.className = 'field-error';
  span.textContent = message;

  // Insert the error span immediately after the relevant field
  const field = document.getElementById(fieldId);
  if (field) {
    field.parentNode.insertBefore(span, field.nextSibling);
  }

}

/**
 * Removes all existing `.field-error` elements from the DOM and clears the
 * `#form-errors` container's inner HTML.
 */
function clearErrors() {
  // Remove every inline error span that is currently in the DOM
  document.querySelectorAll('#transaction-form .field-error').forEach(el => el.remove());

  // Also clear the aria-live region (may already be empty after the above)
  const formErrors = document.getElementById('form-errors');
  if (formErrors) {
    formErrors.innerHTML = '';
  }
}

// ─── Form Reset ───────────────────────────────────────────────────────────────

/**
 * Resets all form input fields to their default/empty state and clears any
 * displayed validation errors.
 */
function clearForm() {
  const itemNameEl = document.getElementById('item-name');
  if (itemNameEl) itemNameEl.value = '';

  const amountEl = document.getElementById('amount');
  if (amountEl) amountEl.value = '';

  // Setting value to '' resets the <select> to the placeholder option
  const categoryEl = document.getElementById('category');
  if (categoryEl) categoryEl.value = '';

  clearErrors();
}

// ─── Form Submit Handler ──────────────────────────────────────────────────────

/**
 * Handles the transaction form's `submit` event.
 *
 * Flow:
 *  1. Prevent default browser submission and clear prior errors.
 *  2. Read and validate the three input values.
 *  3. Check that the new transaction would not push the balance over the limit.
 *  4. Create and push the Transaction, then persist to Local Storage.
 *  5. On quota error: undo the push and show an error.
 *  6. On success: clear the form and re-render all UI regions.
 *
 * @param {Event} event - The DOM submit event from `#transaction-form`.
 */
function handleFormSubmit(event) {
  event.preventDefault();
  clearErrors();

  // ── Read raw values from the form ─────────────────────────────────────────
  const itemName = (document.getElementById('item-name')?.value ?? '').trim();
  const amountRaw = document.getElementById('amount')?.value ?? '';
  const category = document.getElementById('category')?.value ?? '';

  // ── Validate ──────────────────────────────────────────────────────────────
  const { valid, errors } = validateInput({ itemName, amount: amountRaw, category });

  if (!valid) {
    // Map validator field names to DOM element IDs
    const fieldIdMap = {
      itemName: 'item-name',
      amount:   'amount',
      category: 'category',
    };

    for (const err of errors) {
      showFieldError(fieldIdMap[err.field] ?? err.field, err.message);
    }
    return;
  }

  // ── Balance limit guard ───────────────────────────────────────────────────
  const BALANCE_LIMIT = 999_999_999.99;
  const parsedAmount = parseFloat(amountRaw);

  if (computeBalance(appState.transactions) + parsedAmount > BALANCE_LIMIT) {
    showFieldError('amount', 'Balance limit reached. Transaction not added.');
    return;
  }

  // ── Create the new Transaction ────────────────────────────────────────────
  const id =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : Date.now().toString();

  /** @type {Transaction} */
  const transaction = {
    id,
    itemName,
    amount:    parsedAmount,
    category,
    createdAt: Date.now(),
  };

  appState.transactions.push(transaction);

  // ── Persist to Local Storage ──────────────────────────────────────────────
  const saveResult = saveToStorage(appState.transactions);

  if (saveResult.success === false && saveResult.error === 'quota') {
    // Undo the push so the in-memory state stays consistent
    appState.transactions.pop();
    showFieldError('amount', 'Storage is full. Transaction not saved.');
    return;
  }

  // ── Success path ──────────────────────────────────────────────────────────
  clearForm();

  // renderAll is defined in a later task; call it if available, otherwise skip
  if (typeof renderAll === 'function') {
    renderAll(appState.transactions);
  }
}

// ─── Transaction List Component ───────────────────────────────────────────────

/**
 * Clears and re-renders the entire transaction `<ul>` from the provided array.
 *
 * Transactions are sorted newest-first (descending `createdAt`). When the
 * array is empty the `#empty-list-message` placeholder is shown; otherwise it
 * is hidden and each transaction is rendered as an `<li>`.
 *
 * @param {Transaction[]} transactions - The current transaction array to render.
 */
function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  const emptyMsg = document.getElementById('empty-list-message');

  if (!list) return;

  // Always clear the list before re-rendering
  list.innerHTML = '';

  if (transactions.length === 0) {
    // Show the placeholder when there are no transactions
    if (emptyMsg) emptyMsg.removeAttribute('hidden');
    return;
  }

  // Hide the placeholder when there are transactions to show
  if (emptyMsg) emptyMsg.setAttribute('hidden', '');

  // Sort using the current appState.sort preference via the pure helper
  const sorted = applySortToTransactions(transactions, appState.sort);

  for (const tx of sorted) {
    const li = document.createElement('li');
    li.dataset.id = tx.id;

    // Item name — truncated at 100 characters
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = truncateName(tx.itemName, 100);

    // Amount — formatted with currency symbol and two decimal places
    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatAmount(tx.amount);

    // Category label
    const categorySpan = document.createElement('span');
    categorySpan.className = 'tx-category';
    categorySpan.textContent = tx.category;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete transaction');
    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }
}

/**
 * Handles click events on the `#transaction-list` element via event delegation.
 *
 * Only reacts when the click target has the `delete-btn` class. Reads the
 * transaction `id` from the closest ancestor with a `data-id` attribute, shows
 * a confirmation dialog, and — if confirmed — removes the transaction from
 * `appState`, persists the change, and re-renders the UI.
 *
 * @param {MouseEvent} event - The click event bubbled up from the list.
 */
function handleDeleteClick(event) {
  // Guard: only act when a delete button was clicked
  const deleteBtn = event.target.closest('.delete-btn')
  if (!deleteBtn) return;

  // Read the transaction id from the parent <li data-id="...">
  const li = event.target.closest('[data-id]');
  if (!li) return;

  const id = li.dataset.id;

  // Ask for confirmation before removing; bail out if the user cancels
  const confirmed = window.confirm('Are you sure you want to delete this transaction?');
  if (!confirmed) return;

  // Remove the matching transaction from state
  appState.transactions = appState.transactions.filter(t => t.id !== id);

  // Persist the updated list
  saveToStorage(appState.transactions);

  // Re-render all UI regions
  if (typeof renderAll === 'function') {
    renderAll(appState.transactions);
  }
}

// ─── Pie Chart Component ─────────────────────────────────────────────────────

/** Holds the single Chart.js instance created by initChart(). */
let chartInstance = null;

/**
 * Creates the Chart.js pie chart on the `#spending-chart` canvas and stores
 * the instance in `chartInstance`. Should be called once on DOMContentLoaded.
 */
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

/**
 * Updates the existing Chart.js instance with new data and hides the
 * placeholder text.
 *
 * @param {{ labels: string[], data: number[], colors: string[] }} chartData
 */
function renderChart(chartData) {
  chartInstance.data.labels = chartData.labels;
  chartInstance.data.datasets[0].data = chartData.data;
  chartInstance.data.datasets[0].backgroundColor = chartData.colors;
  chartInstance.update();

  const placeholder = document.getElementById('chart-placeholder');
  if (placeholder) placeholder.setAttribute('hidden', '');
}

/**
 * Shows the `#chart-placeholder` message and clears the chart data so an
 * empty canvas is displayed while there are no transactions.
 */
function showChartPlaceholder() {
  const placeholder = document.getElementById('chart-placeholder');
  if (placeholder) placeholder.removeAttribute('hidden');

  if (chartInstance) {
    chartInstance.data.labels = [];
    chartInstance.data.datasets[0].data = [];
    chartInstance.update();
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Re-renders all UI regions (balance, transaction list, and pie chart) from
 * the provided transactions array.
 *
 * This is the single entry-point for all state-driven UI updates. Every
 * mutation to `appState.transactions` should be followed by a call to
 * `renderAll` so all regions stay in sync.
 *
 * @param {Transaction[]} transactions - The current transaction array.
 */
function renderAll(transactions) {
  renderBalance(computeBalance(transactions));
  renderTransactionList(transactions);
  const chartData = computeChartData(transactions);
  if (chartData.labels.length === 0) {
    showChartPlaceholder();
  } else {
    renderChart(chartData);
  }
  // Keep the category management UI in sync after every state change (req 1.1, 4.1)
  if (typeof renderCategoryManagement === 'function') {
    renderCategoryManagement();
  }
}

// ─── Storage Warning Banner ───────────────────────────────────────────────────

/**
 * Renders a non-blocking warning banner at the top of `<body>` when Local
 * Storage is unavailable or its data could not be parsed.
 *
 * The banner is inserted as the very first child of `<body>` so it appears
 * above all other page content. It uses `role="alert"` so screen readers
 * announce it immediately without requiring focus.
 *
 * Calling this function more than once replaces any existing banner rather
 * than creating duplicates.
 *
 * @param {string} message - The human-readable warning text to display.
 */
function showStorageWarning(message) {
  // Remove any existing banner to avoid duplicates
  const existing = document.getElementById('storage-banner');
  if (existing) {
    existing.remove();
  }

  const banner = document.createElement('div');
  banner.id = 'storage-banner';
  banner.setAttribute('role', 'alert');
  banner.textContent = message;

  // Prepend so it appears above all other page content
  document.body.prepend(banner);
}

// ─── App Initialization ───────────────────────────────────────────────────────

/**
 * Bootstraps the application on `DOMContentLoaded`.
 *
 * Sequence:
 *  1. Load persisted transactions from Local Storage. On success assign to
 *     `appState.transactions`; on failure (null) keep the empty array and
 *     show a non-blocking warning banner.
 *  2. Initialise the Chart.js instance.
 *  3. Render the full UI from the current state.
 *  4. Wire up event listeners (form submit, transaction list click delegation).
 *
 * Requirements: 6.3, 6.4
 */
document.addEventListener('DOMContentLoaded', function () {
  // ── 1. Restore persisted data ─────────────────────────────────────────────
  const stored = loadFromStorage();

  if (Array.isArray(stored)) {
    // Successful load — populate state with persisted transactions
    appState.transactions = stored;
  } else {
    // null means a storage/parse error — start with empty list and warn user
    appState.transactions = [];
    showStorageWarning('Data could not be loaded. Starting fresh.');
  }

  // ── 2. Apply theme before any paint, then load optional-feature state ─────
  initTheme();           // req 9.3 — apply theme synchronously before first paint
  loadCategories();      // req 4.1 — restore Category_Registry, repair if needed
  loadSortPreference();  // req 7.2 — restore sort state and sync controls

  // ── 3. Initialise Chart.js ────────────────────────────────────────────────
  initChart();

  // ── 4. Render all UI regions from current state ───────────────────────────
  renderAll(appState.transactions);

  // ── 5. Attach event listeners ─────────────────────────────────────────────
  const form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const txList = document.getElementById('transaction-list');
  if (txList) {
    txList.addEventListener('click', handleDeleteClick);
  }

  // Custom Categories — add button (req 1.1)
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', handleAddCategory);
  }

  // Custom Categories — edit/delete delegation on #category-list (req 2.1, 3.1)
  const categoryList = document.getElementById('category-list');
  if (categoryList) {
    categoryList.addEventListener('click', function (event) {
      const editBtn = event.target.closest('.category-edit-btn');
      if (editBtn) {
        // Read the category name from the button's aria-label ("Edit <name>")
        const label = editBtn.getAttribute('aria-label') ?? '';
        const name = label.replace(/^Edit\s+/, '');
        handleEditCategory(name);
        return;
      }

      const deleteBtn = event.target.closest('.category-delete-btn');
      if (deleteBtn) {
        // Read the category name from the button's aria-label ("Delete <name>")
        const label = deleteBtn.getAttribute('aria-label') ?? '';
        const name = label.replace(/^Delete\s+/, '');
        handleDeleteCategory(name);
      }
    });
  }

  // Sort Transactions — key select (req 5.1)
  const sortKeySelect = document.getElementById('sort-key-select');
  if (sortKeySelect) {
    sortKeySelect.addEventListener('change', handleSortChange);
  }

  // Sort Transactions — direction toggle button (req 5.2)
  // Toggle the aria-label first so handleSortChange reads the already-updated state
  const sortDirBtn = document.getElementById('sort-direction-btn');
  if (sortDirBtn) {
    sortDirBtn.addEventListener('click', function () {
      const currentLabel = sortDirBtn.getAttribute('aria-label');
      if (currentLabel === 'Sort ascending') {
        sortDirBtn.textContent = 'Descending ↓';
        sortDirBtn.setAttribute('aria-label', 'Sort descending');
      } else {
        sortDirBtn.textContent = 'Ascending ↑';
        sortDirBtn.setAttribute('aria-label', 'Sort ascending');
      }
      handleSortChange();
    });
  }

  // Dark/Light Mode — theme toggle button (req 8.1)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', handleThemeToggle);
  }
});

// ─── Dark/Light Mode ─────────────────────────────────────────────────────────

/**
 * Applies a theme by setting `data-theme` on `<html>`, updating
 * `appState.theme`, and syncing the toggle button's label and text/icon.
 *
 * When `theme` is `"dark"`:
 *   - aria-label → "Switch to light mode"
 *   - button text → "☀ Light"
 * When `theme` is `"light"`:
 *   - aria-label → "Switch to dark mode"
 *   - button text → "🌙 Dark"
 *
 * Requirements: 8.1, 8.2, 8.3
 *
 * @param {'light'|'dark'} theme - The theme to apply.
 */
function applyTheme(theme) {
  // Apply the theme token to the root element so CSS [data-theme] rules fire
  document.documentElement.setAttribute('data-theme', theme);

  // Update runtime state
  appState.theme = theme;

  // Sync the toggle button's label and visual text/icon
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    if (theme === 'dark') {
    btn.setAttribute('aria-label', 'Switch to light mode');
    btn.innerHTML =
      '<span class="material-symbols-outlined">light_mode</span>';
    } else {
    btn.setAttribute('aria-label', 'Switch to dark mode');
    btn.innerHTML =
      '<span class="material-symbols-outlined">dark_mode</span>';
   }
 }
}

/**
 * Initialises the theme on page load (called from DOMContentLoaded, after the
 * inline `<head>` script has already set `data-theme` for the first paint).
 *
 * Logic:
 *   1. Read `localStorage.theme`.
 *   2. If the stored value is exactly `"dark"` or `"light"` → apply it.
 *   3. If the stored value is present but invalid → warn, discard, fall back
 *      to OS `prefers-color-scheme` detection WITHOUT persisting.
 *   4. If no value is stored → read OS preference and apply WITHOUT persisting.
 *
 * Requirements: 9.1, 9.3, 9.4
 */
function initTheme() {
  let stored;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {
    stored = null;
  }

  if (stored === 'dark' || stored === 'light') {
    // Valid stored preference — apply it (req 9.3)
    applyTheme(stored);
  } else {
    if (stored !== null) {
      // Value exists but is invalid — discard and warn (req 9.4)
      try {
        localStorage.removeItem('theme');
      } catch (e) {
        // ignore
      }
      showStorageWarning(
        'Stored theme preference was invalid and has been discarded. Using system preference.'
      );
    }
    // No stored value (or invalid discarded) — use OS preference, do NOT persist (req 9.1)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

/**
 * Handles a click on `#theme-toggle-btn`.
 *
 * Flips the current theme, applies it via `applyTheme()`, and persists the new
 * value to `localStorage.theme`. On quota error, calls `showStorageWarning()`.
 *
 * Requirements: 8.2, 9.2
 */
function handleThemeToggle() {
  // Flip the current theme
  const newTheme = appState.theme === 'dark' ? 'light' : 'dark';

  // Apply the new theme (updates DOM + appState)
  applyTheme(newTheme);

  // Persist to localStorage (req 9.2)
  try {
    localStorage.setItem('theme', newTheme);
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014)
    ) {
      showStorageWarning('Could not save theme preference: storage is full.');
    }
  }
}

// ─── Custom Categories ───────────────────────────────────────────────────────────

/** The three built-in category names that are always present in the registry. */
const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Reads and validates the Category_Registry from localStorage, re-injects any
 * missing built-ins, populates `appState.categories`, persists a repaired registry
 * if needed, then calls `renderCategoryManagement()` and `syncCategorySelect()`.
 *
 * Requirements: 4.1, 4.2, 4.3
 */
function loadCategories() {
  let repairNeeded = false;

  const raw = localStorage.getItem('categories');

  if (raw === null) {
    // Key doesn't exist yet — default to built-ins
    appState.categories = [...BUILTIN_CATEGORIES];
    repairNeeded = true;
  } else {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Corrupted JSON — fall back to built-ins
      appState.categories = [...BUILTIN_CATEGORIES];
      showStorageWarning('Stored categories could not be parsed. Resetting to defaults.');
      repairNeeded = true;
      parsed = null;
    }

    if (parsed !== null) {
      if (!Array.isArray(parsed)) {
        // Not an array — fall back to built-ins
        appState.categories = [...BUILTIN_CATEGORIES];
        showStorageWarning('Stored categories data was invalid. Resetting to defaults.');
        repairNeeded = true;
      } else {
        // Valid array — filter out non-string values
        let categories = parsed.filter(c => typeof c === 'string');

        // Re-inject any missing built-ins at the beginning
        const missingBuiltins = BUILTIN_CATEGORIES.filter(
          b => !categories.includes(b)
        );
        if (missingBuiltins.length > 0) {
          categories = [...missingBuiltins, ...categories];
          repairNeeded = true;
        }

        appState.categories = categories;
      }
    }
  }

  if (repairNeeded) {
    saveCategories();
  }

  renderCategoryManagement();
  syncCategorySelect();
}

/**
 * Persists `appState.categories` to localStorage under the key `'categories'`.
 * Calls `showStorageWarning()` on quota error.
 *
 * Requirements: 1.6, 2.6, 3.8
 */
function saveCategories() {
  try {
    localStorage.setItem('categories', JSON.stringify(appState.categories));
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014)
    ) {
      showStorageWarning('Could not save categories: storage is full.');
    }
  }
}

/**
 * Rebuilds the `<select id="category">` options from `appState.categories`,
 * inserting a blank placeholder at the start and preserving the currently-selected
 * value if it is still valid.
 *
 * Requirements: 1.2, 4.1
 */
function syncCategorySelect() {
  const select = document.getElementById('category');
  if (!select) return;

  const currentValue = select.value;

  // Clear all existing options
  select.innerHTML = '';

  // Blank placeholder option
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a category';
  select.appendChild(placeholder);

  // One option per category
  for (const name of appState.categories) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  // Restore selection if still valid
  if (appState.categories.includes(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = '';
  }
}

/**
 * Clears `#category-list` and re-renders one row per category.
 * Built-in categories are rendered read-only; custom categories get edit and
 * delete buttons with the correct `aria-label` attributes.
 *
 * Requirements: 2.1, 3.1
 */
function renderCategoryManagement() {
  const builtinList = document.getElementById('builtin-category-list');
  const customList = document.getElementById('category-list');

  if (!builtinList || !customList) return;

  builtinList.innerHTML = '';
  customList.innerHTML = '';

  for (const name of appState.categories) {
    const row = document.createElement('div');

    if (BUILTIN_CATEGORIES.includes(name)) {
      // Built-in — read-only row
      row.className = 'category-list-item builtin';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      row.appendChild(nameSpan);
      builtinList.appendChild(row);
    } else {
        row.className = 'category-list-item custom';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        row.appendChild(nameSpan);

       const actions = document.createElement('div');
      actions.className = 'category-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'category-edit-btn';
        editBtn.setAttribute('aria-label', `Edit ${name}`);
        editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'category-delete-btn';
        deleteBtn.setAttribute('aria-label', `Delete ${name}`);
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(actions);

        customList.appendChild(row);
     }
  }
}

/**
 * Reads `#new-category-input`, validates the value, and on success pushes it
 * into `appState.categories`, persists, and refreshes the UI.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 */
function handleAddCategory() {
  const input = document.getElementById('new-category-input');
  const trimmedName = (input ? input.value : '').trim();

  // Clear previous errors
  const errDiv = document.getElementById('new-category-input-error');
  if (errDiv) errDiv.innerHTML = '';

  // Validate — empty
  if (trimmedName.length === 0) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'Category name is required.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Validate — too long
  if (trimmedName.length > 30) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'Category name must be 30 characters or fewer.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Validate — duplicate (case-insensitive)
  if (appState.categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'A category with that name already exists.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Success — add, persist, refresh UI
  appState.categories.push(trimmedName);
  saveCategories();
  syncCategorySelect();
  renderCategoryManagement();

  // Clear the input field
  if (input) input.value = '';
}

/**
 * Prompts the user to rename `oldName`, validates the new name, updates both
 * `appState.categories` and all matching transactions, then re-renders.
 *
 * Requirements: 2.2, 2.4, 2.5, 2.6
 *
 * @param {string} oldName - The current name of the category to rename.
 */
function handleEditCategory(oldName) {
  const newName = window.prompt(`Rename "${oldName}" to:`, oldName);

  // User cancelled
  if (newName === null) return;

  const trimmedName = newName.trim();

  // Same name (case-insensitive) — no-op (req 2.5)
  if (trimmedName.toLowerCase() === oldName.toLowerCase()) return;

  const errDiv = document.getElementById('category-errors');
  if (errDiv) errDiv.innerHTML = '';

  // Validate — empty
  if (trimmedName.length === 0) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'Category name is required.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Validate — too long
  if (trimmedName.length > 30) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'Category name must be 30 characters or fewer.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Validate — duplicate (case-insensitive)
  if (appState.categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'A category with that name already exists.';
      errDiv.appendChild(span);
    }
    return;
  }

  // Update the category registry
  const idx = appState.categories.indexOf(oldName);
  if (idx !== -1) {
    appState.categories[idx] = trimmedName;
  }

  // Update all transactions that used the old name
  appState.transactions.forEach(t => {
    if (t.category === oldName) t.category = trimmedName;
  });

  saveCategories();
  saveToStorage(appState.transactions);
  syncCategorySelect();
  renderAll(appState.transactions);
}

/**
 * Handles deletion of a custom category. Guards built-ins, shows a first
 * confirmation, counts affected transactions, shows a second confirmation if
 * needed, then removes the category and its transactions and re-renders.
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 *
 * @param {string} name - The name of the category to delete.
 */
function handleDeleteCategory(name) {
  const errDiv = document.getElementById('category-errors');
  if (errDiv) errDiv.innerHTML = '';

  // Guard — built-in categories cannot be deleted (req 3.7)
  if (BUILTIN_CATEGORIES.includes(name)) {
    if (errDiv) {
      const span = document.createElement('span');
      span.className = 'field-error category-error';
      span.textContent = 'Built-in categories cannot be deleted.';
      errDiv.appendChild(span);
    }
    return;
  }

  // First confirmation (req 3.2)
  const firstConfirm = window.confirm(`Delete category "${name}"?`);
  if (!firstConfirm) return;

  // Count affected transactions
  const count = appState.transactions.filter(t => t.category === name).length;

  // Second confirmation if transactions would also be deleted (req 3.4)
  if (count > 0) {
    const secondConfirm = window.confirm(
      `This will also delete ${count} transaction(s). This cannot be undone. Confirm?`
    );
    if (!secondConfirm) return;
  }

  // Remove the category from the registry
  appState.categories = appState.categories.filter(c => c !== name);

  // Remove all transactions belonging to this category
  appState.transactions = appState.transactions.filter(t => t.category !== name);

  saveCategories();
  saveToStorage(appState.transactions);
  renderAll(appState.transactions);
}

// ─── Sort Transactions ────────────────────────────────────────────────────────

/**
 * Reads the stored sort preference from localStorage, validates it, populates
 * `appState.sort`, then calls `renderSortControls()`.
 *
 * Validation rules:
 *  - Stored value must be parseable JSON
 *  - Parsed value must be a non-null object
 *  - `key` must be one of `'date'`, `'amount'`, `'category'`
 *  - `direction` must be one of `'asc'`, `'desc'`
 *
 * On missing key (null): silent fallback to default.
 * On parse error or invalid value: fallback + `showStorageWarning()`.
 *
 * Requirements: 7.2, 7.3, 7.4
 */
function loadSortPreference() {
  const VALID_KEYS = ['date', 'amount', 'category'];
  const VALID_DIRS = ['asc', 'desc'];
  const DEFAULT_SORT = { key: 'date', direction: 'desc' };

  let raw;
  try {
    raw = localStorage.getItem('sortPreference');
  } catch (e) {
    raw = null;
  }

  if (raw === null) {
    // No stored preference — use default silently (req 7.3)
    appState.sort = { ...DEFAULT_SORT };
  } else {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Corrupted JSON — fallback and warn (req 7.4)
      appState.sort = { ...DEFAULT_SORT };
      showStorageWarning('Stored sort preference could not be parsed. Resetting to default.');
      renderSortControls();
      return;
    }

    // Validate the parsed object (req 7.4)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      VALID_KEYS.includes(parsed.key) &&
      VALID_DIRS.includes(parsed.direction)
    ) {
      appState.sort = { key: parsed.key, direction: parsed.direction };
    } else {
      // Invalid structure or enum values — fallback and warn (req 7.4)
      appState.sort = { ...DEFAULT_SORT };
      showStorageWarning('Stored sort preference was invalid. Resetting to default.');
    }
  }

  renderSortControls();
}

/**
 * Persists `appState.sort` to localStorage under the key `'sortPreference'`.
 * Calls `showStorageWarning()` on quota error.
 *
 * Requirements: 7.1
 */
function saveSortPreference() {
  try {
    localStorage.setItem('sortPreference', JSON.stringify(appState.sort));
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014)
    ) {
      showStorageWarning('Could not save sort preference: storage is full.');
    }
  }
}

/**
 * Pure sort function — returns a new sorted shallow copy of `transactions`.
 * Never mutates the input array.
 *
 * Sort key behaviour:
 *  - `'date'`     → by `createdAt` (numeric timestamp)
 *  - `'amount'`   → by `amount` (numeric)
 *  - `'category'` → by `category.toLowerCase()` (lexicographic)
 *
 * Direction: `'asc'` = ascending, `'desc'` = descending.
 *
 * Tiebreaker:
 *  1. `createdAt` descending
 *  2. original array index ascending
 *
 * Requirements: 5.3, 6.1, 6.2, 6.3, 6.4
 *
 * @param {Transaction[]} transactions - The source array (never mutated).
 * @param {{ key: string, direction: string }} sort - Active sort setting.
 * @returns {Transaction[]} A new sorted array.
 */
function applySortToTransactions(transactions, sort) {
  // Tag each entry with its original index so the tiebreaker can use it
  const indexed = transactions.map((t, i) => ({ t, i }));

  indexed.sort(({ t: a, i: ai }, { t: b, i: bi }) => {
    let primary = 0;

    if (sort.key === 'date') {
      primary = a.createdAt - b.createdAt;
    } else if (sort.key === 'amount') {
      primary = a.amount - b.amount;
    } else if (sort.key === 'category') {
      const aLow = a.category.toLowerCase();
      const bLow = b.category.toLowerCase();
      if (aLow < bLow) primary = -1;
      else if (aLow > bLow) primary = 1;
      else primary = 0;
    }

    // Flip sign for descending direction
    if (sort.direction === 'desc') {
      primary = -primary;
    }

    if (primary !== 0) return primary;

    // Tiebreaker 1: createdAt descending
    const createdDiff = b.createdAt - a.createdAt;
    if (createdDiff !== 0) return createdDiff;

    // Tiebreaker 2: original index ascending
    return ai - bi;
  });

  return indexed.map(({ t }) => t);
}

/**
 * Syncs the sort control elements to match `appState.sort`.
 *
 * - Sets `#sort-key-select` value to `appState.sort.key`
 * - Sets `#sort-direction-btn` textContent and `aria-label`:
 *     - `'asc'`  → text `'Asc'`,  aria-label `'Sort ascending'`
 *     - `'desc'` → text `'Desc'`, aria-label `'Sort descending'`
 *
 * Requirements: 5.1, 5.2, 7.2
 */
function renderSortControls() {
  const keySelect = document.getElementById('sort-key-select');
  if (keySelect) {
    keySelect.value = appState.sort.key;
  }

  const dirBtn = document.getElementById('sort-direction-btn');
  if (dirBtn) {
    if (appState.sort.direction === 'asc') {
      dirBtn.textContent = 'Ascending ↑';
      dirBtn.setAttribute('aria-label', 'Sort ascending');
    } else {
      dirBtn.textContent = 'Descending ↓';
      dirBtn.setAttribute('aria-label', 'Sort descending');
    }
  }
}

/**
 * Reads the current state of the sort controls, updates `appState.sort`,
 * persists the new preference, and re-renders the transaction list.
 *
 * The sort key is read from `#sort-key-select`.
 * The sort direction is read from `#sort-direction-btn`'s `aria-label`:
 *   - `'Sort ascending'`  → direction `'asc'`
 *   - `'Sort descending'` → direction `'desc'`
 *
 * This unified handler is called both by the select `change` event and by the
 * direction button `click` event. The direction button's event listener toggles
 * the button's aria-label BEFORE calling this function so that this handler
 * always reads the already-updated state.
 *
 * Requirements: 5.3, 5.4, 7.1
 */
function handleSortChange() {
  const keySelect = document.getElementById('sort-key-select');
  const dirBtn = document.getElementById('sort-direction-btn');

  const newKey = keySelect ? keySelect.value : appState.sort.key;

  let newDirection = appState.sort.direction;
  if (dirBtn) {
    const label = dirBtn.getAttribute('aria-label');
    if (label === 'Sort ascending') {
      newDirection = 'asc';
    } else if (label === 'Sort descending') {
      newDirection = 'desc';
    }
  }

  appState.sort = { key: newKey, direction: newDirection };

  saveSortPreference();
  renderTransactionList(appState.transactions);
}
