"use client"

import { useState, useEffect } from "react"
import { Loader2, Building2, Wallet, CreditCard, TrendingUp, LineChart, FileText } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DatePicker } from "@/components/ui/date-picker"
import { supabase, type Entity } from "@/lib/supabase"
import type { Account, AccountType, Currency, CreateAccountInput, UpdateAccountInput } from "@/types/account"
import { ACCOUNT_TYPE_CONFIG, CURRENCIES } from "@/types/account"
import { requiresBankInfo, requiresCreditLimit, validateAccountNumber } from "@/lib/account-utils"

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  onSuccess: () => void
}

export function AccountFormDialog({ open, onOpenChange, account, onSuccess }: AccountFormDialogProps) {
  const isEditing = !!account

  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  const [formData, setFormData] = useState({
    entity_id: "",
    account_name: "",
    account_type: "bank" as AccountType,
    currency: "VND" as Currency,
    account_number: "",
    bank_name: "",
    credit_limit: "",
    loan_reference: "",
    initial_balance: "",
    opening_balance_notes: "",
  })

  const [openingBalanceDate, setOpeningBalanceDate] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      fetchEntities()
      if (account) {
        // Populate form for editing
        setFormData({
          entity_id: account.entity_id,
          account_name: account.account_name,
          account_type: account.account_type,
          currency: account.currency,
          account_number: account.account_number || "",
          bank_name: account.bank_name || "",
          credit_limit: account.credit_limit?.toString() || "",
          loan_reference: account.loan_reference || "",
          initial_balance: "",
        })
      } else {
        // Reset form for adding
        setFormData({
          entity_id: "",
          account_name: "",
          account_type: "bank",
          currency: "VND",
          account_number: "",
          bank_name: "",
          credit_limit: "",
          loan_reference: "",
          initial_balance: "",
          opening_balance_notes: "",
        })
        setOpeningBalanceDate(new Date().toISOString().split('T')[0])
      }
      setStep(1)
      setErrors({})
    }
  }, [open, account])

  async function fetchEntities() {
    try {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .order("name")

      if (error) throw error
      setEntities(data || [])
    } catch (error) {
      console.error("Error fetching entities:", error)
    }
  }

  function validateStep1(): boolean {
    const newErrors: Record<string, string> = {}

    if (!formData.entity_id) {
      newErrors.entity_id = "Please select an entity"
    }
    if (!formData.account_name.trim()) {
      newErrors.account_name = "Account name is required"
    }
    if (!formData.account_type) {
      newErrors.account_type = "Please select an account type"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function validateStep2(): boolean {
    const newErrors: Record<string, string> = {}

    if (requiresBankInfo(formData.account_type)) {
      if (!formData.bank_name.trim()) {
        newErrors.bank_name = "Bank name is required for this account type"
      }
    }

    if (formData.account_number && !validateAccountNumber(formData.account_number)) {
      newErrors.account_number = "Invalid account number format"
    }

    if (requiresCreditLimit(formData.account_type)) {
      if (!formData.credit_limit || parseFloat(formData.credit_limit) <= 0) {
        newErrors.credit_limit = "Credit limit is required and must be positive"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleNext() {
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  function handleBack() {
    setStep(step - 1)
    setErrors({})
  }

  async function handleSubmit() {
    if (!validateStep1() || !validateStep2()) return

    try {
      setLoading(true)

      if (isEditing) {
        // Update existing account
        const updateData: UpdateAccountInput = {
          account_name: formData.account_name,
          account_type: formData.account_type,
          currency: formData.currency,
          account_number: formData.account_number || undefined,
          bank_name: formData.bank_name || undefined,
          credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
          loan_reference: formData.loan_reference || undefined,
        }

        const response = await fetch(`/api/accounts/${account!.account_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update account")
        }
      } else {
        // Create new account
        const createData: CreateAccountInput = {
          entity_id: formData.entity_id,
          account_name: formData.account_name,
          account_type: formData.account_type,
          currency: formData.currency,
          account_number: formData.account_number || undefined,
          bank_name: formData.bank_name || undefined,
          credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
          loan_reference: formData.loan_reference || undefined,
          initial_balance: formData.initial_balance ? parseFloat(formData.initial_balance) : undefined,
          opening_balance_date: openingBalanceDate || undefined,
          opening_balance_notes: formData.opening_balance_notes || undefined,
        }

        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create account")
        }

        // Check for warnings in the response
        const result = await response.json()
        if (result.warning) {
          console.warn('⚠️ Checkpoint warning:', result.warning)
          alert(`⚠️ ${result.warning}`)
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error saving account:", error)
      alert(error.message || "Failed to save account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const accountTypeIcons = {
    bank: Building2,
    cash: Wallet,
    credit_card: CreditCard,
    investment: TrendingUp,
    credit_line: LineChart,
    term_loan: FileText,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Account" : "Add New Account"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Basic account information"}
            {step === 2 && "Account details"}
            {step === 3 && "Initial balance (optional)"}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full ${
                s === step ? "bg-primary" : s < step ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="space-y-4 py-4">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="entity">Entity *</Label>
                <Select
                  value={formData.entity_id}
                  onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                  disabled={isEditing}
                >
                  <SelectTrigger id="entity">
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.entity_id && (
                  <p className="text-sm text-destructive">{errors.entity_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Business Account"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                />
                {errors.account_name && (
                  <p className="text-sm text-destructive">{errors.account_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Account Type *</Label>
                <RadioGroup
                  value={formData.account_type}
                  onValueChange={(value: AccountType) =>
                    setFormData({ ...formData, account_type: value })
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((type) => {
                    const config = ACCOUNT_TYPE_CONFIG[type]
                    const Icon = accountTypeIcons[type]
                    return (
                      <div key={type}>
                        <RadioGroupItem
                          value={type}
                          id={type}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={type}
                          className={`flex items-center gap-3 rounded-lg border-2 border-muted p-4 cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5`}
                        >
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{config.label}</p>
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </RadioGroup>
                {errors.account_type && (
                  <p className="text-sm text-destructive">{errors.account_type}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: Currency) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Account Details */}
          {step === 2 && (
            <>
              {requiresBankInfo(formData.account_type) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name *</Label>
                    <Input
                      id="bank_name"
                      placeholder="e.g., Vietcombank"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    />
                    {errors.bank_name && (
                      <p className="text-sm text-destructive">{errors.bank_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input
                      id="account_number"
                      placeholder="e.g., 1234567890"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    />
                    {errors.account_number && (
                      <p className="text-sm text-destructive">{errors.account_number}</p>
                    )}
                  </div>
                </>
              )}

              {formData.account_type === "cash" && (
                <div className="space-y-2">
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Office Safe"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Where is this cash kept?
                  </p>
                </div>
              )}

              {requiresCreditLimit(formData.account_type) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="credit_limit">Credit Limit *</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      placeholder="e.g., 100000000"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    />
                    {errors.credit_limit && (
                      <p className="text-sm text-destructive">{errors.credit_limit}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loan_reference">Loan Reference</Label>
                    <Input
                      id="loan_reference"
                      placeholder="e.g., LOAN-2024-001"
                      value={formData.loan_reference}
                      onChange={(e) => setFormData({ ...formData, loan_reference: e.target.value })}
                    />
                  </div>
                </>
              )}

              {!requiresBankInfo(formData.account_type) && !requiresCreditLimit(formData.account_type) && formData.account_type !== "cash" && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No additional details required for this account type.</p>
                </div>
              )}
            </>
          )}

          {/* Step 3: Initial Balance */}
          {step === 3 && !isEditing && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4">
                <p className="text-sm text-blue-900 font-medium mb-1">💡 Balance Checkpoint System</p>
                <p className="text-xs text-blue-700">
                  When you enter a starting balance, the system creates a "checkpoint" to track your declared balance.
                  Any unexplained amount will be flagged until you add historical transactions.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_balance">Starting Balance (Optional)</Label>
                <Input
                  id="initial_balance"
                  type="number"
                  placeholder="0.00"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the current balance for this account. Leave empty to start at 0.
                </p>
              </div>

              <div className="space-y-2">
                <DatePicker
                  label="Balance Date *"
                  value={openingBalanceDate}
                  onChange={setOpeningBalanceDate}
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  The date you know this balance (e.g., bank statement date)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening_balance_notes">Notes (Optional)</Label>
                <Input
                  id="opening_balance_notes"
                  placeholder="e.g., From March bank statement"
                  value={formData.opening_balance_notes}
                  onChange={(e) => setFormData({ ...formData, opening_balance_notes: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Document where this balance came from
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || loading}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              {step < 3 ? (
                <Button onClick={handleNext} disabled={loading}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>{isEditing ? "Update Account" : "Create Account"}</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
