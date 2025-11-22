"use client"

import { useState, useCallback } from "react"
import { Upload, Loader2, FileImage, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDropzone } from "react-dropzone"

interface ReceiptUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  entityId: string
  rawTransactionId?: string
  onSuccess?: (receiptId: string) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
}

export function ReceiptUploadDialog({
  open,
  onOpenChange,
  accountId,
  entityId,
  rawTransactionId,
  onSuccess,
}: ReceiptUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setError(null)

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      return
    }

    setSelectedFile(file)

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    multiple: false,
  })

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('entity_id', entityId)
      if (rawTransactionId) {
        formData.append('raw_transaction_id', rawTransactionId)
      }
      formData.append('process_ocr', 'true') // Enable OCR processing

      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload receipt')
      }

      const data = await response.json()

      setUploadSuccess(true)

      // Call success callback after a brief delay
      setTimeout(() => {
        onSuccess?.(data.data.receipt_id)
        handleClose()
      }, 1500)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload receipt')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setPreview(null)
    setError(null)
    setUploadSuccess(false)
    onOpenChange(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt image or PDF. Supported formats: JPG, PNG, PDF (max 10MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Success Message */}
          {uploadSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">Upload successful!</div>
                <div className="text-sm text-green-700">Receipt has been uploaded and saved.</div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="font-medium text-red-900">Error</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* File Upload Area */}
          {!selectedFile && (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600 font-medium">Drop the file here...</p>
              ) : (
                <>
                  <p className="text-gray-600 font-medium mb-1">
                    Drag & drop a receipt here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    JPG, PNG, or PDF up to 10MB
                  </p>
                </>
              )}
            </div>
          )}

          {/* Selected File Preview */}
          {selectedFile && !uploadSuccess && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileImage className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-medium">{selectedFile.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                    setError(null)
                  }}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Image Preview */}
              {preview && (
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-sm font-medium mb-2">Preview</div>
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="max-h-96 mx-auto rounded border"
                  />
                </div>
              )}

              {/* PDF Notice */}
              {selectedFile.type === 'application/pdf' && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                  PDF files will be stored but cannot be previewed here.
                  You can view them after upload.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            {uploadSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!uploadSuccess && (
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : 'Upload Receipt'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
