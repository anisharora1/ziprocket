import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

const GROCERY_IMAGE_URL =
  'https://res.cloudinary.com/dxrtse4ni/image/upload/v1791770671/Overflowing_Grocery_Basket_Essentials.webp';

export default function Categories() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={() => router.push('/grocery' as any)}
      >
        {/* Left Side: Tier 3/4 Value Hook & Messaging */}
        <View style={styles.leftContent}>
          <View style={styles.badgeRow}>
            <MaterialIcons name="bolt" size={13} color={Colors.warning} />
            <Text style={styles.badgeText}>DUKAAN SE BHI SASTA</Text>
          </View>

          <Text style={styles.title}>Roz Ka Rashan, Sabse Sasta!</Text>

          <Text style={styles.subtitle} numberOfLines={2}>
            Aata, Dal, Tel, Masale aur Kirana seedhe ghar par
          </Text>

          <View style={styles.ctaButton}>
            <Text style={styles.ctaText}>Order Karein</Text>
            <MaterialIcons name="arrow-forward" size={14} color={Colors.white} />
          </View>
        </View>

        {/* Right Side: High-Quality Grocery Basket Image */}
        <View style={styles.rightContent}>
          <View style={styles.imageBackdrop} />
          <OptimizedImage
            src={GROCERY_IMAGE_URL}
            alt="Grocery Basket Essentials"
            preset="card"
            style={styles.image}
            contentFit="contain"
          />
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>UPTO 40% OFF</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
    overflow: 'hidden',
  },
  leftContent: {
    flex: 1,
    paddingRight: Spacing.sm,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    gap: 3,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.warning,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base + 1,
    color: Colors.textPrimary,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: Spacing.sm,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    gap: 4,
    ...Shadows.sm,
  },
  ctaText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  rightContent: {
    width: 124,
    height: 114,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imageBackdrop: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
  },
  image: {
    width: 116,
    height: 110,
  },
  offerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  offerBadgeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
