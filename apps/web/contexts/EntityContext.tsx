'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { createSupabaseClient } from '@/lib/supabase'
import type { EntityWithRole } from '@/lib/supabase'

type EntityContextType = {
  currentEntity: EntityWithRole | null
  entities: EntityWithRole[]
  loading: boolean
  switchEntity: (entityId: string) => void
  refreshEntities: () => Promise<void>
}

const EntityContext = createContext<EntityContextType | undefined>(undefined)

const STORAGE_KEY = 'finance-saas-current-entity'

export function EntityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentEntity, setCurrentEntity] = useState<EntityWithRole | null>(null)
  const [entities, setEntities] = useState<EntityWithRole[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntities = async () => {
    if (!user) {
      setEntities([])
      setCurrentEntity(null)
      setLoading(false)
      return
    }

    try {
      const supabase = createSupabaseClient()

      // Fetch all entities user has access to with their role
      const { data, error } = await supabase
        .from('entity_users')
        .select(`
          role,
          entities:entity_id (
            id,
            name,
            type,
            description,
            created_at,
            updated_at,
            owner_user_id
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Transform data to EntityWithRole format
      const entitiesWithRole: EntityWithRole[] = (data || [])
        .filter(item => item.entities) // Filter out null entities
        .map((item: any) => ({
          ...item.entities,
          user_role: item.role,
        }))

      setEntities(entitiesWithRole)

      // Set current entity
      if (entitiesWithRole.length > 0) {
        // Try to restore from localStorage
        const savedEntityId = localStorage.getItem(STORAGE_KEY)
        const savedEntity = entitiesWithRole.find(e => e.id === savedEntityId)

        if (savedEntity) {
          setCurrentEntity(savedEntity)
        } else {
          // Default to first entity
          setCurrentEntity(entitiesWithRole[0])
          localStorage.setItem(STORAGE_KEY, entitiesWithRole[0].id)
        }
      } else {
        setCurrentEntity(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.error('Error fetching entities:', err)
      setEntities([])
      setCurrentEntity(null)
    } finally {
      setLoading(false)
    }
  }

  const switchEntity = (entityId: string) => {
    const entity = entities.find(e => e.id === entityId)
    if (entity) {
      setCurrentEntity(entity)
      localStorage.setItem(STORAGE_KEY, entityId)
    }
  }

  const refreshEntities = async () => {
    setLoading(true)
    await fetchEntities()
  }

  useEffect(() => {
    fetchEntities()
  }, [user])

  const value = {
    currentEntity,
    entities,
    loading,
    switchEntity,
    refreshEntities,
  }

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>
}

export function useEntity() {
  const context = useContext(EntityContext)
  if (context === undefined) {
    throw new Error('useEntity must be used within an EntityProvider')
  }
  return context
}
