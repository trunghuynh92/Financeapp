"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { CategoriesManager } from "@/components/settings/CategoriesManager"
import { BranchesManager } from "@/components/settings/BranchesManager"
import { TransactionTypesManager } from "@/components/settings/TransactionTypesManager"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage categories, branches, and transaction types
        </p>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="types">Transaction Types</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <CategoriesManager />
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <BranchesManager />
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <TransactionTypesManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
