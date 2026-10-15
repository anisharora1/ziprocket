import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

interface FloatingCartButtonProps {
  bottomOffset?: number;
}

export default function FloatingCartButton({ bottomOffset = 16 }: FloatingCartButtonProps) {
  const router = useRouter();
  const { cart } = useCart();

  if (cart.items.length === 0) return null;

  const totalItems = cart.items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 1),
    0
  );
  const totalPrice = cart.items.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      <Pressable
        style={styles.card}
        onPress={() => router.push('/cart' as any)}
      >
        <View style={styles.leftGroup}>
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeCount}>{totalItems}</Text>
            <Text style={styles.itemBadgeLabel}>
              {totalItems === 1 ? 'Item' : 'Items'}
            </Text>
          </View>
          <View>
            <Text style={styles.priceText}>₹{totalPrice.toFixed(2)}</Text>
            <Text style={styles.subText}>Plus taxes & delivery</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <MaterialIcons name="play-arrow" size={20} color={Colors.white} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9000,
  },
  card: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Shadows.lg,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  itemBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadgeCount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.white,
    lineHeight: 16,
  },
  itemBadgeLabel: {
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.white,
  },
  subText: {
    fontSize: Typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: Typography.fontWeight.medium,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewCartText: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
