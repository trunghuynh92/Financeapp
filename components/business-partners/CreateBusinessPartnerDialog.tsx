"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertCircle } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { PartnerType, PARTNER_TYPE_LABELS } from "@/types/business-partner"

interface CreateBusinessPartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  defaultPartnerType?: PartnerType
}

export function CreateBusinessPartnerDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultPartnerType = "vendor"
}: CreateBusinessPartnerDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basic Information
  const [partnerName, setPartnerName] = useState("")
  const [partnerType, setPartnerType] = useState<PartnerType>(defaultPartnerType)
  const [displayName, setDisplayName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [taxId, setTaxId] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [notes, setNotes] = useState("")

  // Contact Information
  const [contactPerson, setContactPerson] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [mobile, setMobile] = useState("")
  const [website, setWebsite] = useState("")

  // Address
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [stateProvince, setStateProvince] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("")

  // Banking
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankBranch, setBankBranch] = useState("")
  const [bankSwiftCode, setBankSwiftCode] = useState("")

  const resetForm = () => {
    setPartnerName("")
    setPartnerType(defaultPartnerType)
    setDisplayName("")
    setLegalName("")
    setTaxId("")
    setRegistrationNumber("")
    setNotes("")
    setContactPerson("")
    setEmail("")
    setPhone("")
    setMobile("")
    setWebsite("")
    setAddressLine1("")
    setAddressLine2("")
    setCity("")
    setStateProvince("")
    setPostalCode("")
    setCountry("")
    setBankAccountNumber("")
    setBankName("")
    setBankBranch("")
    setBankSwiftCode("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentEntity) return

    // Validation
    if (!partnerName.trim()) {
      setError("Partner name is required")
      return
    }

    setLoading(true)

    try {
      const body = {
        entity_id: currentEntity.id,
        partner_type: partnerType,
        partner_name: partnerName.trim(),
        display_name: displayName.trim() || undefined,
        legal_name: legalName.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        mobile: mobile.trim() || undefined,
        website: website.trim() || undefined,
        address_line1: addressLine1.trim() || undefined,
        address_line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state_province: stateProvince.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        bank_account_number: bankAccountNumber.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        bank_branch: bankBranch.trim() || undefined,
        bank_swift_code: bankSwiftCode.trim() || undefined,
        notes: notes.trim() || undefined,
      }

      const response = await fetch("/api/business-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        const error = await response.json()
        setError(error.error || "Failed to create business partner")
      }
    } catch (err) {
      console.error("Error creating business partner:", err)
      setError("Failed to create business partner")
    } finally {
      setLoading(false)
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partnerName">Partner Name *</Label>
                  <Input
                    id="partnerName"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="e.g., John Doe or ABC Company"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partnerType">Partner Type *</Label>
                  <Select value={partnerType} onValueChange={(v) => setPartnerType(v as PartnerType)}>
                    <SelectTrigger id="partnerType">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Short name for display"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Name</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Official registered name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Tax identification number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Business registration number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Primary contact name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Office phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apartment, suite, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stateProvince">State/Province</Label>
                  <Input
                    id="stateProvince"
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                    placeholder="State or Province"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Postal/ZIP code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                <Input
                  id="bankAccountNumber"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Account number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Name of bank"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankBranch">Bank Branch</Label>
                  <Input
                    id="bankBranch"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="Branch name or code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankSwiftCode">SWIFT/BIC Code</Label>
                <Input
                  id="bankSwiftCode"
                  value={bankSwiftCode}
                  onChange={(e) => setBankSwiftCode(e.target.value)}
                  placeholder="SWIFT or BIC code"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                resetForm()
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Partner"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
