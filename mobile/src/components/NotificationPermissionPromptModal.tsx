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
import {
  Colors,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

interface NotificationPermissionPromptModalProps {
  visible: boolean;
  isPermanentlyDenied?: boolean;
  onAllow: () => void;
  onDecline: () => void;
  onOpenSettings: () => void;
}

const { width } = Dimensions.get('window');

export default function NotificationPermissionPromptModal({
  visible,
  isPermanentlyDenied = false,
  onAllow,
  onDecline,
  onOpenSettings,
}: NotificationPermissionPromptModalProps) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header Block matching NotificationModal style */}
          <View style={styles.header}>
            <Pressable
              onPress={onDecline}
              style={styles.closeIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={20} color={Colors.white} />
            </Pressable>

            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <MaterialIcons
                  name={isPermanentlyDenied ? 'notifications-off' : 'notifications-active'}
                  size={36}
                  color={Colors.white}
                />
              </View>
            </View>

            <Text style={styles.title}>Offers aur updates miss na karein</Text>
          </View>

          {/* Body Block */}
          <View style={styles.body}>
            <Text style={styles.message}>
              {isPermanentlyDenied
                ? 'Aapne notifications off kar rakhi hain. Naye offers aur order status updates ke liye system settings me notifications on karein.'
                : 'Naye offers aur deals sabse pehle paayein.'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            {isPermanentlyDenied ? (
              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: Colors.primary }]}
                onPress={onOpenSettings}
              >
                <Text style={styles.primaryActionText}>Settings kholein</Text>
                <MaterialIcons name="settings" size={18} color={Colors.white} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: Colors.primary }]}
                onPress={onAllow}
              >
                <Text style={styles.primaryActionText}>Haan, Allow karein</Text>
                <MaterialIcons name="check" size={18} color={Colors.white} />
              </Pressable>
            )}

            <Pressable style={styles.dismissBtn} onPress={onDecline}>
              <MaterialIcons name="schedule" size={16} color={Colors.slate600} />
              <Text style={styles.dismissText}>Baad me</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99998,
  },
  dialog: {
    width: Math.min(width - 40, 400),
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: Colors.primary,
  },
  closeIconBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  message: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.slate700,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
  },
  primaryActionText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    color: Colors.white,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.slate100,
  },
  dismissText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.slate700,
  },
});
