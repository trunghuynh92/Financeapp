"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateBusinessPartnerInput, PARTNER_TYPE_LABELS } from "@/types/business-partner"

interface CreateBusinessPartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  onSuccess: (partner: any) => void
  defaultPartnerType?: string
}

export function CreateBusinessPartnerDialog({
  open,
  onOpenChange,
  entityId,
  onSuccess,
  defaultPartnerType = "other",
}: CreateBusinessPartnerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreateBusinessPartnerInput>({
    entity_id: entityId,
    partner_type: defaultPartnerType as any,
    partner_name: "",
    legal_name: null,
    display_name: null,
    tax_id: null,
    registration_number: null,
    contact_person: null,
    email: null,
    phone: null,
    mobile: null,
    website: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state_province: null,
    postal_code: null,
    country: null,
    bank_account_number: null,
    bank_name: null,
    bank_branch: null,
    bank_swift_code: null,
    notes: null,
    tags: null,
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        entity_id: entityId,
        partner_type: defaultPartnerType as any,
        partner_name: "",
        legal_name: null,
        display_name: null,
        tax_id: null,
        registration_number: null,
        contact_person: null,
        email: null,
        phone: null,
        mobile: null,
        website: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state_province: null,
        postal_code: null,
        country: null,
        bank_account_number: null,
        bank_name: null,
        bank_branch: null,
        bank_swift_code: null,
        notes: null,
        tags: null,
      })
      setError(null)
    }
  }, [open, entityId, defaultPartnerType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validation
      if (!formData.partner_name) {
        setError("Partner name is required")
        return
      }

      const response = await fetch("/api/business-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create business partner")
      }

      onSuccess(data.data)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Business Partner</DialogTitle>
          <DialogDescription>
            Add a new contact for business relationships
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partner_name">Partner Name *</Label>
                  <Input
                    id="partner_name"
                    value={formData.partner_name}
                    onChange={(e) =>
                      setFormData({ ...formData, partner_name: e.target.value })
                    }
                    placeholder="e.g., John Doe or ABC Company"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner_type">Partner Type *</Label>
                  <Select
                    value={formData.partner_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, partner_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, display_name: e.target.value || null })
                    }
                    placeholder="Short name for display"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legal_name">Legal Name</Label>
                  <Input
                    id="legal_name"
                    value={formData.legal_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, legal_name: e.target.value || null })
                    }
                    placeholder="Official registered name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_id: e.target.value || null })
                    }
                    placeholder="Tax identification number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_number">Registration Number</Label>
                  <Input
                    id="registration_number"
                    value={formData.registration_number || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, registration_number: e.target.value || null })
                    }
                    placeholder="Business registration number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value || null })
                  }
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value || null })
                    }
                    placeholder="Primary contact name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value || null })
                    }
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value || null })
                    }
                    placeholder="Office phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, mobile: e.target.value || null })
                    }
                    placeholder="Mobile phone"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value || null })
                    }
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    value={formData.address_line1 || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line1: e.target.value || null })
                    }
                    placeholder="Street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={formData.address_line2 || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line2: e.target.value || null })
                    }
                    placeholder="Apartment, suite, etc."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value || null })
                      }
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state_province">State/Province</Label>
                    <Input
                      id="state_province"
                      value={formData.state_province || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, state_province: e.target.value || null })
                      }
                      placeholder="State or Province"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, postal_code: e.target.value || null })
                      }
                      placeholder="Postal code"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value || null })
                      }
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="banking" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value || null })
                    }
                    placeholder="Bank name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_branch">Bank Branch</Label>
                  <Input
                    id="bank_branch"
                    value={formData.bank_branch || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_branch: e.target.value || null })
                    }
                    placeholder="Branch name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_number: e.target.value || null })
                    }
                    placeholder="Bank account number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_swift_code">SWIFT/BIC Code</Label>
                  <Input
                    id="bank_swift_code"
                    value={formData.bank_swift_code || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_swift_code: e.target.value || null })
                    }
                    placeholder="SWIFT or BIC code"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Partner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
