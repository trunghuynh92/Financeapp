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
  Modal,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../contexts/EntityContext';
import { colors, spacing, borderRadius, fontSize } from '@financeapp/shared';

type Account = {
  account_id: number;
  account_name: string;
};

type TransactionType = {
  transaction_type_id: number;
  type_code: string;
  type_display_name: string;
};

type Category = {
  category_id: number;
  category_code: string;
  category_name: string;
  transaction_type_id: number;
};

export default function AddTransactionScreen() {
  const { id, prefillAmount, prefillDescription, prefillDate, prefillTypeCode, prefillCategoryCode } = useLocalSearchParams<{
    id?: string;
    prefillAmount?: string;
    prefillDescription?: string;
    prefillDate?: string;
    prefillTypeCode?: string; // e.g., 'EXP' for Expense from receipt scanning
    prefillCategoryCode?: string; // e.g., 'FOOD' for Food & Dining from AI
  }>();
  const isEditing = !!id;
  const { currentEntity } = useEntity();

  const [description, setDescription] = useState(prefillDescription || '');
  const [amount, setAmount] = useState(prefillAmount || '');
  const [date, setDate] = useState(prefillDate || new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');

  useEffect(() => {
    loadData();
  }, [id, currentEntity]);

  const loadData = async () => {
    if (!currentEntity) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch accounts (only bank & cash for current entity), transaction types, and categories
      const [accountsRes, typesRes, categoriesRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('account_id, account_name')
          .eq('entity_id', currentEntity.id)
          .in('account_type', ['bank', 'cash'])
          .eq('is_active', true)
          .order('account_name'),
        supabase
          .from('transaction_types')
          .select('transaction_type_id, type_code, type_display_name')
          .order('display_order'),
        supabase
          .from('categories')
          .select('category_id, category_code, category_name, transaction_type_id')
          .order('category_name'),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (typesRes.data) {
        setTransactionTypes(typesRes.data);

        // If prefillTypeCode is provided (e.g., from receipt scanning), auto-select the type
        if (prefillTypeCode && !id) {
          const matchingType = typesRes.data.find(t => t.type_code === prefillTypeCode);
          if (matchingType) {
            setSelectedTypeId(matchingType.transaction_type_id.toString());
          }
        }
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);

        // If prefillCategoryCode is provided (from AI receipt parsing), auto-select the category
        if (prefillCategoryCode && !id) {
          const matchingCategory = categoriesRes.data.find(c => c.category_code === prefillCategoryCode);
          if (matchingCategory) {
            setSelectedCategoryId(matchingCategory.category_id.toString());
          }
        }
      }

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
          setSelectedTypeId(transaction.transaction_type_id?.toString() || '');
          setSelectedCategoryId(transaction.category_id?.toString() || '');
          setAmount(transaction.amount?.toString() || '');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get filtered categories based on selected transaction type
  const filteredCategories = selectedTypeId
    ? categories.filter(c => c.transaction_type_id === parseInt(selectedTypeId))
    : categories;

  // Get the selected items
  const selectedType = transactionTypes.find(t => t.transaction_type_id.toString() === selectedTypeId);
  const selectedAccountObj = accounts.find(a => a.account_id.toString() === selectedAccount);
  const selectedCategoryObj = categories.find(c => c.category_id.toString() === selectedCategoryId);

  // Parse date string to Date object for the picker
  const dateValue = new Date(date + 'T00:00:00');

  // Handle date change from picker
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setDate(formattedDate);
    }
  };

  // Format date for display
  const formatDisplayDate = (dateString: string) => {
    const d = new Date(dateString + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculator functions
  const openCalculator = () => {
    setCalcExpression(amount || '');
    setShowCalculator(true);
  };

  const evaluateExpression = (expr: string): string => {
    try {
      // Replace × with * and ÷ with /
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
      // Only allow numbers, operators, and decimal points
      if (!/^[\d+\-*/.\s()]+$/.test(sanitized)) return expr;
      // Evaluate the expression
      const result = Function('"use strict"; return (' + sanitized + ')')();
      if (isNaN(result) || !isFinite(result)) return expr;
      // Round to 2 decimal places
      return Math.round(result * 100) / 100 + '';
    } catch {
      return expr;
    }
  };

  const handleCalcPress = async (value: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value === 'C') {
      setCalcExpression('');
    } else if (value === '⌫') {
      setCalcExpression(prev => prev.slice(0, -1));
    } else if (value === '=') {
      const result = evaluateExpression(calcExpression);
      setCalcExpression(result);
    } else if (value === 'Done') {
      const result = evaluateExpression(calcExpression);
      setAmount(result);
      setShowCalculator(false);
    } else {
      // Prevent multiple operators in a row
      const lastChar = calcExpression.slice(-1);
      const isOperator = ['+', '-', '×', '÷'].includes(value);
      const lastIsOperator = ['+', '-', '×', '÷'].includes(lastChar);

      if (isOperator && lastIsOperator) {
        // Replace last operator
        setCalcExpression(prev => prev.slice(0, -1) + value);
      } else if (value === '.' && calcExpression.includes('.')) {
        // Check if we already have a decimal in the current number
        const parts = calcExpression.split(/[+\-×÷]/);
        const currentNumber = parts[parts.length - 1];
        if (!currentNumber.includes('.')) {
          setCalcExpression(prev => prev + value);
        }
      } else {
        setCalcExpression(prev => prev + value);
      }
    }
  };

  const formatCalcDisplay = (expr: string) => {
    if (!expr) return '0';
    // Format number with thousand separators for display
    return expr;
  };

  const handleSave = async () => {
    if (!amount || !selectedAccount || !selectedTypeId) {
      Alert.alert('Error', 'Please fill in amount, account, and transaction type');
      return;
    }

    setIsSaving(true);
    try {
      // Determine transaction direction based on type_code
      const isDebit = selectedType?.type_code === 'EXP' ||
                      selectedType?.type_code === 'TRF_OUT' ||
                      selectedType?.type_code === 'DEBT_PAY' ||
                      selectedType?.type_code === 'LOAN_DISBURSE' ||
                      selectedType?.type_code === 'INV_CONTRIB' ||
                      selectedType?.type_code === 'CAPITAL_OUT' ||
                      selectedType?.type_code === 'DIVIDEND';

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
            transaction_type_id: parseInt(selectedTypeId),
            category_id: selectedCategoryId ? parseInt(selectedCategoryId) : null,
            amount: parseFloat(amount),
            transaction_direction: isDebit ? 'debit' : 'credit',
          })
          .eq('main_transaction_id', id);
        if (error) throw error;
      } else {
        // First insert original transaction (trigger creates main_transaction)
        const { error: originalError } = await supabase
          .from('original_transaction')
          .insert(originalTransactionData);
        if (originalError) throw originalError;

        // Then update the main_transaction with type and category
        const { error: updateError } = await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: parseInt(selectedTypeId),
            category_id: selectedCategoryId ? parseInt(selectedCategoryId) : null,
          })
          .eq('raw_transaction_id', rawTransactionId);
        if (updateError) throw updateError;
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
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!currentEntity) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.noEntityText}>Please select an entity first</Text>
      </View>
    );
  }

  // Render picker modal
  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    data: { id: string; label: string; selected: boolean }[],
    onSelect: (id: string) => void
  ) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item.selected && styles.modalItemSelected]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <Text style={[styles.modalItemText, item.selected && styles.modalItemTextSelected]}>
                  {item.label}
                </Text>
                {item.selected && (
                  <Ionicons name="checkmark" size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            )}
            style={styles.modalList}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Amount with Calculator */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount *</Text>
          <TouchableOpacity
            style={styles.amountButton}
            onPress={openCalculator}
          >
            <View style={styles.amountContent}>
              <View style={styles.amountIconContainer}>
                <Ionicons name="calculator" size={20} color={colors.primary[600]} />
              </View>
              <Text style={amount ? styles.amountText : styles.amountPlaceholder}>
                {amount ? new Intl.NumberFormat('vi-VN').format(parseFloat(amount)) : 'Tap to enter amount'}
              </Text>
            </View>
            <Text style={styles.amountCurrency}>VND</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction Type Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Transaction Type *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, selectedType && styles.pickerButtonSelected]}
            onPress={() => setShowTypeModal(true)}
          >
            <View style={styles.pickerContent}>
              {selectedType && (
                <View style={[styles.pickerIcon, { backgroundColor: colors.primary[100] }]}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.primary[600]} />
                </View>
              )}
              <Text style={selectedType ? styles.pickerTextSelected : styles.pickerPlaceholder}>
                {selectedType?.type_display_name || 'Select transaction type'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={selectedType ? colors.primary[600] : colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Account Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, selectedAccountObj && styles.pickerButtonSelected]}
            onPress={() => setShowAccountModal(true)}
          >
            <View style={styles.pickerContent}>
              {selectedAccountObj && (
                <View style={[styles.pickerIcon, { backgroundColor: colors.success.light }]}>
                  <Ionicons name="wallet" size={16} color={colors.success.main} />
                </View>
              )}
              <Text style={selectedAccountObj ? styles.pickerTextSelected : styles.pickerPlaceholder}>
                {selectedAccountObj?.account_name || 'Select account'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={selectedAccountObj ? colors.primary[600] : colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Category Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={[
              styles.pickerButton,
              !selectedTypeId && styles.pickerButtonDisabled,
              selectedCategoryObj && styles.pickerButtonSelected,
            ]}
            onPress={() => selectedTypeId && setShowCategoryModal(true)}
            disabled={!selectedTypeId}
          >
            <View style={styles.pickerContent}>
              {selectedCategoryObj && (
                <View style={[styles.pickerIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="pricetag" size={16} color="#D97706" />
                </View>
              )}
              <Text style={selectedCategoryObj ? styles.pickerTextSelected : styles.pickerPlaceholder}>
                {selectedCategoryObj?.category_name || (selectedTypeId ? 'Select category' : 'Select type first')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={selectedCategoryObj ? colors.primary[600] : colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={[styles.pickerButton, styles.datePickerButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.pickerContent}>
              <View style={[styles.pickerIcon, { backgroundColor: colors.info?.light || '#DBEAFE' }]}>
                <Ionicons name="calendar" size={16} color={colors.info?.main || '#2563EB'} />
              </View>
              <Text style={styles.datePickerText}>{formatDisplayDate(date)}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.primary[600]} />
          </TouchableOpacity>

          {/* iOS: Show inline picker below button when active */}
          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                style={styles.datePicker}
              />
            </View>
          )}

          {/* Android: Show modal dialog */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
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

      {/* Modals */}
      {renderPickerModal(
        showTypeModal,
        () => setShowTypeModal(false),
        'Select Transaction Type',
        transactionTypes.map(t => ({
          id: t.transaction_type_id.toString(),
          label: t.type_display_name,
          selected: t.transaction_type_id.toString() === selectedTypeId,
        })),
        (id) => {
          setSelectedTypeId(id);
          setSelectedCategoryId(''); // Reset category when type changes
        }
      )}

      {renderPickerModal(
        showAccountModal,
        () => setShowAccountModal(false),
        'Select Account',
        accounts.map(a => ({
          id: a.account_id.toString(),
          label: a.account_name,
          selected: a.account_id.toString() === selectedAccount,
        })),
        setSelectedAccount
      )}

      {renderPickerModal(
        showCategoryModal,
        () => setShowCategoryModal(false),
        'Select Category',
        filteredCategories.map(c => ({
          id: c.category_id.toString(),
          label: c.category_name,
          selected: c.category_id.toString() === selectedCategoryId,
        })),
        setSelectedCategoryId
      )}

      {/* Calculator Modal */}
      <Modal visible={showCalculator} animationType="slide" transparent>
        <View style={styles.calcModalOverlay}>
          <View style={styles.calcModalContent}>
            {/* Calculator Display */}
            <View style={styles.calcDisplay}>
              <Text style={styles.calcDisplayText} numberOfLines={1} adjustsFontSizeToFit>
                {formatCalcDisplay(calcExpression)}
              </Text>
              {calcExpression && /[+\-×÷]/.test(calcExpression) && (
                <Text style={styles.calcResultPreview}>
                  = {evaluateExpression(calcExpression)}
                </Text>
              )}
            </View>

            {/* Calculator Buttons */}
            <View style={styles.calcButtonsContainer}>
              {/* Row 1 */}
              <View style={styles.calcRow}>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonGray]} onPress={() => handleCalcPress('C')}>
                  <Text style={styles.calcButtonTextGray}>C</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonGray]} onPress={() => handleCalcPress('⌫')}>
                  <Ionicons name="backspace-outline" size={24} color={colors.gray[700]} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonGray]} onPress={() => handleCalcPress('÷')}>
                  <Text style={styles.calcButtonTextGray}>÷</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonOrange]} onPress={() => handleCalcPress('×')}>
                  <Text style={styles.calcButtonTextWhite}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2 */}
              <View style={styles.calcRow}>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('7')}>
                  <Text style={styles.calcButtonText}>7</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('8')}>
                  <Text style={styles.calcButtonText}>8</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('9')}>
                  <Text style={styles.calcButtonText}>9</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonOrange]} onPress={() => handleCalcPress('-')}>
                  <Text style={styles.calcButtonTextWhite}>−</Text>
                </TouchableOpacity>
              </View>

              {/* Row 3 */}
              <View style={styles.calcRow}>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('4')}>
                  <Text style={styles.calcButtonText}>4</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('5')}>
                  <Text style={styles.calcButtonText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('6')}>
                  <Text style={styles.calcButtonText}>6</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonOrange]} onPress={() => handleCalcPress('+')}>
                  <Text style={styles.calcButtonTextWhite}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Row 4 */}
              <View style={styles.calcRow}>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('1')}>
                  <Text style={styles.calcButtonText}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('2')}>
                  <Text style={styles.calcButtonText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('3')}>
                  <Text style={styles.calcButtonText}>3</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonOrange]} onPress={() => handleCalcPress('=')}>
                  <Text style={styles.calcButtonTextWhite}>=</Text>
                </TouchableOpacity>
              </View>

              {/* Row 5 */}
              <View style={styles.calcRow}>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonWide]} onPress={() => handleCalcPress('0')}>
                  <Text style={styles.calcButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcButton} onPress={() => handleCalcPress('.')}>
                  <Text style={styles.calcButtonText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcButton, styles.calcButtonDone]} onPress={() => handleCalcPress('Done')}>
                  <Text style={styles.calcButtonTextWhite}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.calcCancelButton}
              onPress={() => setShowCalculator(false)}
            >
              <Text style={styles.calcCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  noEntityText: {
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.gray[700],
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.gray[900],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  // Picker Button (iOS-style)
  pickerButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  pickerButtonDisabled: {
    backgroundColor: colors.gray[100],
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  pickerText: {
    fontSize: fontSize.base,
    color: colors.gray[900],
  },
  pickerTextSelected: {
    fontSize: fontSize.base,
    color: colors.primary[700],
    fontWeight: '600',
  },
  pickerPlaceholder: {
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.gray[900],
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalList: {
    paddingBottom: spacing.xl,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  modalItemSelected: {
    backgroundColor: colors.primary[50],
  },
  modalItemText: {
    fontSize: fontSize.base,
    color: colors.gray[700],
  },
  modalItemTextSelected: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  // Date Picker Styles
  datePickerButton: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  datePickerText: {
    fontSize: fontSize.base,
    color: '#4338CA',
    fontWeight: '600',
  },
  datePickerContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  datePickerDone: {
    fontSize: fontSize.base,
    color: colors.primary[600],
    fontWeight: '600',
  },
  datePicker: {
    height: 200,
  },
  // Buttons
  buttonContainer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.error.main,
    fontSize: fontSize.sm,
  },
  // Amount Button Styles
  amountButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  amountIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  amountText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.gray[900],
  },
  amountPlaceholder: {
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
  amountCurrency: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  // Calculator Modal Styles
  calcModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calcModalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
  },
  calcDisplay: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'flex-end',
    minHeight: 100,
    justifyContent: 'flex-end',
  },
  calcDisplayText: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.white,
  },
  calcResultPreview: {
    fontSize: fontSize.lg,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  calcButtonsContainer: {
    paddingHorizontal: spacing.sm,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calcButton: {
    width: (Dimensions.get('window').width - spacing.sm * 5) / 4,
    height: (Dimensions.get('window').width - spacing.sm * 5) / 4,
    borderRadius: (Dimensions.get('window').width - spacing.sm * 5) / 8,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcButtonWide: {
    width: ((Dimensions.get('window').width - spacing.sm * 5) / 4) * 2 + spacing.sm,
    borderRadius: (Dimensions.get('window').width - spacing.sm * 5) / 8,
    alignItems: 'flex-start',
    paddingLeft: ((Dimensions.get('window').width - spacing.sm * 5) / 4) / 2.5,
  },
  calcButtonGray: {
    backgroundColor: '#A5A5A5',
  },
  calcButtonOrange: {
    backgroundColor: '#FF9500',
  },
  calcButtonDone: {
    backgroundColor: colors.primary[600],
  },
  calcButtonText: {
    fontSize: 32,
    fontWeight: '400',
    color: colors.white,
  },
  calcButtonTextGray: {
    fontSize: 32,
    fontWeight: '400',
    color: '#1C1C1E',
  },
  calcButtonTextWhite: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.white,
  },
  calcCancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  calcCancelText: {
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
});
