# Requirements Document

## Introduction

The Expense and Budget Visualizer is a client-side web application that allows users to track personal expenses by recording transactions with a name, amount, and category. The app displays a running total balance, a scrollable transaction history, and a live pie chart showing spending distribution by category. All data is persisted in the browser's Local Storage. The app is built with HTML, CSS, and Vanilla JavaScript — no frameworks, no backend, no build tools required.

## Glossary

- **App**: The Expense and Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Item_Name**: The descriptive label assigned to a transaction (e.g., "Lunch", "Bus ticket").
- **Amount**: The positive monetary value associated with a transaction, expressed as a number with up to two decimal places.
- **Category**: The classification of a transaction. Valid values are: `Food`, `Transport`, `Fun`.
- **Transaction_List**: The scrollable on-screen list of all stored transactions.
- **Balance**: The sum of all transaction amounts currently stored.
- **Pie_Chart**: The visual chart displaying spending distribution by category as proportional slices.
- **Local_Storage**: The browser's Web Storage API used to persist transaction data client-side.
- **Form**: The input form used to create a new transaction.
- **Validator**: The input-validation logic that checks form fields before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Form SHALL render three input fields: Item_Name (text, max 100 characters), Amount (number), and Category (select with options Food, Transport, Fun).
2. THE Form SHALL render a submit button labelled "Add".
3. WHEN the user clicks the submit button and all fields contain valid input, THE App SHALL create a new Transaction and add it to the Transaction_List.
4. WHEN the user clicks the submit button and Item_Name is empty or Category is unselected, THE Validator SHALL display an inline error message identifying the invalid field(s) without adding a Transaction.
5. WHEN the Amount field contains a value that is not a positive number, THE Validator SHALL display an error message stating that the amount must be a positive number, without adding a Transaction.
6. WHEN the Amount field contains a value greater than 999,999,999, THE Validator SHALL display an error message stating the amount exceeds the maximum allowed value, without adding a Transaction.
7. WHEN a Transaction is successfully added, THE Form SHALL clear all input fields and reset Category to its default placeholder state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction as a list item showing Item_Name (truncated at 100 characters with a visible indicator if truncated), Amount formatted as a monetary value with a currency symbol prefix and exactly two decimal places, and Category.
2. THE Transaction_List SHALL be vertically scrollable when the number of items exceeds the visible area.
3. WHEN the Transaction_List contains no transactions, THE App SHALL display a placeholder message indicating that no transactions have been recorded yet.
4. THE Transaction_List SHALL render transactions sorted by date and time added, with the most recent transaction appearing at the top.

---

### Requirement 3: Delete Transaction

**User Story:** As a user, I want to delete a transaction from the list so that I can correct mistakes or remove unwanted entries.

#### Acceptance Criteria

1. WHEN the Transaction_List contains at least one Transaction, THE Transaction_List SHALL display a delete button for each Transaction item.
2. WHEN the user clicks the delete button on a Transaction, THE App SHALL display a confirmation prompt before removing the Transaction.
3. WHEN the user confirms deletion, THE App SHALL remove that Transaction from the Transaction_List within 1 second.
4. WHEN the user cancels the confirmation prompt, THE App SHALL leave the Transaction unchanged and dismiss the prompt.
5. WHEN a Transaction is deleted, THE App SHALL update the Balance and the Pie_Chart within 1 second without requiring a page reload.
6. WHILE the Transaction_List contains no transactions, THE App SHALL not render any delete buttons.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total expenditure balance at the top of the page so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE App SHALL display the Balance in the topmost section of the page, above all Transaction_List content.
2. WHEN a Transaction is added, THE App SHALL recalculate the Balance as the sum of all Transaction amounts and update the display within 1 second.
3. WHEN a Transaction is deleted, THE App SHALL recalculate the Balance as the sum of all Transaction amounts and update the display within 1 second.
4. THE App SHALL display the Balance with a currency symbol prefix, exactly two decimal places, in the range $0.00 to $999,999,999.99 (e.g., $12.50).
5. WHILE no Transactions exist, THE App SHALL display a Balance of $0.00.
6. IF the sum of all Transaction amounts would exceed $999,999,999.99, THEN THE App SHALL prevent the addition of the Transaction and display an error message indicating the balance limit has been reached.

---

### Requirement 5: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand the distribution of my expenses at a glance.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display one slice per Category that has at least one Transaction, with each slice representing that category's proportion of the total Transaction amount across all Transactions.
2. WHEN a Transaction is added, THE App SHALL update the Pie_Chart within 500 milliseconds to reflect the new spending distribution.
3. WHEN a Transaction is deleted, THE App SHALL update the Pie_Chart within 500 milliseconds to reflect the updated spending distribution.
4. THE Pie_Chart SHALL assign a distinct color to each Category such that no two Categories share the same color.
5. THE Pie_Chart SHALL display a legend identifying each Category and its corresponding color.
6. WHILE no Transactions exist, THE App SHALL display a placeholder message in the chart area indicating that no spending data is available.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved automatically so that my data is not lost when I close or refresh the browser tab.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL save the updated Transaction_List to Local_Storage within 500 milliseconds.
2. WHEN a Transaction is deleted, THE App SHALL save the updated Transaction_List to Local_Storage within 500 milliseconds.
3. WHEN the App loads, THE App SHALL read all Transactions from Local_Storage and populate the Transaction_List, Balance, and Pie_Chart with the stored data within 1000 milliseconds.
4. IF Local_Storage is unavailable or returns a parse error, THEN THE App SHALL initialize with an empty Transaction_List and display a non-blocking warning message explaining that data could not be loaded.
5. IF a save operation to Local_Storage fails due to quota exceeded, THEN THE App SHALL not add the Transaction and SHALL display an error message informing the user that storage is full.

---

### Requirement 7: Responsive Layout

**User Story:** As a user, I want the app to display correctly on different screen sizes so that I can use it comfortably on both desktop and mobile browsers.

#### Acceptance Criteria

1. THE App SHALL render a layout on screen widths from 320px to 1920px where all interactive elements remain fully visible and operable without horizontal scrolling.
2. WHEN the viewport width is below 768px, THE App SHALL stack the Form, Transaction_List, and Pie_Chart vertically in a single column at 100% of the viewport width.
3. WHEN the viewport width is 768px or above, THE App SHALL arrange the Form and Transaction_List side-by-side with the Pie_Chart positioned below or beside them, with no content overflow or overlap between components.
4. WHEN the viewport is resized or the device orientation changes, THE App SHALL reflow the layout within one rendering frame without requiring a page reload.

---

### Requirement 8: Project File Structure

**User Story:** As a developer, I want the project to follow a clean folder structure so that the codebase stays organized and maintainable.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located at `css/style.css`.
2. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
3. THE App SHALL be launchable by opening `index.html` directly in a browser with no build step or server required.
4. ALL asset references (CSS, JavaScript, images) in `index.html` SHALL use relative paths so the app works when opened from any local file system location.
5. THE project SHALL include the following required files: `index.html`, `css/style.css`, and `js/app.js`; absence of any of these files SHALL constitute a structural failure.
