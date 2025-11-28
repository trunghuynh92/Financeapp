import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
  user_role: UserRole;
}

interface EntityContextType {
  entities: Entity[];
  currentEntity: Entity | null;
  setCurrentEntity: (entity: Entity) => void;
  isLoading: boolean;
  error: string | null;
  refreshEntities: () => Promise<void>;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

const STORAGE_KEY = 'financeapp_current_entity_id';

export function EntityProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [currentEntity, setCurrentEntityState] = useState<Entity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    if (!user) {
      setEntities([]);
      setCurrentEntityState(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('entities')
        .select(`
          *,
          entity_users!inner(role)
        `)
        .eq('entity_users.user_id', user.id);

      if (fetchError) throw fetchError;

      const entitiesWithRole: Entity[] = (data || []).map((entity: any) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        owner_user_id: entity.owner_user_id,
        user_role: entity.entity_users[0].role as UserRole,
      }));

      setEntities(entitiesWithRole);

      // Restore last selected entity from storage
      const storedEntityId = await AsyncStorage.getItem(STORAGE_KEY);
      const storedEntity = entitiesWithRole.find(e => e.id === storedEntityId);

      if (storedEntity) {
        setCurrentEntityState(storedEntity);
      } else if (entitiesWithRole.length > 0) {
        // Default to first entity
        setCurrentEntityState(entitiesWithRole[0]);
        await AsyncStorage.setItem(STORAGE_KEY, entitiesWithRole[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching entities:', err);
      setError(err.message || 'Failed to load entities');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const setCurrentEntity = async (entity: Entity) => {
    setCurrentEntityState(entity);
    await AsyncStorage.setItem(STORAGE_KEY, entity.id);
  };

  const refreshEntities = async () => {
    setIsLoading(true);
    await fetchEntities();
  };

  return (
    <EntityContext.Provider
      value={{
        entities,
        currentEntity,
        setCurrentEntity,
        isLoading,
        error,
        refreshEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (context === undefined) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
}
