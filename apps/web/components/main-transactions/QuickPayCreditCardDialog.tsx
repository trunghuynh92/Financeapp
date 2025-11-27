"use client"

import { useState, useEffect } from "react"
import { Loader2, CreditCard, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MainTransactionDetails } from "@/types/main-transaction"
import { formatCurrency } from "@/lib/account-utils"
import { Currency } from "@/types/account"

interface QuickPayCreditCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

interface CreditCardAccount {
  account_id: number
  account_name: string
  account_number: string | null
  bank_name: string | null
  currency: string
  current_balance: number
  credit_limit: number | null
}

export function QuickPayCreditCardDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: QuickPayCreditCardDialogProps) {
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [creditCards, setCreditCards] = useState<CreditCardAccount[]>([])
  const [selectedCard, setSelectedCard] = useState<number | null>(null)

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCreditCards()
    }
  }, [open, sourceTransaction])

  const fetchCreditCards = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch all credit card accounts for the entity
      const response = await fetch(`/api/accounts?entity_id=${sourceTransaction.entity_id}&limit=1000`)

      if (!response.ok) {
        throw new Error("Failed to fetch credit cards")
      }

      const data = await response.json()

      // Filter to credit cards only and exclude the source account
      const cards = data.data
        .filter((acc: any) =>
          acc.account_type === 'credit_card' &&
          acc.account_id !== sourceTransaction.account_id &&
          acc.is_active
        )
        .map((acc: any) => ({
          account_id: acc.account_id,
          account_name: acc.account_name,
          account_number: acc.account_number,
          bank_name: acc.bank_name,
          currency: acc.currency,
          current_balance: acc.balance?.current_balance || 0,
          credit_limit: acc.credit_limit,
        }))

      setCreditCards(cards)
    } catch (error) {
      console.error("Error fetching credit cards:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayCard = async () => {
    if (!selectedCard || !sourceTransaction) return

    setPaying(true)
    try {
      // Step 1: Get CC_PAY transaction type
      const typesResponse = await fetch('/api/transaction-types')
      const typesData = await typesResponse.json()
      const ccPayType = typesData.data.find((t: any) => t.type_code === 'CC_PAY')

      if (!ccPayType) {
        throw new Error('CC_PAY transaction type not found. Please run migration 046.')
      }

      // Step 2: Create original_transaction (this will trigger main_transaction creation)
      const createOriginalResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedCard,
          transaction_date: sourceTransaction.transaction_date,
          credit_amount: sourceTransaction.amount,
          description: `Payment from ${sourceTransaction.account_name}`,
          transaction_source: 'user_manual',
        }),
      })

      if (!createOriginalResponse.ok) {
        const errorData = await createOriginalResponse.json()
        throw new Error(errorData.error || 'Failed to create credit card payment transaction')
      }

      const originalData = await createOriginalResponse.json()
      const rawTxId = originalData.raw_transaction_id

      // Step 3: Fetch the auto-created main_transaction
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay to ensure trigger completes

      const mainTxResponse = await fetch(`/api/main-transactions?raw_transaction_id=${rawTxId}`)
      if (!mainTxResponse.ok) {
        throw new Error('Failed to fetch created main transaction')
      }

      const mainTxData = await mainTxResponse.json()
      if (!mainTxData.data || mainTxData.data.length === 0) {
        throw new Error('Main transaction was not created by trigger')
      }

      const mainTx = mainTxData.data[0]

      // Step 4: Update the main_transaction to use CC_PAY type
      const updateResponse = await fetch(`/api/main-transactions/${mainTx.main_transaction_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type_id: ccPayType.transaction_type_id,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || 'Failed to update transaction type to CC_PAY')
      }

      // Step 5: Match the two CC_PAY transactions
      const matchResponse = await fetch('/api/transfers/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_out_id: sourceTransaction.main_transaction_id,
          transfer_in_id: mainTx.main_transaction_id,
        }),
      })

      if (!matchResponse.ok) {
        const errorData = await matchResponse.json()
        throw new Error(errorData.error || 'Failed to match transactions')
      }

      // Success!
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error paying credit card:", error)
      alert(error instanceof Error ? error.message : 'Failed to process payment')
    } finally {
      setPaying(false)
    }
  }

  if (!sourceTransaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay Credit Card</DialogTitle>
          <DialogDescription>
            Select which credit card to pay with {formatCurrency(sourceTransaction.amount, sourceTransaction.currency as Currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source transaction info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Payment From</p>
                <p className="font-medium">{sourceTransaction.account_name}</p>
                <p className="text-sm text-muted-foreground">{sourceTransaction.bank_name || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(sourceTransaction.amount, sourceTransaction.currency as Currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No credit cards */}
          {!loading && creditCards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No credit cards found for this entity.</p>
              <p className="text-sm mt-2">Create a credit card account first.</p>
            </div>
          )}

          {/* Credit card list */}
          {!loading && creditCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Select Credit Card:</p>
              {creditCards.map((card) => (
                <button
                  key={card.account_id}
                  onClick={() => setSelectedCard(card.account_id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedCard === card.account_id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        <p className="font-medium">{card.account_name}</p>
                        {selectedCard === card.account_id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      {card.bank_name && (
                        <p className="text-sm text-muted-foreground mt-1">{card.bank_name}</p>
                      )}
                      {card.account_number && (
                        <p className="text-sm text-muted-foreground">
                          •••• {card.account_number.slice(-4)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Current Balance</p>
                      <p className={`font-medium ${card.current_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(card.current_balance), card.currency as any)}
                      </p>
                      {card.credit_limit && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Limit: {formatCurrency(card.credit_limit, card.currency as any)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>
            Cancel
          </Button>
          <Button onClick={handlePayCard} disabled={!selectedCard || paying}>
            {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {paying ? 'Processing...' : 'Pay Credit Card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
