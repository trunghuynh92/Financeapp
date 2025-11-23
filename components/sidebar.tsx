"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Building2, FileText, Settings, DollarSign, Wallet, Tags, Link2, LogOut, User, Flag, PiggyBank, Calendar, FileSignature, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { EntitySwitcher } from "./EntitySwitcher"
import { useAuth } from "@/contexts/AuthContext"
import { useEntity } from "@/contexts/EntityContext"
import { canAccessReports, type UserRole } from "@/lib/permissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, requiredRole: null },
  { name: "Entities", href: "/dashboard/entities", icon: Building2, requiredRole: null },
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet, requiredRole: null },
  // { name: "Transactions", href: "/dashboard/transactions", icon: DollarSign }, // Hidden - use Main Transactions instead
  { name: "Main Transactions", href: "/dashboard/main-transactions", icon: Tags, requiredRole: null },
  { name: "Audit", href: "/dashboard/audit", icon: Flag, requiredRole: null },
  { name: "Budgets", href: "/dashboard/budgets", icon: PiggyBank, requiredRole: null },
  { name: "Cash Flow", href: "/dashboard/cash-flow", icon: TrendingUp, requiredRole: 'editor' as UserRole },
  { name: "Scheduled Payments", href: "/dashboard/scheduled-payments", icon: Calendar, requiredRole: null },
  { name: "Contracts", href: "/dashboard/contracts", icon: FileSignature, requiredRole: null },
  // { name: "Transfers", href: "/dashboard/transfers", icon: Link2 }, // Hidden - transfers are managed within Main Transactions
  { name: "Reports", href: "/dashboard/reports", icon: FileText, requiredRole: 'editor' as UserRole },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, requiredRole: 'admin' as UserRole },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { currentEntity } = useEntity()

  // Get user's role for the current entity
  const userRole = currentEntity?.role as UserRole | undefined

  // Filter navigation items based on role
  const visibleNavigation = navigation.filter((item) => {
    // If no role required, show to everyone
    if (!item.requiredRole) return true

    // If user has no role, hide restricted items
    if (!userRole) return false

    // For 'editor' required role (Cash Flow, Reports), check if user can access reports
    if (item.requiredRole === 'editor') {
      return canAccessReports(userRole)
    }

    // For 'admin' required role (Settings), check if user is admin or owner
    if (item.requiredRole === 'admin') {
      return userRole === 'admin' || userRole === 'owner'
    }

    return true
  })

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Finance SaaS</h1>
      </div>

      {/* Entity Switcher */}
      <div className="border-b p-4">
        <EntitySwitcher />
        {/* Show role badge */}
        {userRole && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {userRole === 'data_entry' ? 'Data Entry' : userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </Badge>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {visibleNavigation.map((item) => {
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
