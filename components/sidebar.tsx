"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Building2, FileText, Settings, DollarSign, Wallet, Tags, Link2, LogOut, User, Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { EntitySwitcher } from "./EntitySwitcher"
import { useAuth } from "@/contexts/AuthContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Entities", href: "/dashboard/entities", icon: Building2 },
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet },
  // { name: "Transactions", href: "/dashboard/transactions", icon: DollarSign }, // Hidden - use Main Transactions instead
  { name: "Main Transactions", href: "/dashboard/main-transactions", icon: Tags },
  { name: "Audit", href: "/dashboard/audit", icon: Flag },
  // { name: "Transfers", href: "/dashboard/transfers", icon: Link2 }, // Hidden - transfers are managed within Main Transactions
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Finance SaaS</h1>
      </div>

      {/* Entity Switcher */}
      <div className="border-b p-4">
        <EntitySwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
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

      {/* User Menu */}
      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <User className="h-4 w-4" />
              <span className="flex-1 truncate text-left text-sm">
                {user?.email || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Profile (Coming Soon)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
