import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontFamily, Shadows } from '../constants/theme';

export type NotifType = 'success' | 'error' | 'warning' | 'zone';

export interface NotifCardData {
  type: NotifType;
  title: string;
  message: string;
  onAction?: () => void;
  actionLabel?: string;
  redirectTo?: string;
  redirectDelay?: number;
}

interface NotificationModalProps {
  card: NotifCardData | null;
  onClose: () => void;
}

export default function NotificationModal({ card, onClose }: NotificationModalProps) {
  if (!card) return null;

  const cfg = {
    success: {
      bg: Colors.emerald600,
      icon: 'check-circle' as const,
      btnBg: Colors.emerald600,
    },
    error: {
      bg: Colors.rose600,
      icon: 'error' as const,
      btnBg: Colors.rose600,
    },
    warning: {
      bg: '#D97706',
      icon: 'warning' as const,
      btnBg: Colors.primary,
    },
    zone: {
      bg: Colors.rose600,
      icon: 'location-off' as const,
      btnBg: Colors.primary,
    },
  }[card.type];

  return (
    <Modal
      transparent
      visible={!!card}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {card.title === 'Pura Address Zaroori Hai' ? (
            <>
              {/* White Sheet: Small orange warning icon, dark typography */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.whiteCloseBtn, pressed && { opacity: 0.85 }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>

              <View style={styles.whiteSheetBody}>
                <View style={styles.orangeIconBadge}>
                  <MaterialIcons name="warning" size={24} color={Colors.warning} />
                </View>
                <Text style={styles.whiteSheetTitle}>{card.title}</Text>
                <Text style={styles.whiteSheetMessage}>{card.message}</Text>
              </View>
            </>
          ) : (
            <>
              {/* Colored Header Block for other notifications */}
              <View style={[styles.header, { backgroundColor: cfg.bg }]}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeIconBtn, pressed && { opacity: 0.85 }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color={Colors.white} />
                </Pressable>

                <View style={styles.iconCircleOuter}>
                  <View style={styles.iconCircleInner}>
                    <MaterialIcons name={cfg.icon} size={36} color={Colors.white} />
                  </View>
                </View>

                <Text style={styles.title}>{card.title}</Text>
              </View>

              <View style={styles.body}>
                <Text style={styles.message}>{card.message}</Text>
                {card.redirectTo ? (
                  <Text style={styles.redirectHint}>Redirecting automatically...</Text>
                ) : null}
              </View>
            </>
          )}

          {/* Same two buttons with pressed state & >=44px touch targets */}
          <View style={styles.footer}>
            {card.onAction && card.actionLabel ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  { backgroundColor: cfg.btnBg },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  onClose();
                  card.onAction?.();
                }}
              >
                <Text style={styles.primaryActionText}>{card.actionLabel}</Text>
                <MaterialIcons name="arrow-forward" size={18} color={Colors.white} />
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.85 }]}
              onPress={onClose}
            >
              <MaterialIcons name="close" size={16} color={Colors.slate600} />
              <Text style={styles.dismissText}>Band Karein</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: Math.min(width - 40, 400),
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.md,
    position: 'relative',
  },
  whiteCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  whiteSheetBody: {
    paddingTop: 32,
    paddingBottom: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  orangeIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  whiteSheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  whiteSheetMessage: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  closeIconBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 24,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  message: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.slate600,
    textAlign: 'center',
    lineHeight: 21,
  },
  redirectHint: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
  },
  footer: {
    padding: 20,
    gap: 10,
  },
  primaryActionBtn: {
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  primaryActionText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  dismissBtn: {
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.slate200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dismissText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate600,
  },
});
