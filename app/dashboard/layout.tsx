import { Sidebar } from "@/components/sidebar"
import { EntityProvider } from "@/contexts/EntityContext"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EntityProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </EntityProvider>
  )
}
