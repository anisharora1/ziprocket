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
  compact?: boolean;
  variant?: 'default' | 'ribbon';
  style?: StyleProp<ViewStyle>;
}

export default function DiscountBadge({
  price,
  discountedPrice,
  compact = false,
  variant = 'default',
  style,
}: DiscountBadgeProps) {
  const percent = getDiscountPercent(price, discountedPrice);

  if (percent <= 0) {
    return null;
  }

  const isRibbon = variant === 'ribbon';

  return (
    <View
      accessible={isRibbon ? false : undefined}
      importantForAccessibility={isRibbon ? 'no-hide-descendants' : undefined}
      style={[
        styles.badge,
        compact && !isRibbon && styles.badgeCompact,
        isRibbon && styles.badgeRibbon,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          compact && !isRibbon && styles.textCompact,
          isRibbon && styles.textRibbon,
        ]}
      >
        {percent}% OFF
      </Text>
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
  badgeCompact: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 1,
  },
  badgeRibbon: {
    backgroundColor: Colors.primaryDark,
    borderWidth: 0,
    borderRadius: 0,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textCompact: {
    fontSize: Typography.fontSize.xs,
    letterSpacing: 0.2,
  },
  textRibbon: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});

