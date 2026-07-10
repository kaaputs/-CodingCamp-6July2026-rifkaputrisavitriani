# Requirements Document

## Introduction

This document covers three optional enhancements to the Expense and Budget Visualizer MVP. All three features are purely additive — they extend the existing vanilla JS/HTML/CSS single-page app without modifying or removing any MVP behavior.

The features are:

1. **Custom Categories** — users can create, rename, and delete their own transaction categories beyond the three built-in defaults (Food, Transport, Fun).
2. **Sort Transactions** — users can reorder the transaction list by date added, amount, or category.
3. **Dark/Light Mode** — a theme toggle that switches the entire UI between a dark and a light color scheme.

All features share the same constraints as the MVP: no framework, no build step, single `js/app.js`, single `css/style.css`, persisted in `localStorage`.

---

## Glossary

- **App**: The Expense and Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category (as defined in the MVP requirements).
- **Transaction_List**: The scrollable on-screen list of all stored transactions.
- **Category**: A label used to classify a transaction. Includes the three built-in defaults (`Food`, `Transport`, `Fun`) and any user-defined Custom_Categories.
- **Custom_Category**: A user-defined category name that is stored alongside the built-in categories and is available for use in the transaction form.
- **Category_Registry**: The combined, ordered set of all categories available in the transaction form at any given moment (built-ins plus Custom_Categories).
- **Sort_Key**: The field used to order the Transaction_List. Valid values are `date` (createdAt), `amount`, and `category`.
- **Sort_Direction**: The order applied to a Sort_Key. Valid values are `asc` (ascending) and `desc` (descending).
- **Theme**: The active color scheme applied to the entire UI. Valid values are `light` and `dark`.
- **Theme_Toggle**: The UI control that switches the active Theme between `light` and `dark`.
- **Local_Storage**: The browser's Web Storage API used to persist data client-side.
- **Validator**: The input-validation logic that checks form fields before a transaction is saved (as defined in the MVP).
- **Pie_Chart**: The Chart.js pie chart displaying spending distribution by category.
- **Form**: The input form used to create a new transaction.

---

## Requirements

### Requirement 1: Custom Categories — Create

**User Story:** As a user, I want to add my own transaction categories so that I can track spending in areas not covered by the built-in defaults.

#### Acceptance Criteria

1. THE App SHALL render a category management area that contains a text input for a new category name and a button labelled "Add Category".
2. WHEN the user enters a non-empty, non-whitespace-only name (max 30 characters) and clicks "Add Category", THE App SHALL add the Custom_Category to the Category_Registry, clear the text input, and make the new category available as an option in the Form's category select within 500 milliseconds.
3. WHEN the user enters a category name that already exists in the Category_Registry (case-insensitive comparison) and clicks "Add Category", THE Validator SHALL display an inline error message adjacent to the text input stating that the category already exists, retain the entered text in the input, and leave the Category_Registry unchanged.
4. WHEN the user enters an empty or whitespace-only string and clicks "Add Category", THE Validator SHALL display an inline error message adjacent to the text input stating that a category name is required, without modifying the Category_Registry.
5. WHEN the user enters a name longer than 30 characters and clicks "Add Category", THE Validator SHALL display an inline error message adjacent to the text input stating the name must be 30 characters or fewer, retain the entered text in the input, and leave the Category_Registry unchanged.
6. WHEN a Custom_Category is successfully added, THE App SHALL persist the updated Category_Registry to Local_Storage within 500 milliseconds.

---

### Requirement 2: Custom Categories — Edit

**User Story:** As a user, I want to rename a custom category I created so that I can correct mistakes or update its label.

#### Acceptance Criteria

1. WHILE the Category_Registry contains at least one Custom_Category, THE App SHALL display an edit control next to each Custom_Category in the category management area.
2. WHEN the user submits a rename for a Custom_Category with a non-empty, non-whitespace-only name (max 30 characters) that does not already exist in the Category_Registry (case-insensitive) and is different from the current name, THE App SHALL update the category name in the Category_Registry, update the `category` field of all existing Transactions that used the old name to use the new name, and update the Form's category select to reflect the renamed category.
3. WHEN a rename causes Transactions to be updated, THE App SHALL re-render the Transaction_List and Pie_Chart to reflect the new category name within 1 second.
4. IF the new name is empty, whitespace-only, longer than 30 characters, or already exists in the Category_Registry, THEN THE Validator SHALL display an inline error message and leave the Category_Registry and all Transactions unchanged.
5. WHEN the user submits a rename where the new name is identical to the current name (case-insensitive), THE App SHALL treat the action as a no-op: dismiss the edit control without displaying an error and leave the Category_Registry and Transactions unchanged.
6. WHEN a Custom_Category is successfully renamed, THE App SHALL persist the updated Category_Registry and the updated Transactions to Local_Storage within 500 milliseconds.

---

### Requirement 3: Custom Categories — Delete

**User Story:** As a user, I want to delete a custom category I no longer need so that the category list stays tidy.

#### Acceptance Criteria

1. WHILE the Category_Registry contains at least one Custom_Category, THE App SHALL display a delete control next to each Custom_Category in the category management area.
2. WHEN the user clicks the delete control for a Custom_Category, THE App SHALL display a confirmation prompt that includes the name of the Custom_Category before removing it.
3. WHEN the user confirms deletion and the Custom_Category has no associated Transactions, THE App SHALL remove it from the Category_Registry within 1 second.
4. WHEN the user confirms deletion and the Custom_Category has one or more associated Transactions, THE App SHALL display a secondary warning indicating how many Transactions use that category and require an explicit second confirmation before deleting both the category and its Transactions.
5. WHEN deletion is confirmed (with or without associated Transactions), THE App SHALL update the Category_Registry, remove all affected Transactions, and re-render the Transaction_List, Balance, and Pie_Chart within 1 second.
6. WHEN the user cancels either confirmation prompt, THE App SHALL leave the Category_Registry and all Transactions unchanged.
7. IF the user attempts to delete a built-in category (`Food`, `Transport`, `Fun`), THEN THE App SHALL display an inline error message stating that built-in categories cannot be deleted, and leave the Category_Registry unchanged.
8. WHEN a Custom_Category is successfully deleted, THE App SHALL persist the updated Category_Registry and Transactions to Local_Storage within 500 milliseconds.

---

### Requirement 4: Custom Categories — Persistence and Restore

**User Story:** As a user, I want my custom categories to survive a page reload so that I do not need to recreate them each session.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL read the stored Category_Registry from Local_Storage and populate the Form's category select with all stored categories (built-ins first, then Custom_Categories in the order they were added) within 1000 milliseconds.
2. IF the stored Category_Registry is missing, cannot be parsed, or contains a non-array value, THEN THE App SHALL fall back to the three built-in categories only and display a non-blocking warning consistent with the existing MVP storage-error pattern; any Custom_Categories from the invalid data SHALL NOT be restored.
3. IF the stored Category_Registry is a valid array but is missing one or more of the built-in categories (`Food`, `Transport`, `Fun`), THEN THE App SHALL re-inject the missing built-in categories at the beginning of the Category_Registry before displaying it, and persist the corrected registry to Local_Storage.

---

### Requirement 5: Sort Transactions — Sort Controls

**User Story:** As a user, I want to sort my transaction list by different fields so that I can find or compare transactions more easily.

#### Acceptance Criteria

1. THE Transaction_List section SHALL display a sort control area containing a select or set of buttons that exposes the following Sort_Key options: "Date" (default), "Amount", and "Category".
2. THE Transaction_List section SHALL display a direction toggle (e.g., a button labelled "Asc" / "Desc" or an icon) that switches between ascending and descending Sort_Direction for the active Sort_Key.
3. WHEN the user changes the Sort_Key or Sort_Direction, THE App SHALL re-render the Transaction_List in the new order within 500 milliseconds without adding, removing, or modifying any Transaction data.
4. THE App SHALL apply the active Sort_Key and Sort_Direction consistently every time the Transaction_List is re-rendered (e.g., after an add or delete), so the list does not revert to the default sort unexpectedly.
5. WHEN Sort_Key is "Date" and Sort_Direction is "desc", THE App SHALL render transactions newest-first, preserving the existing MVP default behavior.

---

### Requirement 6: Sort Transactions — Sort Behavior Per Key

**User Story:** As a user, I want each sort option to produce a predictably ordered list so that the results match my expectations.

#### Acceptance Criteria

1. WHEN Sort_Key is "Date", THE App SHALL sort the Transaction_List by the `createdAt` field compared as a numeric timestamp (milliseconds since epoch); ascending order places the oldest transaction first, descending order places the newest transaction first.
2. WHEN Sort_Key is "Amount", THE App SHALL sort the Transaction_List by the `amount` field numerically; ascending order places the smallest amount first, descending order places the largest amount first.
3. WHEN Sort_Key is "Category", THE App SHALL sort the Transaction_List by the `category` field lexicographically (case-insensitive); ascending order sorts A→Z, descending order sorts Z→A.
4. WHEN two or more Transactions share the same value for the active Sort_Key, THE App SHALL apply `createdAt` descending as the first tiebreaker; if `createdAt` values are also identical, THE App SHALL apply the original stored array index ascending as the final tiebreaker, so the displayed order is always fully deterministic.

---

### Requirement 7: Sort Transactions — State Persistence

**User Story:** As a user, I want the app to remember my chosen sort preference across page reloads so that I do not have to reset it every session.

#### Acceptance Criteria

1. WHEN the user changes the Sort_Key or Sort_Direction, THE App SHALL persist the active sort preference (Sort_Key and Sort_Direction) to Local_Storage within 500 milliseconds.
2. WHEN the App loads and a valid stored sort preference exists in Local_Storage, THE App SHALL apply the stored Sort_Key and Sort_Direction when rendering the initial Transaction_List and visually reflect them in the sort controls.
3. IF no stored sort preference exists, THEN THE App SHALL default to Sort_Key "Date" and Sort_Direction "desc", matching the existing MVP behavior.
4. IF the stored sort preference is missing, cannot be parsed, or contains values outside the valid Sort_Key and Sort_Direction enumerations, THEN THE App SHALL fall back to the default (Sort_Key "Date", Sort_Direction "desc") and display a non-blocking warning consistent with the existing MVP storage-error pattern.

---

### Requirement 8: Dark/Light Mode — Theme Toggle

**User Story:** As a user, I want to switch between a dark and a light color scheme so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL render a Theme_Toggle button in a consistently visible position (e.g., top-right corner of the page) that is accessible via keyboard and has an `aria-label` that reflects the action it will perform (e.g., "Switch to dark mode" when the current theme is light, "Switch to light mode" when the current theme is dark).
2. WHEN the user activates the Theme_Toggle, THE App SHALL switch the active Theme to the opposite value, apply the new color scheme to the entire page, and update the `aria-label` of the Theme_Toggle to reflect the new action, all within 100 milliseconds.
3. THE App SHALL apply the active Theme by setting a `data-theme` attribute on the root `<html>` element (value `"dark"` or `"light"`), so that CSS rules targeting `[data-theme="dark"]` and `[data-theme="light"]` control all color changes without any JavaScript color values.
4. WHEN the active Theme is `dark`, THE App SHALL apply a dark color scheme to all page sections (background, surfaces, text, borders, buttons, and form controls) without leaving any visible section in the light scheme.
5. WHEN the active Theme is `light`, THE App SHALL restore the original MVP light color scheme across all page sections.

---

### Requirement 9: Dark/Light Mode — System Preference and Persistence

**User Story:** As a user, I want the app to respect my OS theme preference on first visit and remember my manual choice on subsequent visits.

#### Acceptance Criteria

1. WHEN the App loads for the first time and no stored Theme preference exists, THE App SHALL read the `prefers-color-scheme` media query and apply `dark` if the user's OS is set to dark mode, or `light` otherwise; this OS-detected theme SHALL be applied in-memory only and SHALL NOT be persisted to Local_Storage, so that subsequent loads without a stored preference always re-read the current OS setting.
2. WHEN the user manually activates the Theme_Toggle, THE App SHALL persist the chosen Theme to Local_Storage within 500 milliseconds, overriding the OS preference for all subsequent loads.
3. WHEN the App loads and a stored Theme preference exists in Local_Storage, THE App SHALL apply that stored Theme before the first paint (i.e., before the page is visually rendered) to avoid a flash of the wrong theme.
4. IF the stored Theme value is anything other than the string `"dark"` or the string `"light"`, THEN THE App SHALL discard it, fall back to the OS `prefers-color-scheme` detection described in criterion 9.1, and display a non-blocking warning consistent with the existing MVP storage-error pattern.

---

## Cross-Cutting Constraints

The following constraints apply to all three features and must not be violated:

- **No rewriting of MVP code**: All three features extend the existing functions and DOM; they do not replace or remove any MVP function, element, or behavior.
- **Single-file JS**: All new logic is added to `js/app.js`. No additional `.js` files are introduced.
- **Single-file CSS**: All new styles are added to `css/style.css`. No additional `.css` files are introduced.
- **No new external libraries**: No CDN scripts beyond the existing Chart.js import may be added.
- **Backward-compatible storage**: New Local_Storage keys (`categories`, `sortPreference`, `theme`) are independent of the existing `expenseTracker_transactions` key so that existing transaction data is never corrupted.
- **Accessibility**: All new interactive controls (category management inputs, sort controls, theme toggle) SHALL be keyboard-operable and include appropriate `aria` attributes.
