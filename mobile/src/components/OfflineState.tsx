import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Colors,
  FontFamily,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/constants/theme';
import { checkConnectivity } from '@/services/network';

export interface OfflineStateProps {
  onRetry?: () => void | Promise<any>;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function OfflineState({
  onRetry,
  compact = false,
  style,
}: OfflineStateProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      // 1. Re-check connectivity first
      await checkConnectivity();

      // 2. Call the provided onRetry callback
      if (onRetry) {
        await Promise.resolve(onRetry());
      }

      // Small perceptible delay for user visual feedback
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      if (__DEV__) {
        console.warn('[OfflineState] Retry error:', err);
      }
    } finally {
      // 3. Never leave the button stuck in loading
      setRetrying(false);
    }
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <MaterialIcons
          name="wifi-off"
          size={28}
          color={Colors.textSecondary}
        />
        <Text style={styles.compactTitle}>No internet connection</Text>
        <Text style={styles.compactSubtitle}>
          Check your Wi-Fi or mobile data and try again.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.compactButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
        >
          {retrying ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <MaterialIcons
                name="refresh"
                size={16}
                color={Colors.white}
              />
              <Text style={styles.compactButtonText}>Retry</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <MaterialIcons
          name="wifi-off"
          size={44}
          color={Colors.textSecondary}
        />
      </View>

      <Text style={styles.title}>No internet connection</Text>
      <Text style={styles.subtitle}>
        Check your Wi-Fi or mobile data and try again.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
      >
        {retrying ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            <MaterialIcons
              name="refresh"
              size={18}
              color={Colors.white}
            />
            <Text style={styles.buttonText}>Retry</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xl,
    lineHeight: Typography.lineHeight.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.lineHeight.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    minWidth: 140,
    minHeight: 46,
    ...Shadows.sm,
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  compactTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  compactSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
    marginBottom: Spacing.xs,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    minWidth: 100,
    minHeight: 34,
  },
  compactButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.white,
  },
});
