import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Foundation } from '@expo/vector-icons';
import { Colors, FontFamily } from '../constants/theme';

export default function BrandFooter() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isSmallScreen = width < 360;
  const headingFontSize = isSmallScreen ? 48 : 58;
  const headingLineHeight = Math.round(headingFontSize * 0.98);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {/* 3-Line Large Heading */}
      <View style={styles.headingBlock}>
        <Text
          style={[
            styles.mutedHeadingText,
            { fontSize: headingFontSize, lineHeight: headingLineHeight },
          ]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          Aapka apna
        </Text>
        <View style={styles.deliveryRow}>
          <Text
            style={[
              styles.mutedHeadingText,
              styles.deliveryText,
              { fontSize: headingFontSize, lineHeight: headingLineHeight },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            Delivery App
          </Text>
          <Foundation
            name="heart"
            size={Math.round(headingFontSize * 0.72)}
            color="#e83b3bbd"
            style={styles.heartIcon}
          />
        </View>

      </View>
      <View style={styles.brandRow}>
        <Text
          style={[
            styles.brandText,
            { fontSize: headingFontSize, lineHeight: headingLineHeight },
          ]}
        >
          ziprocket
        </Text>
        <MaterialIcons
          name="rocket-launch"
          size={Math.round(headingFontSize * 0.72)}
          color={Colors.primary}
          style={styles.rocketIcon}
        />
      </View>

      {/* Thin Divider Line with 12px Diagonal Tail */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerTail} />
      </View>

      {/* Subtext with Orange Bullet Separators */}
      <Text style={styles.sloganFooterText}>
        FOOD <Text style={styles.bulletPoint}>•</Text> GROCERY{' '}
        <Text style={styles.bulletPoint}>•</Text> DELIVERED
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 38,
  },
  headingBlock: {
    marginBottom: 35,
  },
  mutedHeadingText: {
    fontFamily: FontFamily.extraBold,
    fontWeight: '800',
    color: '#8d8686ff',
    letterSpacing: -2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryText: {
    flexShrink: 1,
  },
  heartIcon: {
    marginTop: 4,
  },
  brandText: {
    fontFamily: FontFamily.extraBold,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  rocketIcon: {
    transform: [{ rotate: '45deg' }],
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'visible',
    height: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.footerLine,
  },
  dividerTail: {
    width: 12,
    height: 1,
    backgroundColor: Colors.footerLine,
    transform: [{ translateY: -3.5 }, { rotate: '-40deg' }],
  },
  sloganFooterText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.footerSub,
    textTransform: 'uppercase',
  },
  bulletPoint: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
