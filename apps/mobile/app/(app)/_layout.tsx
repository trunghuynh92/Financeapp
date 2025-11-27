import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Transactions',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="add-transaction"
        options={{
          title: 'Add Transaction',
          presentation: 'modal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="scan-receipt"
        options={{
          title: 'Scan Receipt',
          presentation: 'modal',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
