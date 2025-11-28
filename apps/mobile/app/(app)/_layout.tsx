import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@financeapp/shared';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="add-transaction"
        options={{
          title: 'Add Transaction',
          presentation: 'modal',
          headerShown: true,
          headerTintColor: colors.primary[600],
        }}
      />
      <Stack.Screen
        name="scan-receipt"
        options={{
          title: 'Scan Receipt',
          presentation: 'modal',
          headerShown: true,
          headerTintColor: colors.primary[600],
        }}
      />
    </Stack>
  );
}
