import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Account = {
  account_id: number;
  account_name: string;
};

type TransactionType = {
  transaction_type_id: number;
  type_display_name: string;
};

export default function AddTransactionScreen() {
  const { id, prefillAmount, prefillDescription, prefillDate } = useLocalSearchParams<{
    id?: string;
    prefillAmount?: string;
    prefillDescription?: string;
    prefillDate?: string;
  }>();
  const isEditing = !!id;

  const [description, setDescription] = useState(prefillDescription || '');
  const [amount, setAmount] = useState(prefillAmount || '');
  const [isDebit, setIsDebit] = useState(true);
  const [date, setDate] = useState(prefillDate || new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Fetch accounts and transaction types
      const [accountsRes, typesRes] = await Promise.all([
        supabase.from('accounts').select('account_id, account_name').order('account_name'),
        supabase.from('transaction_types').select('transaction_type_id, type_display_name').order('type_display_name'),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (typesRes.data) setTransactionTypes(typesRes.data);

      // If editing, fetch the transaction
      if (id) {
        const { data: transaction } = await supabase
          .from('main_transaction')
          .select('*')
          .eq('main_transaction_id', id)
          .single();

        if (transaction) {
          setDescription(transaction.description || '');
          setDate(transaction.transaction_date);
          setSelectedAccount(transaction.account_id?.toString() || '');
          setSelectedType(transaction.transaction_type_id?.toString() || '');
          setAmount(transaction.amount?.toString() || '');
          setIsDebit(transaction.transaction_direction === 'debit');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!amount || !selectedAccount || !selectedType) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const rawTransactionId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert into original_transaction - trigger will auto-create main_transaction
      const originalTransactionData = {
        raw_transaction_id: rawTransactionId,
        account_id: parseInt(selectedAccount),
        transaction_date: date,
        description,
        debit_amount: isDebit ? parseFloat(amount) : null,
        credit_amount: !isDebit ? parseFloat(amount) : null,
        transaction_source: 'user_manual',
      };

      if (isEditing) {
        // For editing, update the main_transaction directly
        const { error } = await supabase
          .from('main_transaction')
          .update({
            description,
            transaction_date: date,
            account_id: parseInt(selectedAccount),
            transaction_type_id: parseInt(selectedType),
            amount: parseFloat(amount),
            transaction_direction: isDebit ? 'debit' : 'credit',
          })
          .eq('main_transaction_id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('original_transaction')
          .insert(originalTransactionData);
        if (error) throw error;
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // First get the raw_transaction_id from main_transaction
              const { data: tx } = await supabase
                .from('main_transaction')
                .select('raw_transaction_id')
                .eq('main_transaction_id', id)
                .single();

              if (tx?.raw_transaction_id) {
                // Delete from original_transaction - cascade will delete main_transaction
                const { error } = await supabase
                  .from('original_transaction')
                  .delete()
                  .eq('raw_transaction_id', tx.raw_transaction_id);
                if (error) throw error;
              }
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete');
            }
          },
        },
      ]
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isDebit && styles.toggleActive]}
              onPress={() => setIsDebit(true)}
            >
              <Text style={[styles.toggleText, isDebit && styles.toggleTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isDebit && styles.toggleActiveCredit]}
              onPress={() => setIsDebit(false)}
            >
              <Text style={[styles.toggleText, !isDebit && styles.toggleTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipContainer}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.account_id}
                  style={[
                    styles.chip,
                    selectedAccount === account.account_id.toString() && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedAccount(account.account_id.toString())}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedAccount === account.account_id.toString() && styles.chipTextSelected,
                    ]}
                  >
                    {account.account_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipContainer}>
              {transactionTypes.map((type) => (
                <TouchableOpacity
                  key={type.transaction_type_id}
                  style={[
                    styles.chip,
                    selectedType === type.transaction_type_id.toString() && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedType(type.transaction_type_id.toString())}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedType === type.transaction_type_id.toString() && styles.chipTextSelected,
                    ]}
                  >
                    {type.type_display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update' : 'Save'} Transaction
              </Text>
            )}
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete Transaction</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  toggleActiveCredit: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#fff',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#fff',
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
  },
});
