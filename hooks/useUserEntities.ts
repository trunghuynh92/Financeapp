'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import type { EntityWithRole, UserRole } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useUserEntities() {
  const { user } = useAuth()
  const [entities, setEntities] = useState<EntityWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchEntities = async () => {
      if (!user) {
        setEntities([])
        setLoading(false)
        return
      }

      try {
        const supabase = createSupabaseClient()

        // Fetch entities with user's role
        const { data, error } = await supabase
          .from('entities')
          .select(`
            *,
            entity_users!inner(role)
          `)
          .eq('entity_users.user_id', user.id)

        if (error) throw error

        // Transform data to include role
        const entitiesWithRole: EntityWithRole[] = (data || []).map((entity: any) => ({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          description: entity.description,
          created_at: entity.created_at,
          updated_at: entity.updated_at,
          owner_user_id: entity.owner_user_id,
          user_role: entity.entity_users[0].role as UserRole,
        }))

        setEntities(entitiesWithRole)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntities()
  }, [user])

  return { entities, loading, error }
}

export function useUserRole(entityId: number | string) {
  const { entities, loading } = useUserEntities()
  const entity = entities.find(e => e.id === Number(entityId))

  return {
    role: entity?.user_role,
    loading,
    isOwner: entity?.user_role === 'owner',
    isAdmin: entity?.user_role === 'admin' || entity?.user_role === 'owner',
    isEditor: ['editor', 'admin', 'owner'].includes(entity?.user_role || ''),
    isViewer: !!entity?.user_role, // Has any role = has access
  }
}

export function useHasPermission(entityId: number | string, requiredRole: UserRole) {
  const { role } = useUserRole(entityId)

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4,
  }

  if (!role) return false

  return roleHierarchy[role] >= roleHierarchy[requiredRole]
}
