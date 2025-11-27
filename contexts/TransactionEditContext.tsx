'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MainTransactionDetails, TransactionType, Category, Branch, Project } from '@/types/main-transaction';
import { useEntity } from '@/contexts/EntityContext';

interface TransactionEditContextType {
  // Dialog state
  isEditDialogOpen: boolean;
  selectedTransaction: MainTransactionDetails | null;

  // Open dialog with a transaction (either pass full transaction or just ID)
  openEditDialog: (transaction: MainTransactionDetails) => void;
  openEditDialogById: (transactionId: number) => Promise<void>;
  closeEditDialog: () => void;

  // Lookup data for the dialog
  transactionTypes: TransactionType[];
  categories: Category[];
  branches: Branch[];
  projects: Project[];

  // Loading state
  isLoading: boolean;

  // Callback after successful edit
  onEditSuccess: () => void;
  setOnEditSuccessCallback: (callback: () => void) => void;
}

const TransactionEditContext = createContext<TransactionEditContextType | undefined>(undefined);

export function TransactionEditProvider({ children }: { children: React.ReactNode }) {
  const { currentEntity } = useEntity();

  // Dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<MainTransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Lookup data
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Success callback
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  // Load lookup data when entity changes
  useEffect(() => {
    if (currentEntity?.id) {
      loadLookupData();
    }
  }, [currentEntity?.id]);

  const loadLookupData = async () => {
    if (!currentEntity?.id) return;

    try {
      const [typesRes, categoriesRes, branchesRes, projectsRes] = await Promise.all([
        fetch('/api/transaction-types'),
        fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true`),
        fetch('/api/branches'),
        fetch(`/api/projects?entity_id=${currentEntity.id}`),
      ]);

      if (typesRes.ok) {
        const data = await typesRes.json();
        setTransactionTypes(data.transactionTypes || data);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories || data);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data.branches || data);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || data);
      }

      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading lookup data:', error);
    }
  };

  const openEditDialog = useCallback((transaction: MainTransactionDetails) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  }, []);

  const openEditDialogById = useCallback(async (transactionId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/main-transactions/${transactionId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setSelectedTransaction(result.data);
          setIsEditDialogOpen(true);
        }
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setSelectedTransaction(null);
  }, []);

  const onEditSuccess = useCallback(() => {
    closeEditDialog();
    if (successCallback) {
      successCallback();
    }
  }, [closeEditDialog, successCallback]);

  const setOnEditSuccessCallback = useCallback((callback: () => void) => {
    setSuccessCallback(() => callback);
  }, []);

  return (
    <TransactionEditContext.Provider
      value={{
        isEditDialogOpen,
        selectedTransaction,
        openEditDialog,
        openEditDialogById,
        closeEditDialog,
        transactionTypes,
        categories,
        branches,
        projects,
        isLoading,
        onEditSuccess,
        setOnEditSuccessCallback,
      }}
    >
      {children}
    </TransactionEditContext.Provider>
  );
}

export function useTransactionEdit() {
  const context = useContext(TransactionEditContext);
  if (context === undefined) {
    throw new Error('useTransactionEdit must be used within a TransactionEditProvider');
  }
  return context;
}
