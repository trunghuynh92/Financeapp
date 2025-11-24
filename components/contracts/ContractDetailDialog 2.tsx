"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ContractOverview } from "@/types/contract"
import { CreateContractDialog } from "./CreateContractDialog"
import { AmendmentTimeline } from "./AmendmentTimeline"
import { CreateScheduledPaymentDialog } from "./CreateScheduledPaymentDialog"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Building, FileText, DollarSign, Plus, Copy } from "lucide-react"
import { format } from "date-fns"

interface ContractDetailDialogProps {
  contract: ContractOverview
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ContractDetailDialog({
  contract: initialContract,
  open,
  onOpenChange,
  onSuccess
}: ContractDetailDialogProps) {
  const [contract, setContract] = useState(initialContract)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createScheduleDialogOpen, setCreateScheduleDialogOpen] = useState(false)
  const [duplicatingSchedule, setDuplicatingSchedule] = useState<any | null>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [amendments, setAmendments] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      fetchContractDetails()
    }
  }, [open, initialContract.contract_id])

  const fetchContractDetails = async () => {
    try {
      const response = await fetch(`/api/contracts/${initialContract.contract_id}`)
      if (response.ok) {
        const data = await response.json()
        setContract(data.data)
        setSchedules(data.data.payment_schedules || [])
        setAmendments(data.data.amendments || [])
      }
    } catch (error) {
      console.error("Error fetching contract details:", error)
    }
  }

  const handleSuccess = () => {
    fetchContractDetails()
    setDuplicatingSchedule(null)
    onSuccess()
  }

  const handleDuplicateSchedule = (schedule: any) => {
    setDuplicatingSchedule(schedule)
    setCreateScheduleDialogOpen(true)
  }

  return (
    <>
      <Dialog open={open && !editDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{contract.contract_name}</DialogTitle>
            <DialogDescription>{contract.contract_number}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="schedules">
                Payment Schedules ({schedules.length})
              </TabsTrigger>
              <TabsTrigger value="amendments">
                Amendments ({amendments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contract Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{contract.contract_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge>{contract.status}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Counterparty</p>
                      <p className="font-medium">{contract.counterparty}</p>
                    </div>
                    {contract.counterparty_contact && (
                      <div>
                        <p className="text-muted-foreground">Contact</p>
                        <p className="font-medium">{contract.counterparty_contact}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    {contract.signing_date && (
                      <div>
                        <p className="text-muted-foreground">Signing Date</p>
                        <p className="font-medium">{format(new Date(contract.signing_date), "MMM d, yyyy")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Effective Date</p>
                      <p className="font-medium">{format(new Date(contract.effective_date), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expiration Date</p>
                      <p className="font-medium">
                        {contract.expiration_date
                          ? format(new Date(contract.expiration_date), "MMM d, yyyy")
                          : "Indefinite"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(contract.payment_terms || contract.renewal_terms || contract.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Terms & Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {contract.payment_terms && (
                      <div>
                        <p className="text-muted-foreground">Payment Terms</p>
                        <p className="font-medium">{contract.payment_terms}</p>
                      </div>
                    )}
                    {contract.renewal_terms && (
                      <div>
                        <p className="text-muted-foreground">Renewal Terms</p>
                        <p className="font-medium">{contract.renewal_terms}</p>
                      </div>
                    )}
                    {contract.notes && (
                      <div>
                        <p className="text-muted-foreground">Notes</p>
                        <p className="font-medium">{contract.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="schedules" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setCreateScheduleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Schedule
                </Button>
              </div>

              {schedules.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground mb-4">No payment schedules yet</p>
                    <p className="text-sm text-muted-foreground">
                      Add payment schedules to track recurring payments for this contract
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule: any) => (
                    <Card key={schedule.scheduled_payment_id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium">{schedule.payment_type || "Payment"}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Period: {schedule.start_date} to {schedule.end_date || "ongoing"}</p>
                              <p>Category: {schedule.category_name}</p>
                              <p>Amount: {schedule.payment_amount.toLocaleString()} VND</p>
                              <p>Frequency: {schedule.frequency}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDuplicateSchedule(schedule)}
                              title="Duplicate this payment schedule"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Badge>{schedule.status}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="amendments" className="mt-4">
              <AmendmentTimeline
                contractId={contract.contract_id}
                amendments={amendments}
                onAmendmentUpdated={handleSuccess}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateContractDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
        editingContract={contract}
      />

      <CreateScheduledPaymentDialog
        contract={contract}
        open={createScheduleDialogOpen}
        onOpenChange={(open) => {
          setCreateScheduleDialogOpen(open)
          if (!open) {
            setDuplicatingSchedule(null)
          }
        }}
        onSuccess={handleSuccess}
        duplicateFrom={duplicatingSchedule}
      />
    </>
  )
}
