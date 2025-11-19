"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, FileText, AlertCircle, Calendar, TrendingUp, Loader2 } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { ContractOverview, ContractSummary } from "@/types/contract"
import { ContractList } from "@/components/contracts/ContractList"
import { CreateContractDialog } from "@/components/contracts/CreateContractDialog"
import { formatCurrency } from "@/lib/account-utils"

export default function ContractsPage() {
  const { currentEntity } = useEntity()
  const [contracts, setContracts] = useState<ContractOverview[]>([])
  const [summary, setSummary] = useState<ContractSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("all")

  useEffect(() => {
    if (currentEntity) {
      fetchContracts()
    }
  }, [currentEntity])

  const fetchContracts = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        entity_id: currentEntity.id,
        include_summary: "true"
      })

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (contractTypeFilter !== "all") {
        params.append("contract_type", contractTypeFilter)
      }
      if (searchQuery) {
        params.append("counterparty", searchQuery)
      }

      const response = await fetch(`/api/contracts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setContracts(data.data || [])
        setSummary(data.summary || null)
      }
    } catch (error) {
      console.error("Error fetching contracts:", error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentEntity) {
        fetchContracts()
      }
    }, 300) // Debounce search

    return () => clearTimeout(timer)
  }, [searchQuery, statusFilter, contractTypeFilter, currentEntity])

  if (!currentEntity) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Entity Selected</h3>
        <p className="text-muted-foreground">Please select an entity to view contracts</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">Manage agreements and amendments</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Contract
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{summary.total_contracts}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.active_contracts} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Obligation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">
                  {formatCurrency(summary.total_monthly_obligation, 'VND')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recurring monthly payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${summary.expiring_soon_count > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                <span className="text-2xl font-bold">{summary.expiring_soon_count}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Within 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Amendments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">{summary.contracts_with_amendments}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Contracts with amendments
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by counterparty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_signature">Pending Signature</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="supply">Supply</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contract List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading contracts...</p>
        </div>
      ) : contracts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Contracts Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all" || contractTypeFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first contract"}
            </p>
            {!searchQuery && statusFilter === "all" && contractTypeFilter === "all" && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Contract
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ContractList
          contracts={contracts}
          onContractUpdated={fetchContracts}
        />
      )}

      {/* Create Contract Dialog */}
      <CreateContractDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchContracts}
      />
    </div>
  )
}
