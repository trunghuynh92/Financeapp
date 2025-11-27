"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, DollarSign, TrendingUp, Users, Loader2 } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

export default function DashboardPage() {
  const { currentEntity, entities, loading: entityLoading } = useEntity()
  const [accountsCount, setAccountsCount] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tAccounts = useTranslations('accounts')
  const tEntities = useTranslations('entities')

  useEffect(() => {
    if (currentEntity) {
      fetchDashboardData()
    }
  }, [currentEntity?.id])

  const fetchDashboardData = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('entity_id', currentEntity.id)
      params.set('limit', '1000')

      const response = await fetch(`/api/accounts?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const accounts = data.data || []
        setAccountsCount(accounts.length)

        // Calculate total balance
        const total = accounts.reduce((sum: number, account: any) => {
          const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
          const balance = balanceData?.current_balance || 0
          return sum + balance
        }, 0)
        setTotalBalance(total)
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  // Show loading while entity context is loading
  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show empty state if no entity selected
  if (!currentEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t('noEntitySelected')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('selectEntityMessage')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {currentEntity ? t('overviewFor', { name: currentEntity.name }) : t('welcomeMessage')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tEntities('currentEntity')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentEntity.type === 'company' ? t('company') : t('personal')}</div>
            <p className="text-xs text-muted-foreground">
              {t('yourRole')}: {currentEntity.user_role}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalBalance')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('acrossAccounts', { count: accountsCount })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalAccounts')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : accountsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('inThisEntity')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('myEntities')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entities.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('totalAccess')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t('entityOverview')}</CardTitle>
            <CardDescription>
              {t('informationAbout', { name: currentEntity.name })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{t('entityType')}</p>
                <p className="text-sm text-muted-foreground capitalize">{currentEntity.type}</p>
              </div>
              {currentEntity.description && (
                <div>
                  <p className="text-sm font-medium">{tCommon('description')}</p>
                  <p className="text-sm text-muted-foreground">{currentEntity.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{t('yourRole')}</p>
                <p className="text-sm text-muted-foreground capitalize">{currentEntity.user_role}</p>
              </div>
              <div>
                <p className="text-sm font-medium">{tAccounts('title')}</p>
                <p className="text-sm text-muted-foreground">
                  {loading ? tCommon('loading') : t('accountsConfigured', { count: accountsCount })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('quickActions')}</CardTitle>
            <CardDescription>
              {t('commonTasks')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/accounts">
              <Button variant="outline" className="w-full justify-start">
                {t('viewAccounts')}
              </Button>
            </Link>
            <Link href="/dashboard/transactions">
              <Button variant="outline" className="w-full justify-start">
                {t('viewTransactions')}
              </Button>
            </Link>
            <Link href="/dashboard/main-transactions">
              <Button variant="outline" className="w-full justify-start">
                {t('viewMainTransactions')}
              </Button>
            </Link>
            <Link href="/dashboard/transfers">
              <Button variant="outline" className="w-full justify-start">
                {t('matchTransfers')}
              </Button>
            </Link>
            <Link href="/dashboard/entities/new">
              <Button variant="outline" className="w-full justify-start">
                {tEntities('addEntity')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
