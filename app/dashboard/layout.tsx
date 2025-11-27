import { Sidebar } from "@/components/sidebar"
import { EntityProvider } from "@/contexts/EntityContext"
import { CommandBarProvider } from "@/contexts/CommandBarContext"
import { CommandBar } from "@/components/command-bar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EntityProvider>
      <CommandBarProvider>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
        <CommandBar />
      </CommandBarProvider>
    </EntityProvider>
  )
}
