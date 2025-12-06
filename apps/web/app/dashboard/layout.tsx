import { Sidebar } from "@/components/sidebar"
import { EntityProvider } from "@/contexts/EntityContext"
import { CommandBarProvider } from "@/contexts/CommandBarContext"
import { TransactionEditProvider } from "@/contexts/TransactionEditContext"
import { TransactionDataProvider } from "@/contexts/TransactionDataContext"
import { CommandBar } from "@/components/command-bar"
import { GlobalEditTransactionDialog } from "@/components/main-transactions/GlobalEditTransactionDialog"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EntityProvider>
      <TransactionDataProvider>
        <TransactionEditProvider>
          <CommandBarProvider>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
            <CommandBar />
            <GlobalEditTransactionDialog />
          </CommandBarProvider>
        </TransactionEditProvider>
      </TransactionDataProvider>
    </EntityProvider>
  )
}
