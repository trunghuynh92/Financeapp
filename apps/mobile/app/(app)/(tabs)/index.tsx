import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useEntity } from '../../../contexts/EntityContext';
import { supabase } from '../../../lib/supabase';
import { EntitySwitcher } from '../../../components/EntitySwitcher';
import { colors, spacing, borderRadius, fontSize, shadows } from '@financeapp/shared';

interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  recentTransactionCount: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { currentEntity, isLoading: entityLoading } = useEntity();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!currentEntity) {
      setIsLoading(false);
      return;
    }

    try {
      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // First get cash & bank accounts only for this entity (exclude credit cards, loans, investments)
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', currentEntity.id)
        .in('account_type', ['bank', 'cash']);

      if (accountsError) throw accountsError;

      const accountIds = (accounts || []).map(a => a.account_id);

      // Calculate total balance using RPC function for each cash/bank account
      let totalBalance = 0;
      if (accountIds.length > 0) {
        const balancePromises = accountIds.map(async (accountId) => {
          const { data, error } = await supabase.rpc('calculate_account_balance', {
            p_account_id: accountId
          });
          return error ? 0 : (data || 0);
        });
        const balances = await Promise.all(balancePromises);
        totalBalance = balances.reduce((sum, b) => sum + b, 0);
      }

      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      let recentTransactionCount = 0;

      // Only fetch transactions if there are accounts
      if (accountIds.length > 0) {
        // Fetch monthly transactions for accounts belonging to this entity
        const { data: monthlyData, error: monthlyError } = await supabase
          .from('main_transaction')
          .select('amount, transaction_direction')
          .in('account_id', accountIds)
          .gte('transaction_date', startOfMonth)
          .lte('transaction_date', endOfMonth);

        if (monthlyError) throw monthlyError;

        // Calculate stats
        (monthlyData || []).forEach((tx) => {
          if (tx.transaction_direction === 'credit') {
            monthlyIncome += tx.amount;
          } else {
            monthlyExpenses += tx.amount;
          }
        });

        recentTransactionCount = monthlyData?.length || 0;
      }

      setStats({
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        recentTransactionCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentEntity]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (entityLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Entity Switcher */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'User'}</Text>
        <EntitySwitcher />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {!currentEntity ? (
          <View style={styles.noEntityContainer}>
            <Ionicons name="business-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.noEntityTitle}>No Entity Selected</Text>
            <Text style={styles.noEntityText}>
              You need to create or join an entity to start tracking finances
            </Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
          </View>
        ) : (
          <>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>
                {formatCurrency(stats?.totalBalance || 0)}
              </Text>
              <View style={styles.balanceIndicator}>
                <View style={[styles.indicatorDot, { backgroundColor: colors.success.main }]} />
                <Text style={styles.indicatorText}>
                  {currentEntity.name}
                </Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.incomeCard]}>
                <View style={styles.statIcon}>
                  <Ionicons name="arrow-down-circle" size={24} color={colors.success.main} />
                </View>
                <Text style={styles.statLabel}>Income</Text>
                <Text style={[styles.statAmount, { color: colors.success.main }]}>
                  {formatCurrency(stats?.monthlyIncome || 0)}
                </Text>
                <Text style={styles.statPeriod}>This month</Text>
              </View>

              <View style={[styles.statCard, styles.expenseCard]}>
                <View style={styles.statIcon}>
                  <Ionicons name="arrow-up-circle" size={24} color={colors.error.main} />
                </View>
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={[styles.statAmount, { color: colors.error.main }]}>
                  {formatCurrency(stats?.monthlyExpenses || 0)}
                </Text>
                <Text style={styles.statPeriod}>This month</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(app)/add-transaction')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
                    <Ionicons name="add" size={24} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.actionLabel}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(app)/scan-receipt')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
                    <Ionicons name="camera" size={24} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.actionLabel}>Scan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(app)/(tabs)/transactions')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
                    <Ionicons name="list" size={24} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.actionLabel}>History</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Monthly Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Monthly Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transactions</Text>
                <Text style={styles.summaryValue}>{stats?.recentTransactionCount || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net Flow</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        (stats?.monthlyIncome || 0) - (stats?.monthlyExpenses || 0) >= 0
                          ? colors.success.main
                          : colors.error.main,
                    },
                  ]}
                >
                  {formatCurrency((stats?.monthlyIncome || 0) - (stats?.monthlyExpenses || 0))}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
    paddingTop: 100,
  },
  header: {
    backgroundColor: colors.white,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  greeting: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.gray[900],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  noEntityContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: spacing.lg,
  },
  noEntityTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.gray[700],
    marginTop: spacing.md,
  },
  noEntityText: {
    fontSize: fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  balanceCard: {
    backgroundColor: colors.primary[600],
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    ...shadows.lg,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    color: colors.primary[100],
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  indicatorText: {
    fontSize: fontSize.sm,
    color: colors.primary[100],
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  incomeCard: {},
  expenseCard: {},
  statIcon: {
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  statAmount: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  statPeriod: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  quickActions: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    color: colors.gray[700],
  },
  summaryCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  summaryLabel: {
    fontSize: fontSize.base,
    color: colors.gray[600],
  },
  summaryValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.gray[900],
  },
});
