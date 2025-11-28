import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useEntity } from '../../../contexts/EntityContext';
import { colors, spacing, borderRadius, fontSize, shadows } from '@financeapp/shared';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { currentEntity, entities } = useEntity();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={32} color={colors.primary[600]} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
                <Text style={styles.profileId}>ID: {user?.id?.slice(0, 8)}...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Entity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Entity</Text>
          <View style={styles.card}>
            {currentEntity ? (
              <>
                <View style={styles.entityRow}>
                  <Ionicons
                    name={
                      currentEntity.type === 'personal'
                        ? 'person-outline'
                        : currentEntity.type === 'business'
                        ? 'business-outline'
                        : 'people-outline'
                    }
                    size={24}
                    color={colors.primary[600]}
                  />
                  <View style={styles.entityInfo}>
                    <Text style={styles.entityName}>{currentEntity.name}</Text>
                    <Text style={styles.entityMeta}>
                      {currentEntity.type} - {currentEntity.user_role}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.entitiesCount}>
                  You have access to {entities.length} {entities.length === 1 ? 'entity' : 'entities'}
                </Text>
              </>
            ) : (
              <Text style={styles.noEntity}>No entity selected</Text>
            )}
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="information-circle-outline" size={24} color={colors.gray[600]} />
              <Text style={styles.menuLabel}>About</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color={colors.gray[600]} />
              <Text style={styles.menuLabel}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.error.main} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
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
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileEmail: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.gray[900],
  },
  profileId: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginTop: 2,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entityInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  entityName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.gray[900],
  },
  entityMeta: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    textTransform: 'capitalize',
    marginTop: 2,
  },
  entitiesCount: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing.sm,
  },
  noEntity: {
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.gray[900],
    marginLeft: spacing.md,
  },
  signOutButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  signOutText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.error.main,
    marginLeft: spacing.sm,
  },
  version: {
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
});
