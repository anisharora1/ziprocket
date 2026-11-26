import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { useThemeColors } from '../context/ThemeCampaignProvider';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';
import LocationSelectorModal from './LocationSelectorModal';

function Header() {
  const { address, isLoading } = useLocation();
  const themeColors = useThemeColors();
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const isThemed = Boolean(themeColors);
  const headerTextColor = themeColors?.headerText;

  return (
    <>
      <View
        style={[
          styles.header,
          isThemed && styles.themedHeader,
        ]}
      >
        {/* Deliver To location selector: Tapping ONLY opens picker modal, NEVER calls GPS */}
        <Pressable
          style={({ pressed }) => [styles.locationButton, pressed && { opacity: 0.85 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setIsLocationModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Deliver to location picker"
        >
          <View
            style={[
              styles.pinCircle,
              isThemed && { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
            ]}
          >
            <MaterialIcons
              name={isLoading ? 'hourglass-empty' : 'location-on'}
              size={20}
              color={headerTextColor || Colors.primary}
            />
          </View>
          <View style={styles.locationTextGroup}>
            <Text
              style={[
                styles.deliverToLabel,
                headerTextColor ? { color: headerTextColor } : null,
              ]}
            >
              Deliver to
            </Text>
            <Text
              style={[
                styles.addressText,
                headerTextColor ? { color: headerTextColor, opacity: 0.88 } : null,
              ]}
              numberOfLines={1}
            >
              {isLoading ? 'Locating...' : address || 'Select location'}
            </Text>
          </View>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={20}
            color={headerTextColor || Colors.textMuted}
          />
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

export default React.memo(Header);

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
  themedHeader: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flex: 1,
    marginRight: Spacing.md,
    minHeight: 44,
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
