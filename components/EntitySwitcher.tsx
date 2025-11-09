'use client'

import { useEntity } from '@/contexts/EntityContext'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Building2, ChevronDown, Plus, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function EntitySwitcher() {
  const { currentEntity, entities, loading, switchEntity } = useEntity()
  const router = useRouter()

  if (loading) {
    return (
      <Button variant="outline" disabled>
        <Building2 className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    )
  }

  if (!currentEntity || entities.length === 0) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/dashboard/entities/new')}
      >
        <Plus className="mr-2 h-4 w-4" />
        Create Entity
      </Button>
    )
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'editor':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEntityIcon = (type: string) => {
    return type === 'company' ? Building2 : User
  }

  const handleSwitchEntity = (entityId: string) => {
    switchEntity(entityId)
    // Refresh the current page to load data for new entity
    router.refresh()
  }

  const Icon = getEntityIcon(currentEntity.type)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Icon className="h-4 w-4" />
          <span className="max-w-[200px] truncate">{currentEntity.name}</span>
          <Badge
            variant="secondary"
            className={`ml-1 text-xs ${getRoleBadgeColor(currentEntity.user_role)}`}
          >
            {currentEntity.user_role}
          </Badge>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]">
        <DropdownMenuLabel>Switch Entity</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {entities.map((entity) => {
          const EntityIcon = getEntityIcon(entity.type)
          const isSelected = entity.id === currentEntity.id

          return (
            <DropdownMenuItem
              key={entity.id}
              onClick={() => handleSwitchEntity(entity.id)}
              className={isSelected ? 'bg-accent' : ''}
            >
              <div className="flex items-center gap-3 w-full">
                <EntityIcon className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{entity.name}</div>
                  {entity.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {entity.description}
                    </div>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={`text-xs ${getRoleBadgeColor(entity.user_role)}`}
                >
                  {entity.user_role}
                </Badge>
              </div>
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/entities')}
          className="text-blue-600"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Manage Entities
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/entities/new')}
          className="text-green-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Entity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
