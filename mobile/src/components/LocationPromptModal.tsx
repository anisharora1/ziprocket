import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

interface LocationPromptModalProps {
  onManualTrigger?: () => void;
}

export default function LocationPromptModal({ onManualTrigger }: LocationPromptModalProps = {}) {
  const { isFirstTime, fetchLocation, isLoading, error, dismissPrompt, openPicker } = useLocation();

  if (!isFirstTime) return null;

  const handleUseLocation = async () => {
    if (onManualTrigger) {
      onManualTrigger();
    }
    await fetchLocation();
  };

  const handleManualSearchClick = async () => {
    await dismissPrompt();
    if (onManualTrigger) {
      onManualTrigger();
    }
    openPicker();
  };

  return (
    <Modal
      visible={isFirstTime}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissPrompt}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Location Icon Circle */}
          <View style={styles.iconCircle}>
            <MaterialIcons name="location-on" size={38} color={Colors.primary} />
          </View>

          {/* Heading & Subtitle */}
          <Text style={styles.title}>Where are you?</Text>
          <Text style={styles.subtitle}>
            To deliver as quickly as possible, we would like your current location.
          </Text>

          {/* Error Message if GPS resolution failed */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="warning" size={16} color={Colors.rose600} style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionGroup}>
            {/* Primary Button: Use my location */}
            <Pressable
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleUseLocation}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.surface} style={{ marginRight: 8 }} />
              ) : (
                <MaterialIcons name="my-location" size={20} color={Colors.surface} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Detecting...' : 'Use my location'}
              </Text>
            </Pressable>

            {/* Secondary Button: Search location manually */}
            <Pressable
              style={styles.secondaryButton}
              onPress={handleManualSearchClick}
              disabled={isLoading}
            >
              <MaterialIcons name="search" size={20} color={Colors.textPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>Search location manually</Text>
            </Pressable>
          </View>

          {/* Skip for now */}
          <Pressable style={styles.skipButton} onPress={dismissPrompt} hitSlop={12}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl + 4,
    paddingBottom: Spacing.xl + 12,
    alignItems: 'center',
    ...Shadows.lg,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    width: '100%',
  },
  errorIcon: {
    marginRight: 6,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.rose600,
  },
  actionGroup: {
    width: '100%',
    gap: Spacing.sm + 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    width: '100%',
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    width: '100%',
  },
  secondaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  skipButton: {
    marginTop: Spacing.md + 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  skipButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
