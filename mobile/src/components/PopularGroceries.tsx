import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import ProductCard, { Product } from './ProductCard';
import { useCart } from '../context/CartContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

export default function PopularGroceries() {
  const router = useRouter();
  const { cart, addToCart, updateQuantity } = useCart();

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
      cart.items.find((i) => i.id === `groc-${id}` || i.id === id)?.quantity || 0
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

      <Pressable
        style={styles.loadMoreButton}
        onPress={() => router.push('/grocery' as any)}
      >
        <Text style={styles.loadMoreText}>Load More Groceries</Text>
      </Pressable>
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
  loadMoreText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});
