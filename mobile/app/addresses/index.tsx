import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows, FontFamily } from '../../src/constants/theme';
import { useLocation } from '../../src/context/LocationContext';

export default function AddressesScreen() {
  const router = useRouter();
  const { address } = useLocation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.currentCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="my-location" size={20} color={Colors.primary} />
            <Text style={styles.cardLabel}>Current Detected Address</Text>
          </View>
          <Text style={styles.addressText}>{address}</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="home-work" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Manage Addresses</Text>
          <Text style={styles.emptySubtitle}>
            Save home, work, and other addresses for 1-tap checkout.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  currentCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  cardLabel: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  addressText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  cityText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
});
