import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

export interface InAppNotificationData {
  title: string;
  body: string;
  imageUrl?: string | null;
  route?: string | null;
  campaignId?: string | null;
}

interface InAppNotificationBannerProps {
  notification: InAppNotificationData | null;
  onPress: (notification: InAppNotificationData) => void;
  onDismiss: () => void;
}

export default function InAppNotificationBanner({
  notification,
  onPress,
  onDismiss,
}: InAppNotificationBannerProps) {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(-200));
  const [opacityAnim] = useState(() => new Animated.Value(0));
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [slideAnim, opacityAnim, onDismiss]);

  useEffect(() => {
    if (notification) {
      // Slide down and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 6 seconds
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 6000);
    } else {
      slideAnim.setValue(-200);
      opacityAnim.setValue(0);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [notification, slideAnim, opacityAnim, handleDismiss]);

  if (!notification) return null;

  const topOffset = Math.max(insets.top + Spacing.xs, Spacing.md);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable
        style={styles.card}
        onPress={() => {
          handleDismiss();
          onPress(notification);
        }}
      >
        {/* Banner Header with Brand & Close Icon */}
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <MaterialIcons name="notifications-active" size={14} color={Colors.white} />
            </View>
            <Text style={styles.appName}>ZipRocket</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.subtext}>Offers & Updates</Text>
          </View>
          <Pressable
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleDismiss}
            style={styles.closeBtn}
          >
            <MaterialIcons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        {/* Content Row: Text + Big Picture if present */}
        <View style={styles.contentRow}>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
          </View>

          {notification.imageUrl ? (
            <Image
              source={{ uri: notification.imageUrl }}
              style={styles.bigPicture}
              contentFit="cover"
              transition={200}
            />
          ) : null}
        </View>

        {/* Action Hint */}
        <View style={styles.actionHintRow}>
          <Text style={styles.actionHintText}>Tap to open</Text>
          <MaterialIcons name="chevron-right" size={14} color={Colors.primary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 99999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs + 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoBadge: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
  },
  dot: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  subtext: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  closeBtn: {
    padding: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 2,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  bigPicture: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  actionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 2,
  },
  actionHintText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.primary,
  },
});
