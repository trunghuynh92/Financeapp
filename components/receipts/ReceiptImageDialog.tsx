"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, FileImage, Download, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ReceiptImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptId: string
}

export function ReceiptImageDialog({
  open,
  onOpenChange,
  receiptId,
}: ReceiptImageDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (open && receiptId) {
      loadReceiptImage()
    }
  }, [open, receiptId])

  const loadReceiptImage = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/receipts/${receiptId}/view`)
      if (!response.ok) throw new Error("Failed to load receipt image")

      // The response is the actual image, so we create a blob URL
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setImageUrl(url)
    } catch (error) {
      console.error("Error loading receipt:", error)
      toast({
        title: "Error",
        description: "Failed to load receipt image",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `receipt-${receiptId}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleOpenInNewTab = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank')
    }
  }

  // Clean up blob URL when dialog closes
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Receipt Image
          </DialogTitle>
          <DialogDescription>
            View the receipt image attached to this transaction
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : imageUrl ? (
          <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-4">
            <img
              src={imageUrl}
              alt="Receipt"
              className="max-w-full h-auto mx-auto rounded border shadow-sm"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <p>No image available</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {imageUrl && (
              <>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
