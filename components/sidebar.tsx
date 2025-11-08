"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Building2, FileText, Settings, DollarSign, Wallet, Tags, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Entities", href: "/dashboard/entities", icon: Building2 },
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet },
  { name: "Transactions", href: "/dashboard/transactions", icon: DollarSign },
  { name: "Main Transactions", href: "/dashboard/main-transactions", icon: Tags },
  { name: "Transfers", href: "/dashboard/transfers", icon: Link2 },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Finance SaaS</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
