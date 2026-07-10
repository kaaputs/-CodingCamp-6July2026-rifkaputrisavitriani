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
 * @type {{ transactions: Transaction[] }}
 */
const appState = {
  transactions: [],
};

// ─── Validator ────────────────────────────────────────────────────────────────

/** Valid category values. */
const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

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
  if (!VALID_CATEGORIES.includes(input.category)) {
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
    colors.push(CATEGORY_COLORS[category]);
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
    field.insertAdjacentElement('afterend', span);
  }

  // Also append to the aria-live region so screen readers announce the error
  const formErrors = document.getElementById('form-errors');
  if (formErrors) {
    formErrors.appendChild(span.cloneNode(true));
  }
}

/**
 * Removes all existing `.field-error` elements from the DOM and clears the
 * `#form-errors` container's inner HTML.
 */
function clearErrors() {
  // Remove every inline error span that is currently in the DOM
  document.querySelectorAll('.field-error').forEach(el => el.remove());

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

  // Sort a shallow copy newest-first; never mutate the original array
  const sorted = transactions.slice().sort((a, b) => b.createdAt - a.createdAt);

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
    deleteBtn.textContent = '×';

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
  if (!event.target.classList.contains('delete-btn')) return;

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
