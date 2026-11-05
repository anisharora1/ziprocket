import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { getDiscountPercent } from '../utils/discount';
import {
  Colors,
  BorderRadius,
  Typography,
  FontFamily,
  Spacing,
} from '../constants/theme';

export interface DiscountBadgeProps {
  price?: number | null;
  discountedPrice?: number | null;
  style?: StyleProp<ViewStyle>;
}

export default function DiscountBadge({
  price,
  discountedPrice,
  style,
}: DiscountBadgeProps) {
  const percent = getDiscountPercent(price, discountedPrice);

  if (percent <= 0) {
    return null;
  }

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{percent}% OFF</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.orange50,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    alignSelf: 'flex-end',
  },
  text: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

