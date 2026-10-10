import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../src/services/api';
import { useCart } from '../../src/context/CartContext';
import { usePlatform } from '../../src/context/PlatformContext';
import OptimizedImage from '../../src/components/OptimizedImage';
import ProductCard, { Product } from '../../src/components/ProductCard';
import FloatingCartButton from '../../src/components/FloatingCartButton';
import {
  GROCERY_CATEGORIES_MAP,
  GROCERY_CATEGORY_DISPLAY,
} from '../../src/constants/groceryCategories';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../../src/constants/theme';

const CATEGORIES = Object.keys(GROCERY_CATEGORIES_MAP).map((id) => ({
  id,
  ...GROCERY_CATEGORY_DISPLAY[id],
}));

export default function GroceryIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, addToCart, updateQuantity } = useCart();
  const { getGroceryStatusMessage } = usePlatform();
  const groceryStatusMessage = getGroceryStatusMessage();

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch featured & recent grocery products
  const { data: featuredProducts = [], isLoading: featuredLoading } = useQuery<Product[]>({
    queryKey: ['grocery-featured'],
    queryFn: async () => {
      const res = await apiClient.get('/grocery?isFeatured=true&limit=8');
      return res.data?.products || [];
    },
  });

  const { data: recentProducts = [], isLoading: recentLoading } = useQuery<Product[]>({
    queryKey: ['grocery-recent'],
    queryFn: async () => {
      const res = await apiClient.get('/grocery?limit=10');
      return res.data?.products || [];
    },
  });

  // Search query
  const { data: searchResults = [], isFetching: isSearching } = useQuery<Product[]>({
    queryKey: ['grocery-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await apiClient.get(
        `/grocery?search=${encodeURIComponent(searchQuery)}&limit=16`
      );
      return res.data?.products || [];
    },
    enabled: searchQuery.trim().length > 0,
  });

  const getCartQuantity = (productId: string) => {
    const item = cart.items.find((i) => i.id === `groc-${productId}`);
    return item ? item.quantity : 0;
  };

  const handleCategoryPress = (catId: string) => {
    router.push({
      pathname: '/grocery/category/[categoryName]',
      params: { categoryName: catId },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Bar (No gear icon) */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle}>Grocery Store</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Commerce Search Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>DELIVERY IN 10 MINUTES</Text>
          </View>
          <Text style={styles.bannerTitle}>ZipGrocery Store</Text>
          <Text style={styles.bannerSubtitle}>
            Fresh vegetables, dairy, household items & munchies delivered instantly!
          </Text>

          {/* Search Input Box */}
          <View style={styles.searchBarBox}>
            <MaterialIcons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vegetables, oils, milk, snacks..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Grocery Status Banner if Closed */}
        {groceryStatusMessage && (
          <View style={styles.statusBanner}>
            <MaterialIcons name="error" size={20} color={Colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Grocery Delivery Unavailable</Text>
              <Text style={styles.statusSubtitle}>{groceryStatusMessage}</Text>
            </View>
          </View>
        )}

        {/* Search Results Drawer */}
        {searchQuery.trim().length > 0 ? (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Search Results for "{searchQuery}"</Text>
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>Clear</Text>
              </Pressable>
            </View>

            {isSearching ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Searching groceries...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <MaterialIcons name="shopping-bag" size={40} color={Colors.textMuted} />
                <Text style={styles.emptySearchText}>
                  No grocery items match your search. Try "milk" or "oil".
                </Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {searchResults.map((prod) => (
                  <View key={prod._id} style={styles.gridCardWrapper}>
                    <ProductCard
                      prod={prod}
                      qty={getCartQuantity(prod._id)}
                      addToCart={addToCart}
                      updateQuantity={updateQuantity}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Shop by Category Grid */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>SHOP BY CATEGORY</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={styles.categoryCard}
                    onPress={() => handleCategoryPress(cat.id)}
                  >
                    <View style={[styles.categoryIconCircle, { backgroundColor: cat.bg }]}>
                      <OptimizedImage
                        src={cat.image}
                        alt={cat.name}
                        preset="thumbnail"
                        style={styles.categoryImage}
                        contentFit="cover"
                      />
                    </View>
                    <Text style={styles.categoryName} numberOfLines={2}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Featured Deals Row */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>BEST DEALS & FEATURED</Text>
                <Pressable
                  onPress={() => handleCategoryPress('Vegetables & Fruits')}
                >
                  <Text style={styles.seeAllText}>See all</Text>
                </Pressable>
              </View>

              {featuredLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (
                <View style={styles.productGrid}>
                  {featuredProducts.map((prod) => (
                    <View key={prod._id} style={styles.gridCardWrapper}>
                      <ProductCard
                        prod={prod}
                        qty={getCartQuantity(prod._id)}
                        addToCart={addToCart}
                        updateQuantity={updateQuantity}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* New Arrivals Row */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>NEW ARRIVALS IN STORE</Text>

              {recentLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (
                <View style={styles.productGrid}>
                  {recentProducts.map((prod) => (
                    <View key={prod._id} style={styles.gridCardWrapper}>
                      <ProductCard
                        prod={prod}
                        qty={getCartQuantity(prod._id)}
                        addToCart={addToCart}
                        updateQuantity={updateQuantity}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Bottom Cart Bar */}
      <FloatingCartButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  topBarTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  heroBanner: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  badgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 1,
  },
  bannerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xxl,
    color: Colors.white,
    marginTop: 2,
  },
  bannerSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: '#FFE2CC',
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
  },
  statusBanner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
  statusSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm + 1,
    color: Colors.textPrimary,
  },
  clearSearchText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  seeAllText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '23%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xs + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  categoryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    justifyContent: 'space-between',
  },
  gridCardWrapper: {
    width: '48%',
    marginBottom: Spacing.sm,
  },
  loadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptySearchBox: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 240,
  },
});
