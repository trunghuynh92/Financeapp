# Finance Management System - Database Design Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Database Architecture](#database-architecture)
3. [Table Schemas](#table-schemas)
4. [Table Relationships](#table-relationships)
5. [Key Concepts](#key-concepts)
6. [Common Workflows](#common-workflows)
7. [Balance Calculation Strategy](#balance-calculation-strategy)
8. [Implementation Guidelines](#implementation-guidelines)

---

## 🎯 System Overview

This is a **multi-entity, multi-account finance management system** designed for tracking transactions across multiple companies, branches, and bank accounts.

### Key Features:
- ✅ Import bank transactions from original bank files
- ✅ Categorize and analyze transactions
- ✅ Split single transactions into multiple categories or branches
- ✅ Track balances at account and entity levels
- ✅ Maintain original bank records separately (immutable)
- ✅ Support multiple currencies
- ✅ Full audit trail
- ✅ Comprehensive debt management (credit lines, term loans, drawdowns)
- ✅ Track principal and interest payments separately

### Use Cases:
- Company with multiple branches sharing bank accounts
- Managing personal and business finances separately
- Splitting shared expenses across departments/branches
- Bank reconciliation and financial reporting
- Tracking credit lines and term loans with multiple drawdowns
- Managing debt repayment schedules and interest payments

---

## 🏗️ Database Architecture

### Hierarchy Structure:
```
Entity (Company A, Company X, Personal)
  │
  ├── Branch (Branch X, Branch Y, Branch Z) [Optional]
  │
  └── Account (Vietcombank, Techcombank, Cash, Credit Lines, Term Loans)
      │
      ├── Transactions
      │
      └── Debt Drawdowns [For credit lines & term loans]
```

### Two-Table Transaction System:
```
┌─────────────────────────────┐
│  ORIGINAL_TRANSACTION       │
│  (Bank's truth - READ ONLY) │
│  - Never modified           │
│  - Audit/reconciliation     │
└──────────┬──────────────────┘
           │
           │ Raw_transaction_id (Foreign Key)
           │
┌──────────▼──────────────────┐
│  MAIN_TRANSACTION           │
│  (Working table)            │
│  - Can split                │
│  - Can categorize           │
│  - Can edit descriptions    │
│  - Balance tracking         │
└─────────────────────────────┘
```

---

## 📊 Table Schemas

### 1. ENTITY Table
**Purpose:** Stores companies or personal entities that own accounts.

```sql
CREATE TABLE Entity (
    entity_id INT PRIMARY KEY AUTO_INCREMENT,
    entity_name VARCHAR(100) NOT NULL,
    entity_type ENUM('company', 'personal') NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_entity_type (entity_type),
    INDEX idx_active (is_active)
);
```

**Example Data:**
| entity_id | entity_name | entity_type |
|-----------|-------------|-------------|
| 1 | Company A | company |
| 2 | Company X | company |
| 3 | Personal | personal |

---

### 2. BRANCH Table
**Purpose:** Stores branches within an entity (optional - only for companies with branches).

```sql
CREATE TABLE Branch (
    branch_id INT PRIMARY KEY AUTO_INCREMENT,
    entity_id INT NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    branch_code VARCHAR(20),
    location VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (entity_id) REFERENCES Entity(entity_id),
    INDEX idx_entity (entity_id)
);
```

**Example Data:**
| branch_id | entity_id | branch_name | location |
|-----------|-----------|-------------|----------|
| 1 | 1 | Branch X | Hanoi |
| 2 | 1 | Branch Y | Ho Chi Minh City |
| 3 | 1 | Branch Z | Da Nang |

---

### 3. ACCOUNT Table
**Purpose:** Stores bank accounts, cash accounts, credit cards, etc.

```sql
CREATE TABLE Account (
    account_id INT PRIMARY KEY AUTO_INCREMENT,
    entity_id INT NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_type ENUM('bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan') NOT NULL,
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Debt-specific fields
    credit_limit DECIMAL(15,2),  -- For credit lines and term loans
    loan_reference VARCHAR(100),  -- Bank's debt/loan serial number
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (entity_id) REFERENCES Entity(entity_id),
    INDEX idx_entity (entity_id),
    INDEX idx_active (is_active),
    INDEX idx_account_type (account_type)
);
```

**Example Data:**
| account_id | entity_id | account_name | account_type | bank_name | credit_limit |
|------------|-----------|--------------|--------------|-----------|--------------|
| 1 | 1 | Vietcombank Company A | bank | Vietcombank | NULL |
| 2 | 1 | Techcombank Company A | bank | Techcombank | NULL |
| 3 | 1 | Cash Company A | cash | N/A | NULL |
| 4 | 2 | Vietcombank Company X | bank | Vietcombank | NULL |
| 5 | 3 | Techcombank Personal | bank | Techcombank | NULL |
| 6 | 1 | Techcombank Credit Line | credit_line | Techcombank | 500,000,000 |
| 7 | 1 | Vietcombank Term Loan | term_loan | Vietcombank | 700,000,000 |

---

### 4. ACCOUNT_BALANCE Table
**Purpose:** Stores current balance for each account (for quick access).

```sql
CREATE TABLE Account_Balance (
    account_id INT PRIMARY KEY,
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    last_transaction_id BIGINT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES Account(account_id)
);
```

**Example Data:**
| account_id | current_balance | last_updated |
|------------|-----------------|--------------|
| 1 | 450,000,000.00 | 2025-11-03 |
| 2 | 280,000,000.00 | 2025-11-02 |

---

### 5. ENTITY_BALANCE Table (Optional)
**Purpose:** Stores aggregated balance for entire entity (sum of all accounts).

```sql
CREATE TABLE Entity_Balance (
    entity_id INT PRIMARY KEY,
    total_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (entity_id) REFERENCES Entity(entity_id)
);
```

---

### 6. DEBT_DRAWDOWN Table
**Purpose:** Tracks individual drawdowns/loans within credit lines or term loans.

```sql
CREATE TABLE Debt_Drawdown (
    drawdown_id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,  -- Links to debt account (credit_line or term_loan)
    drawdown_reference VARCHAR(100) NOT NULL,  -- Bank's serial number for this drawdown
    drawdown_date DATE NOT NULL,
    original_amount DECIMAL(15,2) NOT NULL,
    remaining_balance DECIMAL(15,2) NOT NULL,
    due_date DATE,  -- When this drawdown must be repaid
    interest_rate DECIMAL(5,2),
    status ENUM('active', 'fully_paid', 'overdue') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES Account(account_id),
    INDEX idx_account (account_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_reference (drawdown_reference)
);
```

**Example Data:**

**Credit Line Drawdowns:**
| drawdown_id | account_id | drawdown_reference | original_amount | remaining_balance | due_date | status |
|-------------|------------|-------------------|-----------------|-------------------|----------|--------|
| 1 | 6 | DRAW-001 | 100,000,000 | 50,000,000 | 2026-05-01 | active |
| 2 | 6 | DRAW-002 | 80,000,000 | 80,000,000 | 2026-07-15 | active |
| 3 | 6 | DRAW-003 | 50,000,000 | 50,000,000 | 2026-09-30 | active |

**Term Loan (Single Drawdown):**
| drawdown_id | account_id | drawdown_reference | original_amount | remaining_balance | due_date | status |
|-------------|------------|-------------------|-----------------|-------------------|----------|--------|
| 4 | 7 | LOAN-2025-001 | 700,000,000 | 700,000,000 | 2030-11-01 | active |

---

### 7. ORIGINAL_TRANSACTION Table
**Purpose:** Stores EXACT data from bank files - NEVER modified after import.

```sql
CREATE TABLE Original_transaction (
    raw_transaction_id VARCHAR(100) PRIMARY KEY,
    account_id INT NOT NULL,
    transaction_date DATETIME NOT NULL,
    description VARCHAR(500),
    debit_amount DECIMAL(15,2),
    credit_amount DECIMAL(15,2),
    balance DECIMAL(15,2),
    bank_reference VARCHAR(100),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_file_name VARCHAR(255),
    
    FOREIGN KEY (account_id) REFERENCES Account(account_id),
    INDEX idx_account_date (account_id, transaction_date),
    INDEX idx_imported (imported_at)
);
```

**Important Notes:**
- ⚠️ **READ ONLY** - Never update or delete from this table
- ✅ Used for reconciliation and audit
- ✅ Source of truth from the bank

**Example Data:**
| raw_transaction_id | account_id | transaction_date | description | debit_amount | credit_amount | balance |
|-------------------|------------|------------------|-------------|--------------|---------------|---------|
| TECH_NOV_001 | 2 | 2025-11-01 | Payment to Meta | 50,000,000 | 0 | 450,000,000 |
| VCB_NOV_002 | 1 | 2025-11-02 | Client Payment | 0 | 100,000,000 | 550,000,000 |

---

### 8. MAIN_TRANSACTION Table (⭐ Core Working Table)
**Purpose:** Working table where transactions are categorized, split, and analyzed.

```sql
CREATE TABLE Main_transaction (
    transaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Basic transaction info
    transaction_date DATETIME NOT NULL,
    description VARCHAR(500),
    amount DECIMAL(15,2) NOT NULL,
    transaction_direction ENUM('credit', 'debit') NOT NULL,
    
    -- Balance (cached/calculated at insert time)
    running_balance DECIMAL(15,2) NOT NULL,
    
    -- Account and Entity
    account_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Link to original bank transaction
    raw_transaction_id VARCHAR(100) NOT NULL,
    
    -- Split tracking
    split_sequence SMALLINT DEFAULT 1,
    split_total_validated BOOLEAN DEFAULT FALSE,
    
    -- Categorization
    category_id INT,
    type_id INT NOT NULL,
    entity_id INT NOT NULL,
    branch_id INT,  -- Optional: for branch-level tracking
    
    -- Debt tracking
    drawdown_id INT,  -- Links to specific debt drawdown for debt-related transactions
    transaction_subtype ENUM('principal', 'interest', 'fee', 'regular') DEFAULT 'regular',
    
    -- Additional metadata
    notes TEXT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    currency_code VARCHAR(3) DEFAULT 'VND',
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (account_id) REFERENCES Account(account_id),
    FOREIGN KEY (entity_id) REFERENCES Entity(entity_id),
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id),
    FOREIGN KEY (category_id) REFERENCES Category(category_id),
    FOREIGN KEY (type_id) REFERENCES Type(type_id),
    FOREIGN KEY (raw_transaction_id) REFERENCES Original_transaction(raw_transaction_id),
    FOREIGN KEY (drawdown_id) REFERENCES Debt_Drawdown(drawdown_id),
    
    -- Indexes
    INDEX idx_account_date (account_id, transaction_date, transaction_id),
    INDEX idx_raw_transaction (raw_transaction_id),
    INDEX idx_entity (entity_id),
    INDEX idx_branch (branch_id),
    INDEX idx_category (category_id),
    INDEX idx_date (transaction_date),
    INDEX idx_drawdown (drawdown_id),
    INDEX idx_subtype (transaction_subtype)
);
```

**Column Descriptions:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `transaction_id` | BIGINT | PRIMARY KEY - Unique ID for each row | 1001 |
| `transaction_date` | DATETIME | Date from original bank transaction (never changes) | 2025-11-01 |
| `description` | VARCHAR(500) | Can be edited from original for clarity | "Meta Ads - Q4 Campaign" |
| `amount` | DECIMAL(15,2) | Always positive number | 50,000,000.00 |
| `transaction_direction` | ENUM | 'credit' (money in) or 'debit' (money out) | 'debit' |
| `running_balance` | DECIMAL(15,2) | Account balance after this transaction (cached) | 450,000,000.00 |
| `account_id` | INT | Which bank account | 2 (Techcombank) |
| `user_id` | INT | Which user entered/imported this | 5 |
| `raw_transaction_id` | VARCHAR(100) | Links back to Original_transaction | TECH_NOV_001 |
| `split_sequence` | SMALLINT | Order of split (1, 2, 3...) if transaction is split | 1 |
| `split_total_validated` | BOOLEAN | TRUE if split amounts add up to original | TRUE |
| `category_id` | INT | User categorization (Salary, Rent, Food, etc.) | 15 (Marketing) |
| `type_id` | INT | Transaction type (Income, Expense, Transfer, etc.) | 2 (Expense) |
| `entity_id` | INT | Which company/person owns this | 1 (Company A) |
| `branch_id` | INT | Optional: Which branch this is assigned to | 2 (Branch Y) |
| `drawdown_id` | INT | Optional: Links to specific debt drawdown | 1 (for debt payments) |
| `transaction_subtype` | ENUM | Type of payment: 'principal', 'interest', 'fee', or 'regular' | 'interest' |
| `notes` | TEXT | User's personal notes | "Approved by manager" |
| `is_reconciled` | BOOLEAN | Checked against bank statement | TRUE |
| `currency_code` | VARCHAR(3) | VND, USD, EUR, etc. | VND |
| `created_at` | TIMESTAMP | When this row was created | 2025-11-01 08:30:00 |
| `updated_at` | TIMESTAMP | Last modification time | 2025-12-05 14:20:00 |

---

### 9. CATEGORY Table
**Purpose:** Predefined categories for transactions.

```sql
CREATE TABLE Category (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    category_type ENUM('income', 'expense', 'both') NOT NULL,
    parent_category_id INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (parent_category_id) REFERENCES Category(category_id),
    INDEX idx_type (category_type)
);
```

**Example Data:**
| category_id | category_name | category_type | parent_category_id |
|-------------|---------------|---------------|--------------------|
| 1 | Marketing | expense | NULL |
| 2 | Marketing - Digital Ads | expense | 1 |
| 3 | Marketing - Print | expense | 1 |
| 10 | Sales Revenue | income | NULL |
| 11 | Service Revenue | income | NULL |

---

### 10. TYPE Table
**Purpose:** High-level transaction types.

```sql
CREATE TABLE Type (
    type_id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);
```

**Example Data:**
| type_id | type_name | description |
|---------|-----------|-------------|
| 1 | Income | Money coming in |
| 2 | Expense | Money going out |
| 3 | Transfer | Moving money between accounts |
| 4 | Debt Acquired | Taking on debt |
| 5 | Debt Payback | Paying off debt |

---

## 🔗 Table Relationships

### Entity Relationship Diagram:

```
                    ┌──────────┐
                    │  Entity  │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌─────────────┐
    │  Branch  │  │ Account  │  │Entity_Balance│
    └──────────┘  └────┬─────┘  └─────────────┘
                       │
                       ├──────────────┐
                       ▼              ▼
              ┌────────────────┐  ┌───────────────┐
              │Account_Balance │  │Original_trans │
              └────────────────┘  └───────┬───────┘
                                          │
                                          │ raw_transaction_id
                                          │
                                          ▼
                                  ┌───────────────┐
                                  │Main_transaction│
                                  └───────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────┐
                    ▼                     ▼             ▼
              ┌──────────┐          ┌─────────┐  ┌─────────┐
              │ Category │          │  Type   │  │ Branch  │
              └──────────┘          └─────────┘  └─────────┘
```

### Key Relationships:

1. **Entity → Account** (1:Many)
   - One entity can have multiple accounts
   - Example: Company A has Vietcombank, Techcombank, Cash

2. **Entity → Branch** (1:Many)
   - One entity can have multiple branches
   - Example: Company A has Branch X, Y, Z

3. **Account → Original_transaction** (1:Many)
   - One account has many original bank transactions

4. **Original_transaction → Main_transaction** (1:Many)
   - One original transaction can be split into multiple rows in Main_transaction
   - Linked by `raw_transaction_id`

5. **Main_transaction → Category** (Many:1)
   - Many transactions can have the same category

6. **Main_transaction → Branch** (Many:1) [Optional]
   - Transactions can be assigned to specific branches

---

## 🎓 Key Concepts

### 1. Transaction Splitting

**Scenario:** One bank transaction needs to be allocated to multiple categories or branches.

**Example:**
```
Original Bank Transaction:
- Date: Nov 1, 2025
- Description: "Payment to Meta"
- Amount: 50,000,000 VND
- Raw_transaction_id: TECH_NOV_001

Split in Main_transaction:
Row 1: 14,000,000 → Branch X
Row 2: 16,000,000 → Branch Y  
Row 3: 20,000,000 → Branch Z

All three rows have:
- Same raw_transaction_id: TECH_NOV_001
- Same transaction_date: Nov 1, 2025
- split_sequence: 1, 2, 3
- Total: 50,000,000 ✅
```

**Validation Rule:**
```
SUM(amount WHERE raw_transaction_id = 'TECH_NOV_001')
MUST EQUAL
Original_transaction.debit_amount (or credit_amount)
WHERE raw_transaction_id = 'TECH_NOV_001'
```

---

### 2. Balance Calculation (Materialized/Cached Approach)

**Strategy:** Calculate and STORE balance at transaction insert time (not on-the-fly).

**Why?**
- ✅ Fast queries (no recalculation needed)
- ✅ Efficient for large datasets
- ✅ Each row shows exact balance at that point in time

**How it works:**

```
Current balance: 400,000,000 VND

New transaction arrives:
- Amount: 50,000,000
- Direction: Credit (money in)

Calculation:
new_balance = 400,000,000 + 50,000,000 = 450,000,000

Store in Main_transaction:
- amount: 50,000,000
- running_balance: 450,000,000 ← CACHED
```

**When balance needs recalculation:**
- If you edit or delete an old transaction
- Run a recalculation procedure for all transactions after that date

---

### 3. Two-Table System (Original vs Main)

**Why separate tables?**

| Original_transaction | Main_transaction |
|---------------------|------------------|
| ✅ Immutable (never changes) | ✅ Flexible (can edit) |
| ✅ Exactly as bank provided | ✅ Categorized & organized |
| ✅ Audit/reconciliation | ✅ Split into multiple rows |
| ✅ One row per bank transaction | ✅ Multiple rows per bank transaction |
| ❌ No categorization | ✅ Full categorization |
| ❌ Cannot split | ✅ Can split by branch/category |

**Example Flow:**
```
1. Import bank file → Creates rows in Original_transaction
2. Automatically copy → Creates initial rows in Main_transaction
3. User categorizes → Updates Main_transaction only
4. User splits → Adds more rows in Main_transaction
5. Reconcile → Compare totals between both tables
```

---

### 4. Branch Allocation (Optional Feature)

**When to use:**
- Companies with multiple branches sharing bank accounts
- Need to track which branch incurred which expenses
- Branch-level P&L reporting

**When NOT to use:**
- Personal accounts (no branches)
- Small businesses without branch structure
- Transactions at entity level (e.g., corporate insurance)

**Example:**
```
Branch_id = NULL: Entity-level expense (benefits all branches)
Branch_id = 1: Assigned to Branch X specifically
Branch_id = 2: Assigned to Branch Y specifically
```

---

### 5. Debt Management (Credit Lines & Term Loans)

**How it works:**
Debt is treated as a special type of account (`credit_line` or `term_loan`). Each debt account can have multiple drawdowns tracked separately.

**Credit Line:**
- Has a `credit_limit` (e.g., 500M available)
- Multiple drawdowns with individual due dates
- Each drawdown tracked in `Debt_Drawdown` table
- Balance shows negative (amount owed)
- Available credit = credit_limit - |current_balance|

**Term Loan:**
- Full amount received at once (e.g., 700M)
- Creates ONE drawdown entry immediately
- Fixed repayment schedule
- Balance shows negative (amount owed)

**Transaction Types:**
- **Drawdown**: `transaction_direction = 'credit'` (money coming in, increases debt)
  - `transaction_subtype = 'regular'`
  - Links to `drawdown_id`
  - Decreases available credit

- **Principal Payment**: `transaction_direction = 'debit'` (money going out, reduces debt)
  - `transaction_subtype = 'principal'`
  - Links to specific `drawdown_id`
  - Reduces `Debt_Drawdown.remaining_balance`
  - Increases available credit (for credit lines)

- **Interest Payment**: `transaction_direction = 'debit'` (money going out, expense)
  - `transaction_subtype = 'interest'`
  - Links to specific `drawdown_id`
  - Does NOT reduce debt balance
  - Categorized as interest expense

**Example Structure:**
```
Account: Techcombank Credit Line (credit_limit = 500M)
├── Drawdown 1: 100M (due 2026-05-01) - paid 50M, owes 50M
├── Drawdown 2: 80M (due 2026-07-15) - paid 0M, owes 80M
└── Drawdown 3: 50M (due 2026-09-30) - paid 0M, owes 50M

Total Used: 180M
Available: 320M (500M - 180M)
```

---

## 📝 Common Workflows

### Workflow 1: Import Bank Transactions

```
Step 1: Parse bank file (CSV/Excel)
Step 2: Insert into Original_transaction
        - raw_transaction_id = unique ID from bank or generated
        - Store exact data as provided
        
Step 3: Auto-create in Main_transaction
        - Copy from Original_transaction
        - Calculate running_balance
        - Set category_id = NULL (to be filled later)
        - Set branch_id = NULL (to be filled later)
        
Step 4: Update Account_Balance
        - Update current_balance with new amount
        
Step 5: Update Entity_Balance
        - Recalculate total across all accounts
```

**SQL Example:**
```sql
-- Step 2: Insert into Original_transaction
INSERT INTO Original_transaction (
    raw_transaction_id, account_id, transaction_date,
    description, debit_amount, credit_amount, balance
)
VALUES (
    'TECH_NOV_001', 2, '2025-11-01',
    'Payment to Meta', 50000000, 0, 450000000
);

-- Step 3: Insert into Main_transaction
INSERT INTO Main_transaction (
    transaction_date, description, amount, transaction_direction,
    running_balance, account_id, user_id, raw_transaction_id,
    entity_id, type_id
)
VALUES (
    '2025-11-01', 'Payment to Meta', 50000000, 'debit',
    450000000, 2, 1, 'TECH_NOV_001',
    1, 2  -- Entity: Company A, Type: Expense
);

-- Step 4: Update Account_Balance
UPDATE Account_Balance
SET current_balance = 450000000,
    last_transaction_id = LAST_INSERT_ID()
WHERE account_id = 2;

-- Step 5: Update Entity_Balance
UPDATE Entity_Balance
SET total_balance = total_balance - 50000000
WHERE entity_id = 1;
```

---

### Workflow 2: Split Transaction by Branch

```
Original state:
- One row in Main_transaction
- transaction_id = 1001
- amount = 50,000,000
- branch_id = NULL

User action: Split by branches

Step 1: Delete or mark original row
Step 2: Create 3 new rows with split amounts
        - All share same raw_transaction_id
        - Each has different branch_id
        - split_sequence = 1, 2, 3
        
Step 3: Validate total
        - SUM(split amounts) = Original amount
        - Set split_total_validated = TRUE
```

**SQL Example:**
```sql
-- Step 1: Delete original (or mark as superseded)
DELETE FROM Main_transaction WHERE transaction_id = 1001;

-- Step 2: Insert split rows
INSERT INTO Main_transaction (
    transaction_date, description, amount, transaction_direction,
    running_balance, account_id, user_id, raw_transaction_id,
    entity_id, branch_id, category_id, type_id, split_sequence
)
VALUES
-- Split 1: Branch X
('2025-11-01', 'Meta Ads - Branch X', 14000000, 'debit',
 450000000, 2, 1, 'TECH_NOV_001', 1, 1, 2, 2, 1),
 
-- Split 2: Branch Y
('2025-11-01', 'Meta Ads - Branch Y', 16000000, 'debit',
 450000000, 2, 1, 'TECH_NOV_001', 1, 2, 2, 2, 2),
 
-- Split 3: Branch Z
('2025-11-01', 'Meta Ads - Branch Z', 20000000, 'debit',
 450000000, 2, 1, 'TECH_NOV_001', 1, 3, 2, 2, 3);

-- Step 3: Validate
SELECT 
    raw_transaction_id,
    SUM(amount) as total_split,
    (SELECT debit_amount FROM Original_transaction 
     WHERE raw_transaction_id = 'TECH_NOV_001') as original_amount
FROM Main_transaction
WHERE raw_transaction_id = 'TECH_NOV_001'
GROUP BY raw_transaction_id;
```

---

### Workflow 3: Reconciliation Check

```
Purpose: Ensure Main_transaction totals match Original_transaction

Step 1: For each raw_transaction_id in Original_transaction
Step 2: Sum all amounts in Main_transaction with same raw_transaction_id
Step 3: Compare with original amount
Step 4: Flag discrepancies
```

**SQL Example:**
```sql
-- Find transactions that don't reconcile
SELECT 
    o.raw_transaction_id,
    o.description as original_description,
    COALESCE(o.debit_amount, o.credit_amount) as original_amount,
    SUM(m.amount) as main_total,
    COALESCE(o.debit_amount, o.credit_amount) - SUM(m.amount) as difference
FROM Original_transaction o
LEFT JOIN Main_transaction m ON o.raw_transaction_id = m.raw_transaction_id
GROUP BY o.raw_transaction_id
HAVING ABS(difference) > 0.01;  -- Allow for small rounding differences
```

---

### Workflow 4: Monthly Branch Report

```
Purpose: Show how much each branch spent this month

Query: Sum all transactions by branch for specific period
Filter: Entity, Date range
Group by: Branch
```

**SQL Example:**
```sql
SELECT 
    b.branch_name,
    SUM(CASE WHEN m.transaction_direction = 'debit' THEN m.amount ELSE 0 END) as total_expense,
    SUM(CASE WHEN m.transaction_direction = 'credit' THEN m.amount ELSE 0 END) as total_income,
    COUNT(m.transaction_id) as transaction_count
FROM Branch b
LEFT JOIN Main_transaction m ON b.branch_id = m.branch_id
WHERE m.entity_id = 1  -- Company A
  AND m.transaction_date >= '2025-11-01'
  AND m.transaction_date < '2025-12-01'
GROUP BY b.branch_id, b.branch_name
ORDER BY total_expense DESC;
```

---

### Workflow 5: Record Debt Drawdown

**Scenario:** Company takes 100M from credit line or receives term loan.

```
Step 1: Create Debt_Drawdown record
        - drawdown_reference from bank
        - original_amount and remaining_balance = 100M
        - due_date from loan agreement
        
Step 2: Create Main_transaction (money received)
        - transaction_direction = 'credit'
        - amount = 100M
        - drawdown_id = links to Debt_Drawdown
        - transaction_subtype = 'regular'
        
Step 3: Update Account_Balance
        - current_balance becomes MORE negative (debt increased)
        
Step 4: For credit line: Reduce available credit
```

**SQL Example:**
```sql
-- Step 1: Record drawdown
INSERT INTO Debt_Drawdown (
    account_id, drawdown_reference, drawdown_date,
    original_amount, remaining_balance, due_date, interest_rate
) VALUES (
    6, 'DRAW-004', '2025-11-01',
    100000000, 100000000, '2026-05-01', 12.5
);

-- Step 2: Record transaction
INSERT INTO Main_transaction (
    account_id, transaction_date, amount, transaction_direction,
    description, drawdown_id, transaction_subtype,
    running_balance, entity_id, type_id, raw_transaction_id, ...
) VALUES (
    6, '2025-11-01', 100000000, 'credit',
    'Credit line drawdown - DRAW-004', LAST_INSERT_ID(), 'regular',
    -100000000, 1, 4, 'BANK_NOV_001', ...
);

-- Step 3: Update Account_Balance (already done by normal insert process)
```

---

### Workflow 6: Pay Debt Principal

**Scenario:** Company pays 30M principal on specific drawdown.

```
Step 1: Record Main_transaction (payment out)
        - transaction_direction = 'debit'
        - amount = 30M
        - drawdown_id = specific drawdown being paid
        - transaction_subtype = 'principal'
        
Step 2: Update Debt_Drawdown.remaining_balance
        - Reduce by 30M
        - If balance reaches 0, mark status = 'fully_paid'
        
Step 3: Update Account_Balance
        - current_balance becomes LESS negative (debt reduced)
```

**SQL Example:**
```sql
-- Step 1: Record payment
INSERT INTO Main_transaction (
    account_id, transaction_date, amount, transaction_direction,
    description, drawdown_id, transaction_subtype,
    running_balance, entity_id, type_id, raw_transaction_id, ...
) VALUES (
    6, '2025-12-01', 30000000, 'debit',
    'Principal payment for DRAW-004', 4, 'principal',
    -70000000, 1, 5, 'BANK_DEC_001', ...
);

-- Step 2: Update drawdown balance
UPDATE Debt_Drawdown
SET remaining_balance = remaining_balance - 30000000,
    status = CASE 
        WHEN remaining_balance - 30000000 <= 0 THEN 'fully_paid'
        ELSE 'active'
    END,
    updated_at = NOW()
WHERE drawdown_id = 4;
```

---

### Workflow 7: Pay Debt Interest

**Scenario:** Company pays 2M monthly interest on drawdown.

```
Step 1: Record Main_transaction (interest expense)
        - transaction_direction = 'debit'
        - amount = 2M
        - drawdown_id = specific drawdown
        - transaction_subtype = 'interest'
        - category_id = 'Interest Expense'
        
Note: Interest payments do NOT reduce Debt_Drawdown.remaining_balance
```

**SQL Example:**
```sql
INSERT INTO Main_transaction (
    account_id, transaction_date, amount, transaction_direction,
    description, drawdown_id, transaction_subtype,
    category_id, running_balance, entity_id, type_id, ...
) VALUES (
    6, '2025-12-01', 2000000, 'debit',
    'Interest payment for DRAW-004', 4, 'interest',
    25,  -- category_id for 'Interest Expense'
    -70000000, 1, 2, ...  -- type_id = Expense
);
```

---

## 💰 Balance Calculation Strategy

### Account-Level Balance

**Method:** Cached/Materialized Balance (Recommended)

**Implementation:**

```python
def insert_transaction(account_id, date, amount, direction, **kwargs):
    """
    Insert new transaction and update balance
    """
    # 1. Get last balance for this account
    last_balance = get_last_balance(account_id)
    
    # 2. Calculate new balance
    if direction == 'credit':
        new_balance = last_balance + amount
    else:  # debit
        new_balance = last_balance - amount
    
    # 3. Insert transaction with calculated balance
    transaction_id = db.insert(
        'Main_transaction',
        transaction_date=date,
        amount=amount,
        transaction_direction=direction,
        running_balance=new_balance,  # ← Cached balance
        account_id=account_id,
        **kwargs
    )
    
    # 4. Update Account_Balance
    db.update(
        'Account_Balance',
        current_balance=new_balance,
        last_transaction_id=transaction_id,
        WHERE={'account_id': account_id}
    )
    
    return transaction_id


def get_last_balance(account_id):
    """
    Get the most recent balance for an account
    """
    result = db.query_one("""
        SELECT running_balance
        FROM Main_transaction
        WHERE account_id = ?
        ORDER BY transaction_date DESC, transaction_id DESC
        LIMIT 1
    """, [account_id])
    
    return result['running_balance'] if result else 0
```

---

### Entity-Level Balance

**Method:** Sum of all account balances

```python
def get_entity_balance(entity_id):
    """
    Get total balance across all accounts for an entity
    """
    result = db.query_one("""
        SELECT SUM(ab.current_balance) as total
        FROM Account a
        JOIN Account_Balance ab ON a.account_id = ab.account_id
        WHERE a.entity_id = ?
          AND a.is_active = TRUE
    """, [entity_id])
    
    return result['total'] or 0
```

---

### Recalculation (When Needed)

**When to recalculate:**
- After editing/deleting old transactions
- After correcting imported data
- Periodic validation

```python
def recalculate_account_balance(account_id, from_date=None):
    """
    Recalculate running balance for all transactions after a certain date
    """
    # Get starting balance (before from_date)
    if from_date:
        previous_balance = db.query_one("""
            SELECT running_balance
            FROM Main_transaction
            WHERE account_id = ?
              AND transaction_date < ?
            ORDER BY transaction_date DESC, transaction_id DESC
            LIMIT 1
        """, [account_id, from_date])
        balance = previous_balance['running_balance'] if previous_balance else 0
    else:
        balance = 0
        from_date = '1900-01-01'  # Start from beginning
    
    # Get all transactions after from_date
    transactions = db.query("""
        SELECT transaction_id, amount, transaction_direction
        FROM Main_transaction
        WHERE account_id = ?
          AND transaction_date >= ?
        ORDER BY transaction_date ASC, transaction_id ASC
    """, [account_id, from_date])
    
    # Recalculate and update each
    for txn in transactions:
        if txn['transaction_direction'] == 'credit':
            balance += txn['amount']
        else:
            balance -= txn['amount']
        
        db.update(
            'Main_transaction',
            running_balance=balance,
            WHERE={'transaction_id': txn['transaction_id']}
        )
    
    # Update Account_Balance
    db.update(
        'Account_Balance',
        current_balance=balance,
        WHERE={'account_id': account_id}
    )
```

---

## 🛠️ Implementation Guidelines

### 1. Initial Setup

```sql
-- Create all tables in order
CREATE TABLE Entity (...);
CREATE TABLE Branch (...);
CREATE TABLE Account (...);
CREATE TABLE Account_Balance (...);
CREATE TABLE Entity_Balance (...);
CREATE TABLE Category (...);
CREATE TABLE Type (...);
CREATE TABLE Original_transaction (...);
CREATE TABLE Debt_Drawdown (...);
CREATE TABLE Main_transaction (...);

-- Initialize balances for existing accounts
INSERT INTO Account_Balance (account_id, current_balance)
SELECT account_id, 0
FROM Account;

INSERT INTO Entity_Balance (entity_id, total_balance)
SELECT entity_id, 0
FROM Entity;
```

---

### 2. Transaction Integrity Rules

**CRITICAL RULES:**

1. **Always use database transactions**
   ```sql
   START TRANSACTION;
   -- Insert/Update operations
   COMMIT;
   -- or ROLLBACK on error
   ```

2. **Validate split totals**
   ```sql
   -- Before marking split_total_validated = TRUE
   SELECT SUM(amount) FROM Main_transaction WHERE raw_transaction_id = ?
   -- Must equal Original_transaction amount
   ```

3. **Never modify Original_transaction**
   - Mark as imported and leave it
   - All edits go to Main_transaction only

4. **Keep transaction_date from original**
   - Even when splitting later
   - Use updated_at to track when split was done

5. **Lock rows when calculating balance**
   ```sql
   SELECT * FROM Account_Balance WHERE account_id = ? FOR UPDATE;
   ```

---

### 3. Performance Optimization

**Indexes:**
```sql
-- Main_transaction (most queried table)
CREATE INDEX idx_account_date ON Main_transaction(account_id, transaction_date DESC);
CREATE INDEX idx_raw_transaction ON Main_transaction(raw_transaction_id);
CREATE INDEX idx_entity_date ON Main_transaction(entity_id, transaction_date DESC);
CREATE INDEX idx_branch_date ON Main_transaction(branch_id, transaction_date DESC);

-- Original_transaction
CREATE INDEX idx_account_imported ON Original_transaction(account_id, imported_at);
```

**Partitioning (for large datasets):**
```sql
-- Partition Main_transaction by year
ALTER TABLE Main_transaction
PARTITION BY RANGE (YEAR(transaction_date)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

---

### 4. Error Handling

**Common scenarios:**

1. **Split total doesn't match original**
   ```
   Error: "Split total (48,000,000) does not equal original (50,000,000)"
   Action: Don't allow split_total_validated = TRUE
   ```

2. **Balance goes negative**
   ```
   Warning: "Account balance will be negative: -5,000,000"
   Action: Allow but flag for review (might be overdraft)
   ```

3. **Missing raw_transaction_id**
   ```
   Error: "raw_transaction_id not found in Original_transaction"
   Action: Cannot insert - data integrity violation
   ```

---

### 5. Reporting Queries

**Entity Summary:**
```sql
SELECT 
    e.entity_name,
    eb.total_balance,
    COUNT(DISTINCT a.account_id) as num_accounts,
    COUNT(DISTINCT m.transaction_id) as total_transactions
FROM Entity e
LEFT JOIN Entity_Balance eb ON e.entity_id = eb.entity_id
LEFT JOIN Account a ON e.entity_id = a.entity_id
LEFT JOIN Main_transaction m ON a.account_id = m.account_id
GROUP BY e.entity_id;
```

**Branch Performance:**
```sql
SELECT 
    b.branch_name,
    COUNT(m.transaction_id) as transaction_count,
    SUM(CASE WHEN m.transaction_direction = 'debit' THEN m.amount ELSE 0 END) as total_expense,
    SUM(CASE WHEN m.transaction_direction = 'credit' THEN m.amount ELSE 0 END) as total_income
FROM Branch b
LEFT JOIN Main_transaction m ON b.branch_id = m.branch_id
WHERE m.transaction_date >= ?
  AND m.transaction_date < ?
GROUP BY b.branch_id
ORDER BY total_expense DESC;
```

**Category Breakdown:**
```sql
SELECT 
    c.category_name,
    COUNT(m.transaction_id) as count,
    SUM(m.amount) as total
FROM Category c
JOIN Main_transaction m ON c.category_id = m.category_id
WHERE m.entity_id = ?
  AND m.transaction_date >= ?
  AND m.transaction_direction = 'debit'
GROUP BY c.category_id
ORDER BY total DESC
LIMIT 10;
```

**Debt Summary by Entity:**
```sql
SELECT 
    e.entity_name,
    a.account_name,
    a.account_type,
    a.credit_limit,
    ABS(ab.current_balance) as total_debt,
    a.credit_limit - ABS(ab.current_balance) as available_credit,
    COUNT(dd.drawdown_id) as active_drawdowns
FROM Entity e
JOIN Account a ON e.entity_id = a.entity_id
JOIN Account_Balance ab ON a.account_id = ab.account_id
LEFT JOIN Debt_Drawdown dd ON a.account_id = dd.account_id AND dd.status = 'active'
WHERE a.account_type IN ('credit_line', 'term_loan')
GROUP BY e.entity_id, a.account_id;
```

**Active Drawdowns with Due Dates:**
```sql
SELECT 
    a.account_name,
    dd.drawdown_reference,
    dd.drawdown_date,
    dd.original_amount,
    dd.remaining_balance,
    dd.original_amount - dd.remaining_balance as paid_amount,
    dd.due_date,
    DATEDIFF(dd.due_date, CURDATE()) as days_until_due,
    dd.interest_rate
FROM Debt_Drawdown dd
JOIN Account a ON dd.account_id = a.account_id
WHERE dd.status = 'active'
ORDER BY dd.due_date;
```

**Payment History for a Drawdown:**
```sql
SELECT 
    mt.transaction_date,
    mt.transaction_subtype,
    mt.amount,
    mt.description,
    mt.running_balance
FROM Main_transaction mt
WHERE mt.drawdown_id = ?
ORDER BY mt.transaction_date;
```

**Principal vs Interest Paid by Drawdown:**
```sql
SELECT 
    dd.drawdown_reference,
    dd.original_amount,
    dd.remaining_balance,
    SUM(CASE WHEN mt.transaction_subtype = 'principal' 
        THEN mt.amount ELSE 0 END) as total_principal_paid,
    SUM(CASE WHEN mt.transaction_subtype = 'interest' 
        THEN mt.amount ELSE 0 END) as total_interest_paid,
    SUM(CASE WHEN mt.transaction_subtype = 'fee' 
        THEN mt.amount ELSE 0 END) as total_fees_paid
FROM Debt_Drawdown dd
LEFT JOIN Main_transaction mt ON dd.drawdown_id = mt.drawdown_id 
    AND mt.transaction_direction = 'debit'
WHERE dd.account_id = ?
GROUP BY dd.drawdown_id;
```

**Monthly Interest Expense:**
```sql
SELECT 
    DATE_FORMAT(mt.transaction_date, '%Y-%m') as month,
    a.account_name,
    SUM(mt.amount) as total_interest
FROM Main_transaction mt
JOIN Account a ON mt.account_id = a.account_id
WHERE mt.transaction_subtype = 'interest'
  AND a.account_type IN ('credit_line', 'term_loan')
  AND a.entity_id = ?
GROUP BY month, a.account_id
ORDER BY month DESC;
```

**Overdue Drawdowns:**
```sql
SELECT 
    e.entity_name,
    a.account_name,
    dd.drawdown_reference,
    dd.remaining_balance,
    dd.due_date,
    DATEDIFF(CURDATE(), dd.due_date) as days_overdue
FROM Debt_Drawdown dd
JOIN Account a ON dd.account_id = a.account_id
JOIN Entity e ON a.entity_id = e.entity_id
WHERE dd.status = 'active'
  AND dd.due_date < CURDATE()
ORDER BY days_overdue DESC;
```

---

## 🔐 Security Considerations

1. **User Permissions**
   - Separate read/write permissions by entity
   - Users should only see entities they have access to
   - Audit trail via user_id and timestamps

2. **Data Validation**
   - Always validate amounts > 0
   - Validate dates are not in future (unless scheduled)
   - Validate foreign key references exist

3. **Backup Strategy**
   - Daily backup of Original_transaction (immutable, critical)
   - Regular backup of Main_transaction
   - Point-in-time recovery enabled

---

## 📚 Appendix

### Field Data Types Reference

| Field Type | SQL Type | Example | Notes |
|------------|----------|---------|-------|
| Money amounts | DECIMAL(15,2) | 1000000.50 | 15 digits total, 2 after decimal |
| Percentages | DECIMAL(5,2) | 12.50 | For 12.50% |
| IDs | INT / BIGINT | 1, 1001 | BIGINT for Main_transaction |
| Dates | DATE | 2025-11-01 | Just date, no time |
| Datetime | DATETIME | 2025-11-01 14:30:00 | Date with time |
| Text (short) | VARCHAR(n) | "Company A" | n = max length |
| Text (long) | TEXT | Long descriptions | No fixed limit |
| Currency | VARCHAR(3) | VND, USD, EUR | ISO 4217 codes |
| Booleans | BOOLEAN | TRUE/FALSE | Or TINYINT(1) |

---

### Common Queries Cheat Sheet

**Get current balance for account:**
```sql
SELECT current_balance FROM Account_Balance WHERE account_id = ?;
```

**Get last 50 transactions:**
```sql
SELECT * FROM Main_transaction 
WHERE account_id = ? 
ORDER BY transaction_date DESC, transaction_id DESC 
LIMIT 50;
```

**Get unreconciled transactions:**
```sql
SELECT * FROM Main_transaction 
WHERE account_id = ? AND is_reconciled = FALSE
ORDER BY transaction_date;
```

**Find split transactions:**
```sql
SELECT raw_transaction_id, COUNT(*) as split_count, SUM(amount) as total
FROM Main_transaction
GROUP BY raw_transaction_id
HAVING split_count > 1;
```

**Monthly income/expense summary:**
```sql
SELECT 
    DATE_FORMAT(transaction_date, '%Y-%m') as month,
    SUM(CASE WHEN transaction_direction = 'credit' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN transaction_direction = 'debit' THEN amount ELSE 0 END) as expense
FROM Main_transaction
WHERE account_id = ?
GROUP BY month
ORDER BY month DESC;
```

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

1. **Daily:**
   - Backup databases
   - Monitor for reconciliation mismatches

2. **Weekly:**
   - Review unreconciled transactions
   - Validate split totals

3. **Monthly:**
   - Archive old data (optional)
   - Review and optimize slow queries
   - Generate entity/branch reports

4. **Quarterly:**
   - Full reconciliation against bank statements
   - Review and update categories/types
   - Performance tuning

---

## 📖 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-03 | Initial system design with all core tables |
| 1.1 | 2025-11-03 | Added Branch_id to Main_transaction for branch-level tracking |
| 1.2 | 2025-11-04 | Added comprehensive debt management: Debt_Drawdown table, credit_line and term_loan account types, drawdown_id and transaction_subtype fields to Main_transaction |

---

## ✅ Validation Checklist

Before going live, ensure:

- [ ] All tables created with proper foreign keys
- [ ] Indexes added on frequently queried columns
- [ ] Account_Balance and Entity_Balance initialized
- [ ] Sample data inserted and tested
- [ ] Import process tested with real bank files
- [ ] Split transaction logic validated
- [ ] Balance calculation verified
- [ ] Reconciliation queries working
- [ ] Debt drawdown and payment workflows tested
- [ ] Interest vs principal payment tracking validated
- [ ] Credit limit calculations working correctly
- [ ] Backup/restore tested
- [ ] User permissions configured
- [ ] Error handling implemented
- [ ] Documentation reviewed by team

---

**End of Documentation**

*This system is designed to be flexible, scalable, and maintainable. All design decisions prioritize data integrity, audit capability, and ease of use.*
