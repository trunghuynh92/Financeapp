"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Building2, FileText, Settings, DollarSign, Wallet, Tags, Link2, LogOut, User, Flag, PiggyBank, Calendar, FileSignature, TrendingUp, HelpCircle } from "lucide-react"
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
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslations } from "next-intl"
import { useHelp } from "@/contexts/HelpContext"

const navigation = [
  { nameKey: "dashboard", href: "/dashboard", icon: Home, requiredRole: null },
  { nameKey: "entities", href: "/dashboard/entities", icon: Building2, requiredRole: null },
  { nameKey: "accounts", href: "/dashboard/accounts", icon: Wallet, requiredRole: null },
  { nameKey: "transactions", href: "/dashboard/main-transactions", icon: Tags, requiredRole: null },
  { nameKey: "audit", href: "/dashboard/audit", icon: Flag, requiredRole: null },
  { nameKey: "budgets", href: "/dashboard/budgets", icon: PiggyBank, requiredRole: null },
  { nameKey: "cashFlow", href: "/dashboard/cash-flow", icon: TrendingUp, requiredRole: 'editor' as UserRole },
  { nameKey: "scheduledPayments", href: "/dashboard/scheduled-payments", icon: Calendar, requiredRole: null },
  { nameKey: "contracts", href: "/dashboard/contracts", icon: FileSignature, requiredRole: null },
  { nameKey: "reports", href: "/dashboard/reports", icon: FileText, requiredRole: 'editor' as UserRole },
  { nameKey: "settings", href: "/dashboard/settings", icon: Settings, requiredRole: 'admin' as UserRole },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { currentEntity } = useEntity()
  const { openHelp } = useHelp()
  const t = useTranslations('navigation')
  const tAuth = useTranslations('auth')

  // Get user's role for the current entity
  const userRole = currentEntity?.user_role as UserRole | undefined

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
              key={item.nameKey}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(item.nameKey)}
            </Link>
          )
        })}
      </nav>

      {/* Language Switcher and Help */}
      <div className="border-t p-4 space-y-2">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => openHelp()}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="text-sm">{t('help')}</span>
        </Button>
      </div>

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
            <DropdownMenuLabel>{t('profile')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              {tAuth('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
