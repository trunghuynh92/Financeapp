import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEntity } from '../../../contexts/EntityContext';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, borderRadius, fontSize, shadows } from '@financeapp/shared';

type Transaction = {
  main_transaction_id: number;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_direction: string;
  account_id: number | null;
  transaction_type_id: number | null;
  account: { account_name: string } | null;
  transaction_type: { type_display_name: string } | null;
};

export default function TransactionsScreen() {
  const { currentEntity } = useEntity();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!currentEntity) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      // First get accounts for this entity
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('account_id, account_name')
        .eq('entity_id', currentEntity.id);

      if (accountsError) throw accountsError;

      const accountIds = (accountsData || []).map(a => a.account_id);

      if (accountIds.length === 0) {
        setTransactions([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Fetch transactions for accounts belonging to this entity
      const { data, error } = await supabase
        .from('main_transaction')
        .select(`
          main_transaction_id,
          transaction_date,
          description,
          amount,
          transaction_direction,
          account_id,
          transaction_type_id
        `)
        .in('account_id', accountIds)
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch transaction types
      const { data: typesData, error: typesError } = await supabase
        .from('transaction_types')
        .select('transaction_type_id, type_display_name');

      if (typesError) throw typesError;

      const accountsMap = new Map(
        (accountsData || []).map(a => [a.account_id, a.account_name])
      );
      const typesMap = new Map(
        (typesData || []).map(t => [t.transaction_type_id, t.type_display_name])
      );

      // Map the data with account and type names
      const transactionsWithNames = (data || []).map(tx => ({
        ...tx,
        account: { account_name: accountsMap.get(tx.account_id) || 'Unknown' },
        transaction_type: { type_display_name: typesMap.get(tx.transaction_type_id) || 'Unknown' },
      }));

      setTransactions(transactionsWithNames);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentEntity]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isDebit = item.transaction_direction === 'debit';

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => router.push(`/(app)/add-transaction?id=${item.main_transaction_id}`)}
      >
        <View style={styles.transactionIcon}>
          <Ionicons
            name={isDebit ? 'arrow-up-circle' : 'arrow-down-circle'}
            size={32}
            color={isDebit ? colors.error.main : colors.success.main}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.transactionMeta}>
            {item.account?.account_name || 'Unknown'} - {item.transaction_type?.type_display_name || 'Unknown'}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text
            style={[
              styles.amountText,
              isDebit ? styles.amountDebit : styles.amountCredit,
            ]}
          >
            {isDebit ? '-' : '+'}{formatCurrency(item.amount)}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.transaction_date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        {currentEntity && (
          <Text style={styles.headerSubtitle}>{currentEntity.name}</Text>
        )}
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.main_transaction_id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the button below to add your first transaction
            </Text>
          </View>
        }
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => router.push('/(app)/scan-receipt')}
        >
          <Ionicons name="camera" size={24} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => router.push('/(app)/add-transaction')}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.gray[900],
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginTop: 2,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  transactionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  transactionIcon: {
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  transactionDescription: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.gray[900],
    marginBottom: 2,
  },
  transactionMeta: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  amountDebit: {
    color: colors.error.main,
  },
  amountCredit: {
    color: colors.success.main,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.gray[700],
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabPrimary: {
    backgroundColor: colors.primary[600],
  },
  fabSecondary: {
    backgroundColor: colors.gray[600],
  },
});
