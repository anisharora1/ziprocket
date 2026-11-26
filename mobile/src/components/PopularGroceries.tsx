import React, { useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import ProductCard, { Product } from './ProductCard';
import { useCart, useCartActions } from '../context/CartContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

export default function PopularGroceries() {
  const router = useRouter();
  const { cart } = useCart();
  const { addToCart, updateQuantity } = useCartActions();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scaleAnim]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['popular-groceries-home'],
    queryFn: async () => {
      const res = await apiClient.get('/search/popular-groceries');
      return (
        res.data?.items ||
        res.data?.data?.items ||
        res.data?.products ||
        res.data?.data?.products ||
        []
      );
    },
  });

  if (!products || products.length === 0) {
    return null;
  }

  const getCartQuantity = (id: string) => {
    return (
      [...cart.items, ...(cart.groceryItems || [])].find((i) => i.id === `groc-${id}` || i.id === id)?.quantity || 0
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Popular Groceries</Text>

      <View style={styles.grid}>
        {products.slice(0, 8).map((prod) => (
          <View key={prod._id} style={styles.gridItem}>
            <ProductCard
              prod={prod}
              qty={getCartQuantity(prod._id)}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
            />
          </View>
        ))}
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          style={({ pressed }) => [
            styles.loadMoreButton,
            pressed && styles.loadMoreButtonPressed,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => router.push('/grocery' as any)}
        >
          <Text style={styles.loadMoreText}>Load More Groceries</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
  },
  loadMoreButton: {
    width: '100%',
    paddingVertical: Spacing.md - 2,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  loadMoreButtonPressed: {
    backgroundColor: Colors.primaryAlpha10,
  },
  loadMoreText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
