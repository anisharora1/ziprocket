import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontFamily, Typography, Spacing } from '@/constants/theme';
import { useIsOnline } from '@/services/network';

export default function OfflineBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top > 0 ? insets.top : Spacing.xs }]}>
      <View style={styles.content}>
        <MaterialIcons name="cloud-off" size={14} color={Colors.white} />
        <Text style={styles.text}>{"You're offline. Showing saved data."}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.slate900,
    paddingBottom: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.white,
    letterSpacing: 0.2,
  },
});
