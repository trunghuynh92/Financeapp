"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  FileText,
  TrendingUp,
  LayoutGrid,
  List
} from "lucide-react"
import { ScheduledPaymentOverview, ScheduledPaymentSummary, ContractType } from "@/types/scheduled-payment"
import { Category } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"
import { formatCurrency } from "@/lib/account-utils"
import { CreateScheduledPaymentDialog } from "@/components/contracts/CreateScheduledPaymentDialog"
import { ScheduledPaymentList } from "@/components/scheduled-payments/ScheduledPaymentList"
import { PaymentTimeline } from "@/components/scheduled-payments/PaymentTimeline"

export default function ScheduledPaymentsPage() {
  const { currentEntity } = useEntity()

  // Data state
  const [payments, setPayments] = useState<ScheduledPaymentOverview[]>([])
  const [summary, setSummary] = useState<ScheduledPaymentSummary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('timeline')

  // Filter state
  const [selectedContractType, setSelectedContractType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedPayee, setSelectedPayee] = useState<string>("all")

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<ScheduledPaymentOverview | null>(null)

  useEffect(() => {
    if (currentEntity) {
      fetchPayments()
      fetchCategories()
    }
  }, [currentEntity?.id, selectedContractType, selectedStatus])

  const fetchPayments = async (preserveScrollPosition = false) => {
    if (!currentEntity) return

    // Save scroll position before fetching
    const scrollY = preserveScrollPosition ? window.scrollY : 0

    // Don't show loading spinner if preserving scroll (to avoid UI jump)
    if (!preserveScrollPosition) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      params.set('entity_id', currentEntity.id)
      params.set('include_summary', 'true')
      params.set('active_only', 'false')

      if (selectedContractType !== 'all') {
        params.set('contract_type', selectedContractType)
      }

      if (selectedStatus !== 'all') {
        params.set('status', selectedStatus)
      }

      const response = await fetch(`/api/scheduled-payments?${params.toString()}`)

      if (response.ok) {
        const data = await response.json()
        setPayments(data.data || [])
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching scheduled payments:', error)
    } finally {
      setLoading(false)

      // Restore scroll position after rendering
      if (preserveScrollPosition && scrollY > 0) {
        // Use requestAnimationFrame for smoother scroll restoration
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: 'instant' })
        })
      }
    }
  }

  const fetchCategories = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleDeletePayment = async (paymentId: number, contractName: string) => {
    if (!confirm(`Are you sure you want to cancel "${contractName}"? All pending payment instances will be cancelled.`)) {
      return
    }

    try {
      const response = await fetch(`/api/scheduled-payments/${paymentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchPayments()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete scheduled payment')
      }
    } catch (error) {
      console.error('Error deleting scheduled payment:', error)
      alert('Failed to delete scheduled payment')
    }
  }

  // Get unique payees for filter
  const uniquePayees = Array.from(new Set(payments.map(p => p.payee_name))).sort()

  // Filter payments by payee
  const filteredPayments = payments.filter(payment => {
    if (selectedPayee === 'all') return true
    return payment.payee_name === selectedPayee
  })

  // Show loading while entity context is loading
  if (!currentEntity) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Payments</h1>
          <p className="text-muted-foreground">
            Track payment obligations (contract-based and standalone)
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Standalone Payment
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.active_contracts}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_contracts} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Obligation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_monthly_obligation, 'VND')}
              </div>
              <p className="text-xs text-muted-foreground">
                Recurring monthly payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upcoming Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="text-2xl font-bold">{summary.upcoming_payments_count}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Next 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.overdue_payments_count > 0 ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div className="text-2xl font-bold text-red-600">{summary.overdue_payments_count}</div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="text-2xl font-bold text-green-600">0</div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.overdue_payments_count > 0 ? 'Requires attention' : 'All up to date'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Cards
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
              >
                <List className="h-4 w-4 mr-2" />
                Timeline
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contract Type</label>
              <Select value={selectedContractType} onValueChange={setSelectedContractType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payee</label>
              <Select value={selectedPayee} onValueChange={setSelectedPayee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payees</SelectItem>
                  {uniquePayees.map((payee) => (
                    <SelectItem key={payee} value={payee}>
                      {payee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment View */}
      {viewMode === 'timeline' ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment Timeline ({filteredPayments.length})</CardTitle>
            <CardDescription>
              Visualize payments on a timeline with overlap detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading payment timeline...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No scheduled payments found</p>
                <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Contract
                </Button>
              </div>
            ) : (
              <PaymentTimeline
                payments={filteredPayments}
                onEdit={(payment) => {
                  setEditingPayment(payment)
                  setCreateDialogOpen(true)
                }}
                onDelete={handleDeletePayment}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Contracts ({filteredPayments.length})</CardTitle>
            <CardDescription>
              Manage your contractual payment obligations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading scheduled payments...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No scheduled payments found</p>
                <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Contract
                </Button>
              </div>
            ) : (
              <ScheduledPaymentList
                payments={filteredPayments}
                onEdit={(payment) => {
                  setEditingPayment(payment)
                  setCreateDialogOpen(true)
                }}
                onDelete={handleDeletePayment}
                onRefresh={() => fetchPayments(true)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <CreateScheduledPaymentDialog
        contract={null}
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) {
            setEditingPayment(null)
          }
        }}
        onSuccess={fetchPayments}
        editingSchedule={editingPayment}
      />
    </div>
  )
}
