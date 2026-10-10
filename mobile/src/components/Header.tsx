import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';
import LocationSelectorModal from './LocationSelectorModal';

export default function Header() {
  const router = useRouter();
  const { address, isLoading } = useLocation();
  const { user, token } = useAuth();
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  return (
    <>
      <View style={styles.header}>
        {/* Deliver To location selector: Tapping ONLY opens picker modal, NEVER calls GPS */}
        <Pressable
          style={styles.locationButton}
          onPress={() => setIsLocationModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Deliver to location picker"
        >
          <View style={styles.pinCircle}>
            <MaterialIcons
              name={isLoading ? 'hourglass-empty' : 'location-on'}
              size={20}
              color={Colors.primary}
            />
          </View>
          <View style={styles.locationTextGroup}>
            <Text style={styles.deliverToLabel}>Deliver to</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {isLoading ? 'Locating...' : address || 'Select location'}
            </Text>
          </View>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={Colors.textMuted} />
        </Pressable>

      </View>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadows.sm,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flex: 1,
    marginRight: Spacing.md,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextGroup: {
    flexShrink: 1,
  },
  deliverToLabel: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  addressText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  avatarButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLogged: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInPill: {
    backgroundColor: Colors.primaryAlpha10,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
  },
  signInText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
