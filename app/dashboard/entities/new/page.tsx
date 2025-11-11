'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEntity } from '@/contexts/EntityContext'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Building2, User } from 'lucide-react'
import Link from 'next/link'

export default function NewEntityPage() {
  const router = useRouter()
  const { refreshEntities } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'company' as 'company' | 'personal',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createSupabaseClient()

      // Create the entity
      const { data, error: createError } = await supabase
        .from('entities')
        .insert({
          name: formData.name,
          type: formData.type,
          description: formData.description || null,
        })
        .select()
        .single()

      if (createError) throw createError

      // Refresh entities list
      await refreshEntities()

      // Redirect to entities page
      router.push('/dashboard/entities')
    } catch (err: any) {
      console.error('Error creating entity:', err)
      setError(err.message || 'Failed to create entity')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/entities"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Entities
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Entity</CardTitle>
          <CardDescription>
            Create a new company or personal finance entity. You'll be automatically assigned as the owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Entity Type */}
            <div className="space-y-3">
              <Label>Entity Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as 'company' | 'personal' })
                }
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem
                    value="company"
                    id="company"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="company"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Building2 className="mb-3 h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Company</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Business entity
                      </div>
                    </div>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem
                    value="personal"
                    id="personal"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="personal"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <User className="mb-3 h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">Personal</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Personal finances
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Entity Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Entity Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder={
                  formData.type === 'company'
                    ? 'e.g., Acme Corporation'
                    : "e.g., John's Personal Finances"
                }
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a brief description of this entity..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={loading}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Entity'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
