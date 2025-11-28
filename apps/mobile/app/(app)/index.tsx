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
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

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
  const { user, signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
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
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch accounts and transaction types separately to avoid PGRST201 error
      const [accountsRes, typesRes] = await Promise.all([
        supabase.from('accounts').select('account_id, account_name'),
        supabase.from('transaction_types').select('transaction_type_id, type_display_name'),
      ]);

      const accountsMap = new Map(
        (accountsRes.data || []).map(a => [a.account_id, a.account_name])
      );
      const typesMap = new Map(
        (typesRes.data || []).map(t => [t.transaction_type_id, t.type_display_name])
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
  }, []);

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
        <View style={styles.transactionMain}>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description || 'No description'}
            </Text>
            <Text style={styles.transactionMeta}>
              {item.account?.account_name || 'Unknown'} • {item.transaction_type?.type_display_name || 'Unknown'}
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
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.main_transaction_id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first transaction
            </Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(app)/add-transaction')}
        >
          <Text style={styles.addButtonText}>+ Add Transaction</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push('/(app)/scan-receipt')}
        >
          <Text style={styles.scanButtonText}>Scan Receipt</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 180,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  transactionMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountDebit: {
    color: '#ef4444',
  },
  amountCredit: {
    color: '#10b981',
  },
  dateText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
  },
});
