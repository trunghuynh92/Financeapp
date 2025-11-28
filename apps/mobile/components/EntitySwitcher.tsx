import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEntity, Entity } from '../contexts/EntityContext';
import { colors, spacing, borderRadius, fontSize } from '@financeapp/shared';

export function EntitySwitcher() {
  const { entities, currentEntity, setCurrentEntity, isLoading } = useEntity();
  const [modalVisible, setModalVisible] = useState(false);

  if (isLoading || !currentEntity) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  const handleSelect = (entity: Entity) => {
    setCurrentEntity(entity);
    setModalVisible(false);
  };

  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return 'person-outline';
      case 'business':
        return 'business-outline';
      case 'family':
        return 'people-outline';
      default:
        return 'folder-outline';
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.entityInfo}>
          <Ionicons
            name={getEntityTypeIcon(currentEntity.type)}
            size={20}
            color={colors.primary[600]}
          />
          <View style={styles.entityText}>
            <Text style={styles.entityName} numberOfLines={1}>
              {currentEntity.name}
            </Text>
            <Text style={styles.entityType}>{currentEntity.type}</Text>
          </View>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.gray[500]}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Entity</Text>
            <FlatList
              data={entities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.entityItem,
                    item.id === currentEntity.id && styles.entityItemActive,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Ionicons
                    name={getEntityTypeIcon(item.type)}
                    size={24}
                    color={
                      item.id === currentEntity.id
                        ? colors.primary[600]
                        : colors.gray[500]
                    }
                  />
                  <View style={styles.entityItemText}>
                    <Text
                      style={[
                        styles.entityItemName,
                        item.id === currentEntity.id && styles.entityItemNameActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.entityItemMeta}>
                      {item.type} - {item.user_role}
                    </Text>
                  </View>
                  {item.id === currentEntity.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary[600]}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  placeholder: {
    height: 48,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  entityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entityText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  entityName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.gray[900],
  },
  entityType: {
    fontSize: fontSize.xs,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '60%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.gray[900],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  entityItemActive: {
    backgroundColor: colors.primary[50],
  },
  entityItemText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  entityItemName: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.gray[900],
  },
  entityItemNameActive: {
    color: colors.primary[700],
  },
  entityItemMeta: {
    fontSize: fontSize.sm,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
});
