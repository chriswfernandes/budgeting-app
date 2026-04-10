This roadmap prioritizes transforming your **BudgetTracker.jsx** from a reactive log into a proactive financial tool. By removing bank integrations, you've significantly reduced technical debt, allowing you to focus on the **Rules Engine** and **Flexible Budgeting**—the "brain" of the application.

---

## 🗺️ Product Roadmap: The "Vibe-Code" Edition

### Phase 1: The Rules Engine (High Priority)
*Objective: Automate the boring stuff. If the app can't categorize 80% of your CSV automatically, you'll stop using it.*

* **Rule Schema:** Create a new storage key `budget-rules`. Each rule should have a `trigger` (text to match), `targetCategory`, and an `active` toggle.
* **The "Run Rules" Loop:** When a CSV is imported, the app should scan every transaction. If `txn.description` contains a rule's trigger word, it auto-assigns the category and skips the manual `ClassifyView` for that item.
* **Management UI:** A new "Rules" tab where you can:
    * **Create:** "If name contains 'NETFLIX', set category to 'Subscriptions'."
    * **Toggle:** A simple checkbox to enable/disable specific rules without deleting them.

### Phase 1.1: Multi-Account CSV Imports (High Priority)
*Objective: Support different source accounts with a unified format.*

* **Account Selection:** When importing, prompt the user to choose between "Checking" and "Credit Card".
* **Standardized Format:** Support the "Date, Transaction Description, Withdrawls, Deposits, Balance" column structure.
* **Account Tagging:** Tag transactions with their source account type so they can be filtered or analyzed separately later.

### Phase 1.2: Persistent Uncategorized Transactions (High Priority)
*Objective: Ensure no transaction is lost, even if skipped during import.*

* **"Skip" saves as Uncategorized:** Clicking "Skip" during the classification flow should save the transaction with a `null` category instead of discarding it.
* **Dashboard Visibility:** Uncategorized transactions should appear in the monthly and annual dashboards (under an "Uncategorized" or "Other" bucket).
* **In-Place Editing:** Allow users to click on any transaction in the `MonthView` to change its category after the fact.

### Phase 1.3: Dynamic Hierarchical Categories (High Priority)
*Objective: Full control over your budget structure.*

* **Dynamic Management:** Move categories from a static list to persistent storage (`budget-categories`). Add a UI to create, rename, and delete them.
* **Hierarchy:** Support parent/child relationships. "Income" can be a parent category with "Chris' Income" and "Myriam's Income" as children.
* **Roll-up Reporting:** Dashboards should optionally "roll up" sub-category spending into their parent totals for a cleaner overview.

### Phase 2: Flexible Budgeting (Medium Priority)
*Objective: Implement the "Overarching vs. Override" logic for Under/Over tracking.*

* **The Two-Tier System:**
    1.  **Global Targets:** A "Settings" or "Templates" area where you set a default monthly goal for each category (e.g., $500 for Groceries).
    2.  **Monthly Overrides:** In the `MonthView`, allow the user to click the budget target. If they change it, save that specific value for *that month only* in your database.
* **Visual Logic:** The app should first check if a "Month-Specific" target exists; if not, it falls back to the "Global Target."
* **The "Vibe" Progress Bar:** In the `MonthView` sidebar, the spending bars should turn red if "Actual > Target."

### Phase 3: Forecasting (Future/Lower Priority)
*Objective: Project your future balance based on history.*

* **Recurring Detection:** A simple script that looks for transactions with similar amounts and names that occur ~30 days apart.
* **Cash Flow Projection:** A new chart in the `Overview` that extends the "Net Savings" bar into future months based on your current `Total Income - Total Budget Targets`.

---

## 🛠️ Implementation Priority & Effort

| Feature | Priority | Effort | "Vibe-Code" Complexity |
| :--- | :--- | :--- | :--- |
| **Rules Engine (Auto-Categorization)** | **Must Have** | Moderate | Needs a `rules.filter()` loop in your import logic. |
| **Global Budget Targets** | **Must Have** | Low | Simple new storage key `global-budgets`. |
| **Monthly Budget Overrides** | **Should Have** | Moderate | Requires a conditional check: `override ?? global`. |
| **Under/Over Visuals** | **Should Have** | Low | CSS tweaks to the existing progress bars. |
| **Forecasting** | **Could Have** | High | Needs a "future projection" math helper function. |

---

## 💡 "Vibe-Coding" Technical Tips

### 1. The Override Logic
To implement your "Overarching vs. Monthly" requirement, use this pattern in your `MonthView`:
```javascript
// Logic: Specific Month Override > Global Default > $0
const getTarget = (catId, monthKey) => {
  return monthOverrides[monthKey]?.[catId] 
         || globalBudgets[catId] 
         || 0;
};
```

### 2. SQLite Update for Rules
Since you want persistent rules, you'll need to update your `store` bridge. Ensure your rules are saved in their own table so they persist even if you clear transaction data.

### 3. CSV Post-Processor
Add a "Pre-Classifier" function. Before showing the `ClassifyView`, run this:
```javascript
const autoClassify = (txns, rules) => {
  return txns.map(t => {
    const matchingRule = rules.find(r => r.active && t.description.includes(r.trigger));
    return matchingRule ? { ...t, category: matchingRule.targetCategory } : t;
  });
};
```

Would you like the specific code to integrate the **Rules Engine** into your existing `BudgetTracker.jsx` first?