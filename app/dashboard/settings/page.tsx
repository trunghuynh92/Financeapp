"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { CategoriesManager } from "@/components/settings/CategoriesManager"
import { BranchesManager } from "@/components/settings/BranchesManager"
import { ProjectsManager } from "@/components/settings/ProjectsManager"
import { TransactionTypesManager } from "@/components/settings/TransactionTypesManager"
import { TeamMembersManager } from "@/components/settings/TeamMembersManager"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage team members, categories, branches, projects, and transaction types
        </p>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="types">Transaction Types</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <TeamMembersManager />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoriesManager />
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <BranchesManager />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <ProjectsManager />
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <TransactionTypesManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
