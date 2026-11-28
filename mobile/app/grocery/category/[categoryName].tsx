import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../../src/services/api';
import { useCart, useCartActions } from '../../../src/context/CartContext';
import OptimizedImage from '../../../src/components/OptimizedImage';
import ProductCard, { Product } from '../../../src/components/ProductCard';
import FloatingCartButton from '../../../src/components/FloatingCartButton';
import BrandFooter from '../../../src/components/BrandFooter';
import { useIsOnline } from '../../../src/services/network';
import OfflineState from '../../../src/components/OfflineState';
import { sortAvailableFirst } from '../../../src/utils/sortAvailableFirst';
import {
  GROCERY_CATEGORIES_MAP,
  GROCERY_SUBCATEGORY_ICONS,
} from '../../../src/constants/groceryCategories';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
} from '../../../src/constants/theme';

const RAIL_ICON_CONTENT_FIT: 'cover' | 'contain' = 'cover';

export default function CategoryProductsScreen() {
  const { categoryName } = useLocalSearchParams<{ categoryName: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const { addToCart, updateQuantity } = useCartActions();

  const raw = typeof categoryName === 'string' ? categoryName : '';
  const decodedCategory = useMemo(() => {
    try {
      return raw.includes('%') ? decodeURIComponent(raw) : raw;
    } catch {
      return raw;
    }
  }, [raw]);

  const subcategories = GROCERY_CATEGORIES_MAP[decodedCategory] || [];
  const [activeSub, setActiveSub] = useState<string>('All');

  const isOnline = useIsOnline();

  // Fetch category products
  const {
    data: products = [],
    isLoading: loading,
    isError,
    fetchStatus,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ['grocery-category-products', decodedCategory, activeSub],
    queryFn: async () => {
      let query = `/grocery?category=${encodeURIComponent(decodedCategory)}&limit=40`;
      if (activeSub !== 'All') {
        query += `&subcategory=${encodeURIComponent(activeSub)}`;
      }
      const res = await apiClient.get(query);
      return res.data?.products || [];
    },
    enabled: !!decodedCategory,
  });

  const sortedProducts = useMemo(() => sortAvailableFirst(products), [products]);

  const getCartQuantity = (productId: string) => {
    const item = [...cart.items, ...(cart.groceryItems || [])].find((i) => i.id === `groc-${productId}` || i.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Bar (No gear icon) */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: Spacing.xs }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {decodedCategory}
          </Text>
          <Text style={styles.topBarSubtitle}>
            {activeSub === 'All' ? 'All Items' : activeSub}
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* Main Split View */}
      <View style={styles.splitLayout}>
        {/* Left Subcategory Rail */}
        <View style={styles.leftRail}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.railScrollContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
          >
            {/* All Items Button */}
            <Pressable
              style={[
                styles.railItem,
                activeSub === 'All' && styles.railItemActive,
              ]}
              onPress={() => setActiveSub('All')}
            >
              <View
                style={[
                  styles.railIconBox,
                  activeSub === 'All' && styles.railIconBoxActive,
                ]}
              >
                <OptimizedImage
                  src={GROCERY_SUBCATEGORY_ICONS['All']}
                  alt="All"
                  preset="tile"
                  style={styles.railIconImg}
                  contentFit={RAIL_ICON_CONTENT_FIT}
                />
              </View>
              <Text
                style={[
                  styles.railItemText,
                  activeSub === 'All' && styles.railItemTextActive,
                ]}
                numberOfLines={2}
              >
                All Items
              </Text>
            </Pressable>

            {/* Subcategories */}
            {subcategories.map((sub) => {
              const isActive = activeSub === sub;
              const icon = GROCERY_SUBCATEGORY_ICONS[sub] || GROCERY_SUBCATEGORY_ICONS['All'];

              return (
                <Pressable
                  key={sub}
                  style={[styles.railItem, isActive && styles.railItemActive]}
                  onPress={() => setActiveSub(sub)}
                >
                  <View
                    style={[
                      styles.railIconBox,
                      isActive && styles.railIconBoxActive,
                    ]}
                  >
                    <OptimizedImage
                      src={icon}
                      alt={sub}
                      preset="tile"
                      style={styles.railIconImg}
                      contentFit={RAIL_ICON_CONTENT_FIT}
                    />
                  </View>
                  <Text
                    style={[
                      styles.railItemText,
                      isActive && styles.railItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {sub}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Right 2-Column Product Grid */}
        <View style={styles.rightContent}>
          {products.length === 0 && (!isOnline || fetchStatus === 'paused' || isError) ? (
            <OfflineState onRetry={refetch} />
          ) : loading && products.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="storefront" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubtitle}>
                No items listed under this category yet.
              </Text>
              <Pressable style={styles.retryBtn} onPress={() => refetch()}>
                <Text style={styles.retryBtnText}>REFRESH</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              key={`${decodedCategory}-${activeSub}`}
              data={sortedProducts}
              initialNumToRender={8}
              windowSize={7}
              removeClippedSubviews={false}
              keyExtractor={(item) => item._id}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.cardContainer}>
                  <ProductCard
                    prod={item}
                    qty={getCartQuantity(item._id)}
                    addToCart={addToCart}
                    updateQuantity={updateQuantity}
                  />
                </View>
              )}
              ListFooterComponent={products.length > 0 ? <BrandFooter /> : null}
            />
          )}
        </View>
      </View>

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
  topBarSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  leftRail: {
    width: 100,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  railScrollContent: {
    paddingVertical: Spacing.xs,
  },
  railItem: {
    padding: Spacing.sm,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  railItemActive: {
    backgroundColor: Colors.orange50,
  },
  railIconBox: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railIconBoxActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  railIconImg: {
    width: '100%',
    height: '100%',
  },
  railItemText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: Spacing.xs,
  },
  railItemTextActive: {
    fontFamily: FontFamily.extraBold,
    color: Colors.primary,
  },
  rightContent: {
    flex: 1,
    padding: Spacing.sm,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cardContainer: {
    width: '48.5%',
  },
  gridContent: {
    paddingTop: Spacing.xs,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  retryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
});
