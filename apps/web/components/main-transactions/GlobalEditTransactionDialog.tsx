'use client';

import { useTransactionEdit } from '@/contexts/TransactionEditContext';
import { EditTransactionDialog } from './EditTransactionDialog';

export function GlobalEditTransactionDialog() {
  const {
    isEditDialogOpen,
    selectedTransaction,
    closeEditDialog,
    onEditSuccess,
    transactionTypes,
    categories,
    branches,
    projects,
  } = useTransactionEdit();

  return (
    <EditTransactionDialog
      transaction={selectedTransaction}
      open={isEditDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeEditDialog();
      }}
      onSuccess={onEditSuccess}
      transactionTypes={transactionTypes}
      categories={categories}
      branches={branches}
      projects={projects}
    />
  );
}
