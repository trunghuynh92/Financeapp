'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to entities page where the Add Entity dialog can be opened.
 * This page was causing RLS issues for new users, so we redirect instead.
 */
export default function NewEntityPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to entities page with a query param to auto-open the add dialog
    router.replace('/dashboard/entities?action=add')
  }, [router])

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  )
}
