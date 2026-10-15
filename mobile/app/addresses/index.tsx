import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  FontFamily,
} from '../../src/constants/theme';
import { useLocation, SavedAddress } from '../../src/context/LocationContext';
import LocationSelectorModal from '../../src/components/LocationSelectorModal';

export default function AddressesScreen() {
  const router = useRouter();
  const { address, savedAddresses, selectedAddressId, setSelectedAddress } = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <Pressable onPress={() => setIsModalOpen(true)} style={styles.addBtn} hitSlop={8}>
          <MaterialIcons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Active Location */}
        <Pressable style={styles.currentCard} onPress={() => setIsModalOpen(true)}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="my-location" size={18} color={Colors.primary} />
            <Text style={styles.cardLabel}>Active Delivery Location</Text>
          </View>
          <Text style={styles.addressText}>{address || 'Select a delivery location'}</Text>
          <Text style={styles.tapChangeText}>Tap to change</Text>
        </Pressable>

        {/* Saved Addresses List */}
        {savedAddresses.length > 0 ? (
          <View style={styles.addressListContainer}>
            <Text style={styles.sectionHeader}>YOUR ADDRESS BOOK</Text>
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr._id;
              let iconName: 'home' | 'work' | 'business' = 'home';
              if (addr.label === 'Work') iconName = 'work';
              if (addr.label === 'Other') iconName = 'business';

              return (
                <Pressable
                  key={addr._id}
                  style={[styles.addrCard, isSelected && styles.addrCardSelected]}
                  onPress={() => setSelectedAddress(addr)}
                >
                  <View style={styles.addrCardLeft}>
                    <View
                      style={[
                        styles.iconCircleSmall,
                        isSelected && styles.iconCircleSmallSelected,
                      ]}
                    >
                      <MaterialIcons
                        name={iconName}
                        size={18}
                        color={isSelected ? Colors.primary : Colors.textSecondary}
                      />
                    </View>
                    <View style={styles.addrTextCol}>
                      <View style={styles.labelRow}>
                        <Text style={styles.addrLabel}>{addr.label}</Text>
                        {addr.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.addrFullText} numberOfLines={2}>
                        {addr.fullAddress}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
                  >
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="home-work" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Manage Addresses</Text>
            <Text style={styles.emptySubtitle}>
              Save home, work, and other addresses for 1-tap checkout.
            </Text>
            <Pressable
              style={styles.addAddressButton}
              onPress={() => setIsModalOpen(true)}
            >
              <MaterialIcons name="add" size={18} color={Colors.surface} style={{ marginRight: 6 }} />
              <Text style={styles.addAddressButtonText}>Add New Address</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <LocationSelectorModal visible={isModalOpen} onClose={() => setIsModalOpen(false)} />
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
  addBtn: {
    padding: Spacing.xs,
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
  tapChangeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.primary,
    marginTop: 6,
  },
  sectionHeader: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  addressListContainer: {
    gap: Spacing.sm,
  },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  addrCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFBF8',
  },
  addrCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconCircleSmallSelected: {
    backgroundColor: Colors.primaryAlpha10,
  },
  addrTextCol: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addrLabel: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  defaultBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.emerald700,
    textTransform: 'uppercase',
  },
  addrFullText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primaryAlpha10,
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
    marginBottom: Spacing.lg,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  addAddressButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.surface,
  },
});
