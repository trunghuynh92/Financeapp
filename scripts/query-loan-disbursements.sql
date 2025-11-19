-- ============================================================================
-- Query: Loan Disbursements with Borrower Details
-- Purpose: Fetch all loan disbursement data matching the UI display
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Get detailed loan disbursement data
SELECT
    ld.loan_disbursement_id AS id,
    ld.account_id,
    a.account_name,

    -- Borrower info (from business_partners or legacy field)
    COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
    bp.partner_type AS borrower_type,

    -- Loan details
    ld.loan_category,
    ld.principal_amount,
    ld.remaining_balance,

    -- Calculate paid amount and progress
    (ld.principal_amount - ld.remaining_balance) AS paid_amount,
    ROUND(
        ((ld.principal_amount - ld.remaining_balance) / ld.principal_amount * 100)::NUMERIC,
        2
    ) AS progress_percentage,

    -- Dates
    ld.disbursement_date,
    ld.due_date,
    ld.term_months,

    -- Status
    ld.status,
    ld.is_overpaid,

    -- Additional info
    ld.interest_rate,
    ld.notes,
    ld.created_at,
    ld.updated_at

FROM loan_disbursement ld
LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
INNER JOIN accounts a ON ld.account_id = a.account_id
ORDER BY ld.disbursement_date DESC;

-- ============================================================================
-- Summary Statistics
-- ============================================================================

SELECT
    'Summary Statistics' AS report_section,

    -- Total outstanding balance
    SUM(ld.remaining_balance) AS total_outstanding,

    -- Count active loans
    COUNT(CASE WHEN ld.status = 'active' THEN 1 END) AS active_loans_count,
    COUNT(*) AS total_loans_count,

    -- Next due date
    MIN(CASE WHEN ld.status = 'active' AND ld.due_date >= CURRENT_DATE THEN ld.due_date END) AS next_due_date,

    -- Overdue count
    COUNT(CASE WHEN ld.status = 'overdue' THEN 1 END) AS overdue_loans_count,

    -- Repaid count
    COUNT(CASE WHEN ld.status = 'repaid' THEN 1 END) AS repaid_loans_count

FROM loan_disbursement ld
INNER JOIN accounts a ON ld.account_id = a.account_id;

-- ============================================================================
-- Breakdown by Borrower Type
-- ============================================================================

SELECT
    'By Borrower Type' AS report_section,
    COALESCE(bp.partner_type::TEXT, 'No Type') AS borrower_type,
    COUNT(*) AS loan_count,
    SUM(ld.principal_amount) AS total_principal,
    SUM(ld.remaining_balance) AS total_remaining,
    SUM(ld.principal_amount - ld.remaining_balance) AS total_paid,
    ROUND(
        SUM(ld.principal_amount - ld.remaining_balance) / NULLIF(SUM(ld.principal_amount), 0) * 100,
        2
    ) AS overall_progress_pct
FROM loan_disbursement ld
LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
GROUP BY bp.partner_type
ORDER BY total_remaining DESC;

-- ============================================================================
-- Breakdown by Status
-- ============================================================================

SELECT
    'By Status' AS report_section,
    ld.status,
    COUNT(*) AS loan_count,
    SUM(ld.principal_amount) AS total_principal,
    SUM(ld.remaining_balance) AS total_remaining
FROM loan_disbursement ld
GROUP BY ld.status
ORDER BY
    CASE ld.status
        WHEN 'overdue' THEN 1
        WHEN 'active' THEN 2
        WHEN 'repaid' THEN 3
        ELSE 4
    END;

-- ============================================================================
-- Check for Balance Calculation Issues
-- ============================================================================

SELECT
    'Balance Verification' AS report_section,
    ld.loan_disbursement_id,
    COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
    ld.principal_amount,
    ld.remaining_balance,

    -- Calculate expected balance based on LOAN_RECEIVE transactions
    ld.principal_amount - COALESCE((
        SELECT SUM(mt.amount)
        FROM main_transaction mt
        JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
        WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
        AND tt.type_code = 'LOAN_RECEIVE'
    ), 0) AS expected_remaining,

    -- Show discrepancy
    ld.remaining_balance - (
        ld.principal_amount - COALESCE((
            SELECT SUM(mt.amount)
            FROM main_transaction mt
            JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
            WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
            AND tt.type_code = 'LOAN_RECEIVE'
        ), 0)
    ) AS balance_discrepancy

FROM loan_disbursement ld
LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
WHERE ABS(
    ld.remaining_balance - (
        ld.principal_amount - COALESCE((
            SELECT SUM(mt.amount)
            FROM main_transaction mt
            JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
            WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
            AND tt.type_code = 'LOAN_RECEIVE'
        ), 0)
    )
) > 0.01  -- Show only if discrepancy > 1 cent
ORDER BY ABS(balance_discrepancy) DESC;

-- ============================================================================
-- Transaction Details for Each Loan
-- ============================================================================

SELECT
    'Payment History' AS report_section,
    ld.loan_disbursement_id,
    COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
    tt.type_display_name AS transaction_type,
    mt.transaction_date,
    mt.amount,
    mt.description,
    mt.main_transaction_id
FROM loan_disbursement ld
LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
LEFT JOIN main_transaction mt ON ld.loan_disbursement_id = mt.loan_disbursement_id
LEFT JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
WHERE mt.main_transaction_id IS NOT NULL
ORDER BY ld.loan_disbursement_id, mt.transaction_date DESC;
