"use client"

import { useState, useEffect } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { getFilteredTransactionTypes, AccountType, TransactionDirection } from "@/lib/transaction-type-rules"
import { BusinessPartner } from "@/types/business-partner"
import { CreateBusinessPartnerDialog } from "@/components/create-business-partner-dialog"
import { AccountFormDialog } from "@/components/account-form-dialog"
import { useEntity } from "@/contexts/EntityContext"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
  entity_id: string
}

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]
  onSuccess: () => void
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  accounts,
  transactionTypes,
  categories,
  branches,
  projects,
  onSuccess,
}: AddTransactionDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    account_id: "",
    transaction_date: "",
    transaction_type_id: "",
    category_id: "",
    branch_id: "",
    project_id: "",
    amount: "",
    description: "",
    partner_id: "",
    loan_disbursement_id: "",
    debt_account_id: "",
    drawdown_id: "",
    investment_account_id: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [transactionDirection, setTransactionDirection] = useState<TransactionDirection>("debit")
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [isCreatePartnerOpen, setIsCreatePartnerOpen] = useState(false)
  const [loanDisbursements, setLoanDisbursements] = useState<any[]>([])
  const [debtAccounts, setDebtAccounts] = useState<Account[]>([])
  const [investmentAccounts, setInvestmentAccounts] = useState<Account[]>([])
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)
  const [activeDrawdowns, setActiveDrawdowns] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      const now = new Date()
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)

      setFormData({
        account_id: "",
        transaction_date: localDateTime,
        transaction_type_id: "",
        category_id: "",
        branch_id: "",
        project_id: "",
        amount: "",
        description: "",
        partner_id: "",
        loan_disbursement_id: "",
        debt_account_id: "",
        drawdown_id: "",
        investment_account_id: "",
      })
      setErrors({})
      setSelectedAccount(null)
      setTransactionDirection("debit")
      setLoanDisbursements([])
      setDebtAccounts([])
      setActiveDrawdowns([])
      setInvestmentAccounts([])

      // Fetch partners for loan operations
      if (currentEntity) {
        fetchPartners()
        fetchDebtAccounts()
        fetchInvestmentAccounts()
      }
    }
  }, [open, currentEntity])

  async function fetchPartners() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/business-partners?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        setPartners(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    }
  }

  async function fetchDebtAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only term_loan and credit_line accounts
        const debtAccs = (data.data || []).filter((acc: Account) =>
          acc.account_type === 'term_loan' || acc.account_type === 'credit_line'
        )
        setDebtAccounts(debtAccs)
      }
    } catch (error) {
      console.error('Error fetching debt accounts:', error)
    }
  }

  async function fetchInvestmentAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only investment accounts
        const investAccs = (data.data || []).filter((acc: Account) =>
          acc.account_type === 'investment'
        )
        setInvestmentAccounts(investAccs)
      }
    } catch (error) {
      console.error('Error fetching investment accounts:', error)
    }
  }

  function handlePartnerCreated(partner: BusinessPartner) {
    setPartners([...partners, partner])
    setFormData({ ...formData, partner_id: partner.partner_id.toString() })
    setIsCreatePartnerOpen(false)
  }

  async function handleAccountCreated() {
    // Refresh debt accounts list
    await fetchDebtAccounts()
    setIsCreateAccountOpen(false)
    // The newly created account will be in the list, but we don't auto-select it
    // since the AccountFormDialog doesn't return the created account ID
  }

  async function fetchLoanDisbursements() {
    if (!currentEntity || !formData.partner_id) return

    try {
      // Fetch all loan receivable accounts for this entity
      const accountsResponse = await fetch(`/api/accounts?entity_id=${currentEntity.id}&account_type=loan_receivable`)
      if (!accountsResponse.ok) return

      const accountsData = await accountsResponse.json()
      const loanAccounts = accountsData.data || []

      // Fetch all active loan disbursements for this partner
      const allLoans: any[] = []
      for (const account of loanAccounts) {
        const response = await fetch(`/api/loan-disbursements?account_id=${account.account_id}`)
        if (response.ok) {
          const data = await response.json()
          const partnerLoans = (data.data || []).filter(
            (loan: any) => loan.partner_id === parseInt(formData.partner_id) && loan.status === 'active' && loan.remaining_balance > 0
          )
          allLoans.push(...partnerLoans)
        }
      }

      setLoanDisbursements(allLoans)
    } catch (error) {
      console.error('Error fetching loan disbursements:', error)
    }
  }

  async function fetchActiveDrawdowns() {
    if (!formData.debt_account_id) return

    try {
      const response = await fetch(`/api/debt/drawdowns?account_id=${formData.debt_account_id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only active drawdowns with remaining balance
        const active = (data.data || []).filter(
          (drawdown: any) => drawdown.status === 'active' && drawdown.remaining_balance > 0
        )
        setActiveDrawdowns(active)
      }
    } catch (error) {
      console.error('Error fetching drawdowns:', error)
      setActiveDrawdowns([])
    }
  }

  // Update selected account when account_id changes
  useEffect(() => {
    if (formData.account_id) {
      const account = accounts.find(a => a.account_id.toString() === formData.account_id)
      setSelectedAccount(account || null)
    } else {
      setSelectedAccount(null)
    }
  }, [formData.account_id, accounts])

  // Get filtered transaction types based on account type and direction
  const filteredTransactionTypes = selectedAccount
    ? getFilteredTransactionTypes(
        selectedAccount.account_type as AccountType,
        transactionDirection,
        transactionTypes
      )
    : []

  // Get filtered categories based on selected transaction type
  const selectedTransactionType = transactionTypes.find(
    t => t.transaction_type_id.toString() === formData.transaction_type_id
  )

  // Categories are filtered by transaction_type_id
  // For types like CC_CHARGE that share categories with EXP, we need to look up by type_code
  const filteredCategories = categories.filter(cat => {
    if (!selectedTransactionType) return false

    // Direct match by transaction_type_id
    if (cat.transaction_type_id === selectedTransactionType.transaction_type_id) {
      return true
    }

    // For CC_CHARGE, also show EXP categories (they share the same categories)
    if (selectedTransactionType.type_code === 'CC_CHARGE') {
      const expType = transactionTypes.find(t => t.type_code === 'EXP')
      if (expType && cat.transaction_type_id === expType.transaction_type_id) {
        return true
      }
    }

    return false
  })

  // Check if category is required (Income and Expense transactions require categories)
  const isCategoryRequired = selectedTransactionType?.type_code === 'INC' || selectedTransactionType?.type_code === 'EXP'

  // Check if this is a loan disbursement (requires borrower)
  const isLoanDisbursement = selectedTransactionType?.type_code === 'LOAN_DISBURSE'

  // Check if this is a loan collection (requires borrower and loan selection)
  const isLoanCollection = selectedTransactionType?.type_code === 'LOAN_COLLECT'

  // Check if this is debt taken (requires debt account selection)
  const isDebtTake = selectedTransactionType?.type_code === 'DEBT_TAKE'

  // Check if this is debt payback (requires debt account and drawdown selection)
  const isDebtPayback = selectedTransactionType?.type_code === 'DEBT_PAY'

  // Check if this is investment contribution (requires investment account selection)
  const isInvestmentContribution = selectedTransactionType?.type_code === 'INV_CONTRIB'

  // Check if this is investment withdrawal (requires investment account selection)
  const isInvestmentWithdrawal = selectedTransactionType?.type_code === 'INV_WITHDRAW'

  // Fetch loan disbursements when partner is selected (for LOAN_COLLECT)
  useEffect(() => {
    if (isLoanCollection && formData.partner_id && currentEntity) {
      fetchLoanDisbursements()
    } else {
      setLoanDisbursements([])
      if (formData.loan_disbursement_id) {
        setFormData(prev => ({ ...prev, loan_disbursement_id: "" }))
      }
    }
  }, [formData.partner_id, isLoanCollection, currentEntity])

  // Fetch active drawdowns when debt account is selected (for DEBT_PAY)
  useEffect(() => {
    if (isDebtPayback && formData.debt_account_id) {
      fetchActiveDrawdowns()
    } else {
      setActiveDrawdowns([])
      if (formData.drawdown_id) {
        setFormData(prev => ({ ...prev, drawdown_id: "" }))
      }
    }
  }, [formData.debt_account_id, isDebtPayback])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!formData.account_id) {
      newErrors.account_id = "Please select an account"
    }
    if (!formData.transaction_date) {
      newErrors.transaction_date = "Transaction date is required"
    }
    if (!formData.transaction_type_id) {
      newErrors.transaction_type_id = "Please select a transaction type"
    }
    if (isCategoryRequired && !formData.category_id) {
      newErrors.category_id = "Category is required for this transaction type"
    }
    if (isLoanDisbursement && !formData.partner_id) {
      newErrors.partner_id = "Borrower is required for loan disbursement"
    }
    if (isLoanCollection && !formData.partner_id) {
      newErrors.partner_id = "Borrower is required for loan collection"
    }
    if (isLoanCollection && !formData.loan_disbursement_id) {
      newErrors.loan_disbursement_id = "Please select which loan this payment is for"
    }
    if (isDebtTake && !formData.debt_account_id) {
      newErrors.debt_account_id = "Please select which credit line/term loan this drawdown is from"
    }
    if (isDebtPayback && !formData.debt_account_id) {
      newErrors.debt_account_id = "Please select which credit line/term loan you're paying back"
    }
    if (isDebtPayback && !formData.drawdown_id) {
      newErrors.drawdown_id = "Please select which drawdown you're paying back"
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    try {
      setLoading(true)

      const amountValue = parseFloat(formData.amount)

      // Use the optimized endpoint that handles all steps in one request
      const transactionData: any = {
        account_id: parseInt(formData.account_id),
        transaction_date: new Date(formData.transaction_date).toISOString(),
        description: formData.description || null,
        transaction_source: 'user_manual',
        transaction_type_id: parseInt(formData.transaction_type_id),
      }

      // Set debit or credit based on direction
      if (transactionDirection === 'debit') {
        transactionData.debit_amount = amountValue
      } else {
        transactionData.credit_amount = amountValue
      }

      // Add optional fields
      if (formData.category_id) {
        transactionData.category_id = parseInt(formData.category_id)
      }

      if (formData.branch_id) {
        transactionData.branch_id = parseInt(formData.branch_id)
      }

      if (formData.project_id) {
        transactionData.project_id = parseInt(formData.project_id)
      }

      if (formData.partner_id) {
        transactionData.partner_id = parseInt(formData.partner_id)
      }

      if (formData.loan_disbursement_id) {
        transactionData.loan_disbursement_id = parseInt(formData.loan_disbursement_id)
      }

      if (formData.debt_account_id) {
        transactionData.debt_account_id = parseInt(formData.debt_account_id)
      }

      if (formData.drawdown_id) {
        transactionData.drawdown_id = parseInt(formData.drawdown_id)
      }

      const createResponse = await fetch('/api/main-transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create transaction')
      }

      // Success!
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating transaction:', error)
      alert(error instanceof Error ? error.message : 'Failed to create transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Transaction
          </DialogTitle>
          <DialogDescription>
            Create a new transaction with proper categorization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account_id">
              Account <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => {
                setFormData({ ...formData, account_id: value, transaction_type_id: "" })
              }}
            >
              <SelectTrigger id="account_id" className={errors.account_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id.toString()}>
                    {account.account_name} {account.bank_name && `(${account.bank_name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.account_id && (
              <p className="text-sm text-red-500">{errors.account_id}</p>
            )}
          </div>

          {/* Date-Time */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date">
              Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="transaction_date"
              type="datetime-local"
              value={formData.transaction_date}
              onChange={(e) =>
                setFormData({ ...formData, transaction_date: e.target.value })
              }
              className={errors.transaction_date ? "border-red-500" : ""}
            />
            {errors.transaction_date && (
              <p className="text-sm text-red-500">{errors.transaction_date}</p>
            )}
          </div>

          {/* Transaction Direction */}
          {selectedAccount && (
            <div className="space-y-2">
              <Label>Transaction Direction <span className="text-red-500">*</span></Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    value="debit"
                    checked={transactionDirection === "debit"}
                    onChange={(e) => {
                      setTransactionDirection(e.target.value as TransactionDirection)
                      setFormData({ ...formData, transaction_type_id: "" })
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    Debit <span className="text-red-600">(Money Out)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    value="credit"
                    checked={transactionDirection === "credit"}
                    onChange={(e) => {
                      setTransactionDirection(e.target.value as TransactionDirection)
                      setFormData({ ...formData, transaction_type_id: "" })
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    Credit <span className="text-green-600">(Money In)</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Transaction Type */}
          {selectedAccount && (
            <div className="space-y-2">
              <Label htmlFor="transaction_type_id">
                Transaction Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.transaction_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, transaction_type_id: value, category_id: "" })
                }
              >
                <SelectTrigger id="transaction_type_id" className={errors.transaction_type_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTransactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.transaction_type_id && (
                <p className="text-sm text-red-500">{errors.transaction_type_id}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Borrower (for Loan Disbursement) */}
          {isLoanDisbursement && (
            <div className="space-y-2">
              <Label htmlFor="partner_id">
                Borrower <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.partner_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, partner_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger id="partner_id" className={`flex-1 ${errors.partner_id ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select borrower" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a borrower</SelectItem>
                    {partners.map((partner) => (
                      <SelectItem key={partner.partner_id} value={partner.partner_id.toString()}>
                        {partner.display_name || partner.partner_name} ({partner.partner_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCreatePartnerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.partner_id && (
                <p className="text-sm text-red-500">{errors.partner_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Select who is borrowing the money
              </p>
            </div>
          )}

          {/* Debt Account Selection (for Debt Taken) */}
          {isDebtTake && (
            <div className="space-y-2">
              <Label htmlFor="debt_account_id">
                Which Credit Line/Term Loan? <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.debt_account_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, debt_account_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger id="debt_account_id" className={`flex-1 ${errors.debt_account_id ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select debt account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an account</SelectItem>
                    {debtAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name} ({account.account_type === 'credit_line' ? 'Credit Line' : 'Term Loan'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCreateAccountOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.debt_account_id && (
                <p className="text-sm text-red-500">{errors.debt_account_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Select which credit line or term loan this drawdown is from
              </p>
            </div>
          )}

          {/* Debt Account & Drawdown Selection (for Debt Payback) */}
          {isDebtPayback && (
            <>
              <div className="space-y-2">
                <Label htmlFor="debt_account_id_payback">
                  Which Credit Line/Term Loan? <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.debt_account_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, debt_account_id: value === "none" ? "" : value, drawdown_id: "" })
                  }
                >
                  <SelectTrigger id="debt_account_id_payback" className={errors.debt_account_id ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select debt account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an account</SelectItem>
                    {debtAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name} ({account.account_type === 'credit_line' ? 'Credit Line' : 'Term Loan'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.debt_account_id && (
                  <p className="text-sm text-red-500">{errors.debt_account_id}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Select which credit line or term loan you're paying back
                </p>
              </div>

              {formData.debt_account_id && activeDrawdowns.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="drawdown_id">
                    Which Drawdown? <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.drawdown_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, drawdown_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger id="drawdown_id" className={errors.drawdown_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select drawdown" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a drawdown</SelectItem>
                      {activeDrawdowns.map((drawdown: any) => (
                        <SelectItem key={drawdown.drawdown_id} value={drawdown.drawdown_id.toString()}>
                          {drawdown.drawdown_reference} - {parseFloat(drawdown.remaining_balance).toLocaleString()}₫ remaining
                          {drawdown.due_date && ` (Due: ${new Date(drawdown.due_date).toLocaleDateString()})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.drawdown_id && (
                    <p className="text-sm text-red-500">{errors.drawdown_id}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select which specific drawdown this payment is for
                  </p>
                </div>
              )}

              {formData.debt_account_id && activeDrawdowns.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active drawdowns found for this account.
                </p>
              )}
            </>
          )}

          {/* Borrower & Loan Selection (for Loan Collection) */}
          {isLoanCollection && (
            <>
              <div className="space-y-2">
                <Label htmlFor="partner_id_collect">
                  Borrower <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.partner_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, partner_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger id="partner_id_collect" className={`flex-1 ${errors.partner_id ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select borrower" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a borrower</SelectItem>
                      {partners.map((partner) => (
                        <SelectItem key={partner.partner_id} value={partner.partner_id.toString()}>
                          {partner.display_name || partner.partner_name} ({partner.partner_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsCreatePartnerOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {errors.partner_id && (
                  <p className="text-sm text-red-500">{errors.partner_id}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Who is paying back the loan?
                </p>
              </div>

              {formData.partner_id && loanDisbursements.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="loan_disbursement_id">
                    Which Loan? <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.loan_disbursement_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, loan_disbursement_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger id="loan_disbursement_id" className={errors.loan_disbursement_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select loan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a loan</SelectItem>
                      {loanDisbursements.map((loan) => (
                        <SelectItem key={loan.loan_disbursement_id} value={loan.loan_disbursement_id.toString()}>
                          {new Date(loan.disbursement_date).toLocaleDateString()} - {loan.principal_amount.toLocaleString()} VND
                          (Remaining: {loan.remaining_balance.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.loan_disbursement_id && (
                    <p className="text-sm text-red-500">{errors.loan_disbursement_id}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select which loan this payment is for
                  </p>
                </div>
              )}

              {formData.partner_id && loanDisbursements.length === 0 && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  No active loans found for this borrower
                </div>
              )}
            </>
          )}

          {/* Investment Account Selection (for INV_CONTRIB and INV_WITHDRAW) */}
          {(isInvestmentContribution || isInvestmentWithdrawal) && (
            <div className="space-y-2">
              <Label htmlFor="investment_account_id">
                Investment Account <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.investment_account_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, investment_account_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="investment_account_id" className={errors.investment_account_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select investment account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select an investment account</SelectItem>
                  {investmentAccounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id.toString()}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.investment_account_id && (
                <p className="text-sm text-red-500">{errors.investment_account_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isInvestmentContribution
                  ? "Select which investment account is receiving the funds"
                  : "Select which investment account is being withdrawn from"}
              </p>
              {investmentAccounts.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  No investment accounts found. Create one first or the system will auto-create one.
                </p>
              )}
            </div>
          )}

          {/* Category */}
          {formData.transaction_type_id && (
            <div className="space-y-2">
              <Label htmlFor="category_id">
                Category {isCategoryRequired && <span className="text-red-500">*</span>}
              </Label>
              <Select
                value={formData.category_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="category_id" className={errors.category_id ? "border-red-500" : ""}>
                  <SelectValue placeholder={isCategoryRequired ? "Select category" : "None (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {!isCategoryRequired && (
                    <SelectItem value="none">None</SelectItem>
                  )}
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-sm text-red-500">{errors.category_id}</p>
              )}
            </div>
          )}

          {/* Branch (Optional) */}
          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch (optional)</Label>
              <Select
                value={formData.branch_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, branch_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="branch_id">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project (Optional) */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="project_id">Project (optional)</Label>
              <Select
                value={formData.project_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, project_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id.toString()}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter transaction description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Creating...' : 'Add Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {currentEntity && (
        <>
          <CreateBusinessPartnerDialog
            open={isCreatePartnerOpen}
            onOpenChange={setIsCreatePartnerOpen}
            entityId={currentEntity.id}
            onSuccess={handlePartnerCreated}
            defaultPartnerType="borrower"
          />
          <AccountFormDialog
            open={isCreateAccountOpen}
            onOpenChange={setIsCreateAccountOpen}
            onSuccess={handleAccountCreated}
            allowedAccountTypes={['credit_line', 'term_loan']}
          />
        </>
      )}
    </Dialog>
  )
}
