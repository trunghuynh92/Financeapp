"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Link2, Link2Off, ArrowDown, ArrowUp } from "lucide-react"
import { MainTransactionDetails } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"

export default function TransfersPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const [loading, setLoading] = useState(true)
  const [transfersOut, setTransfersOut] = useState<MainTransactionDetails[]>([])
  const [transfersIn, setTransfersIn] = useState<MainTransactionDetails[]>([])
  const [matchedTransfers, setMatchedTransfers] = useState<MainTransactionDetails[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedOut, setSelectedOut] = useState<number | null>(null)
  const [selectedIn, setSelectedIn] = useState<number | null>(null)
  const [matching, setMatching] = useState(false)
  const [showMatched, setShowMatched] = useState(false)

  useEffect(() => {
    if (currentEntity) {
      fetchAccounts()
      fetchUnmatchedTransfers()
      if (showMatched) {
        fetchMatchedTransfers()
      }
    }
  }, [currentEntity?.id, selectedAccount, showMatched])

  const fetchAccounts = async () => {
    try {
      if (!currentEntity) return

      const params = new URLSearchParams()
      params.set('entity_id', currentEntity.id)
      params.set('limit', '1000')

      const response = await fetch(`/api/accounts?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.data || [])
      }
    } catch (error) {
      console.error("Error fetching accounts:", error)
    }
  }

  const fetchUnmatchedTransfers = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("entity_id", currentEntity.id)
      if (selectedAccount !== "all") {
        params.append("account_id", selectedAccount)
      }

      const response = await fetch(`/api/transfers/unmatched?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch unmatched transfers")
      }

      const data = await response.json()
      setTransfersOut(data.transfersOut || [])
      setTransfersIn(data.transfersIn || [])
    } catch (error) {
      console.error("Error fetching unmatched transfers:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMatchedTransfers = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedAccount !== "all") {
        params.append("account_id", selectedAccount)
      }

      const response = await fetch(`/api/transfers/matched?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch matched transfers")
      }

      const data = await response.json()
      setMatchedTransfers(data.data || [])
    } catch (error) {
      console.error("Error fetching matched transfers:", error)
    }
  }

  const handleMatch = async () => {
    if (!selectedOut || !selectedIn) {
      alert("Please select both a Transfer Out and Transfer In to match")
      return
    }

    setMatching(true)
    try {
      const response = await fetch("/api/transfers/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transfer_out_id: selectedOut,
          transfer_in_id: selectedIn,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to match transfers")
      }

      alert("Transfers matched successfully!")
      setSelectedOut(null)
      setSelectedIn(null)
      fetchUnmatchedTransfers()
      if (showMatched) {
        fetchMatchedTransfers()
      }
    } catch (error: any) {
      console.error("Error matching transfers:", error)
      alert(error.message || "Failed to match transfers. Please try again.")
    } finally {
      setMatching(false)
    }
  }

  const handleUnmatch = async (transactionId: number) => {
    if (!confirm("Are you sure you want to unmatch this transfer? Both transactions will become unmatched.")) {
      return
    }

    try {
      const response = await fetch(`/api/transfers/unmatch/${transactionId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to unmatch transfer")
      }

      alert("Transfer unmatched successfully!")
      fetchUnmatchedTransfers()
      if (showMatched) {
        fetchMatchedTransfers()
      }
    } catch (error: any) {
      console.error("Error unmatching transfer:", error)
      alert(error.message || "Failed to unmatch transfer. Please try again.")
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const renderTransferRow = (
    transfer: MainTransactionDetails,
    type: 'out' | 'in',
    isSelected: boolean,
    onSelect: () => void
  ) => (
    <tr
      key={transfer.main_transaction_id}
      className={`border-b hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-primary/10 border-primary' : ''}`}
      onClick={onSelect}
    >
      <td className="py-3 px-4">
        <input
          type="radio"
          checked={isSelected}
          onChange={onSelect}
          className="mr-2"
        />
      </td>
      <td className="py-3 px-4 whitespace-nowrap">{formatDate(transfer.transaction_date)}</td>
      <td className="py-3 px-4">
        <div className="font-medium">{transfer.account_name}</div>
        {transfer.bank_name && (
          <div className="text-xs text-muted-foreground">{transfer.bank_name}</div>
        )}
      </td>
      <td className="py-3 px-4">
        {transfer.description || <span className="text-muted-foreground italic">No description</span>}
      </td>
      <td className="py-3 px-4 text-right font-mono font-medium">
        {formatAmount(transfer.amount)}
      </td>
      <td className="py-3 px-4">
        <Badge variant={type === 'out' ? 'destructive' : 'default'}>
          {type === 'out' ? (
            <>
              <ArrowUp className="h-3 w-3 mr-1" />
              Transfer Out
            </>
          ) : (
            <>
              <ArrowDown className="h-3 w-3 mr-1" />
              Transfer In
            </>
          )}
        </Badge>
      </td>
    </tr>
  )

  // Show loading while entity context is loading
  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Show empty state if no entity selected
  if (!currentEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Entity Selected</h2>
        <p className="text-muted-foreground mb-4">
          Please select an entity from the sidebar to view transfers
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transfer Matching</h1>
        <p className="text-muted-foreground">
          {currentEntity ? `Managing transfers for ${currentEntity.name}` : 'Match transfers between accounts to track money movement accurately'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id.toString()}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-6">
              {selectedOut && selectedIn && (
                <Button onClick={handleMatch} disabled={matching}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {matching ? "Matching..." : "Match Selected Transfers"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowMatched(!showMatched)}
              >
                {showMatched ? "Hide" : "View"} Matched Transfers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading transfers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transfer Out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-destructive" />
                Transfers Out ({transfersOut.length})
              </CardTitle>
              <CardDescription>
                Money leaving accounts (select one to match)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transfersOut.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No unmatched transfers out</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 w-8"></th>
                        <th className="text-left py-2 px-4">Date</th>
                        <th className="text-left py-2 px-4">Account</th>
                        <th className="text-left py-2 px-4">Description</th>
                        <th className="text-right py-2 px-4">Amount</th>
                        <th className="text-left py-2 px-4">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfersOut.map((transfer) =>
                        renderTransferRow(
                          transfer,
                          'out',
                          selectedOut === transfer.main_transaction_id,
                          () => setSelectedOut(transfer.main_transaction_id)
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfer In */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDown className="h-5 w-5 text-primary" />
                Transfers In ({transfersIn.length})
              </CardTitle>
              <CardDescription>
                Money entering accounts (select one to match)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transfersIn.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No unmatched transfers in</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 w-8"></th>
                        <th className="text-left py-2 px-4">Date</th>
                        <th className="text-left py-2 px-4">Account</th>
                        <th className="text-left py-2 px-4">Description</th>
                        <th className="text-right py-2 px-4">Amount</th>
                        <th className="text-left py-2 px-4">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfersIn.map((transfer) =>
                        renderTransferRow(
                          transfer,
                          'in',
                          selectedIn === transfer.main_transaction_id,
                          () => setSelectedIn(transfer.main_transaction_id)
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help Text */}
      <Card>
        <CardHeader>
          <CardTitle>How to Match Transfers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Select one Transfer Out (money leaving an account) from the left table</p>
          <p>2. Select one Transfer In (money entering an account) from the right table</p>
          <p>3. Click "Match Selected Transfers" to link them together</p>
          <p className="text-muted-foreground italic">
            Note: Transfers must have matching amounts and be from different accounts
          </p>
        </CardContent>
      </Card>

      {/* Matched Transfers Section */}
      {showMatched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-600" />
              Matched Transfers ({matchedTransfers.length})
            </CardTitle>
            <CardDescription>
              Already matched transfer pairs - Click unmatch to separate them
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matchedTransfers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matched transfers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-left py-2 px-4">Account</th>
                      <th className="text-left py-2 px-4">Description</th>
                      <th className="text-right py-2 px-4">Amount</th>
                      <th className="text-left py-2 px-4">Type</th>
                      <th className="text-left py-2 px-4">Matched With</th>
                      <th className="text-center py-2 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedTransfers.map((transfer) => {
                      const isOut = transfer.transaction_type_code === 'TRF_OUT'
                      const matchedTransfer = matchedTransfers.find(
                        t => t.main_transaction_id === transfer.transfer_matched_transaction_id
                      )

                      return (
                        <tr key={transfer.main_transaction_id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 whitespace-nowrap">{formatDate(transfer.transaction_date)}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{transfer.account_name}</div>
                            {transfer.bank_name && (
                              <div className="text-xs text-muted-foreground">{transfer.bank_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {transfer.description || <span className="text-muted-foreground italic">No description</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium">
                            {formatAmount(transfer.amount)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={isOut ? 'destructive' : 'default'}>
                              {isOut ? (
                                <>
                                  <ArrowUp className="h-3 w-3 mr-1" />
                                  Transfer Out
                                </>
                              ) : (
                                <>
                                  <ArrowDown className="h-3 w-3 mr-1" />
                                  Transfer In
                                </>
                              )}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {matchedTransfer ? (
                              <div className="text-sm">
                                <div className="font-medium">{matchedTransfer.account_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {matchedTransfer.transaction_type_code === 'TRF_OUT' ? 'Transfer Out' : 'Transfer In'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">ID: {transfer.transfer_matched_transaction_id}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnmatch(transfer.main_transaction_id)}
                            >
                              <Link2Off className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
