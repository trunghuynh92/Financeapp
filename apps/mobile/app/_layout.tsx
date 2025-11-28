import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { EntityProvider } from '../contexts/EntityContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EntityProvider>
          <Slot />
        </EntityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
