import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../src/services/api';
import { useCart } from '../../src/context/CartContext';
import { useLocation } from '../../src/context/LocationContext';
import OptimizedImage from '../../src/components/OptimizedImage';
import ProductCard from '../../src/components/ProductCard';
import RestaurantList from '../../src/components/RestaurantList';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../../src/constants/theme';

interface SearchResults {
  restaurants: any[];
  groceryProducts: any[];
  menuItems: any[];
}

export default function SearchScreen() {
  const router = useRouter();
  const { zoneId } = useLocation();
  const { cart, addToCart, updateQuantity } = useCart();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'food' | 'grocery' | 'restaurant'>('all');
  const [results, setResults] = useState<SearchResults>({
    restaurants: [],
    groceryProducts: [],
    menuItems: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ restaurants: [], groceryProducts: [], menuItems: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/search/global?q=${encodeURIComponent(query.trim())}${
          zoneId ? `&zoneId=${zoneId}` : ''
        }`;
        const res = await apiClient.get(url);
        if (res.data?.success) {
          setResults(
            res.data.results || {
              restaurants: [],
              groceryProducts: [],
              menuItems: [],
            }
          );
        }
      } catch (err) {
        console.warn('[Search] Failed fetching search results:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, zoneId]);

  const hasFood = results.menuItems.length > 0;
  const hasGroceries = results.groceryProducts.length > 0;
  const hasRestaurants = results.restaurants.length > 0;
  const hasAnyResults = hasFood || hasGroceries || hasRestaurants;

  const getFoodQty = (itemId: string) => {
    return cart.items.find((i) => i.id === `food-${itemId}`)?.quantity || 0;
  };

  const getGroceryQty = (productId: string) => {
    return cart.items.find((i) => i.id === `groc-${productId}`)?.quantity || 0;
  };

  const handleAddFoodItem = (item: any) => {
    const restId = item.restaurant?._id || item.restaurant || 'unknown-restaurant';
    const restName = item.restaurant?.name || 'Local Kitchen';
    const price =
      item.discountedPrice && Number(item.discountedPrice) > 0
        ? Number(item.discountedPrice)
        : Number(item.price);

    addToCart({
      item: {
        id: `food-${item._id}`,
        name: item.name,
        price,
        quantity: 1,
        img: (item.images && item.images[0]) || '',
      },
      vendorId: restId,
      vendorName: restName,
      orderType: 'food',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Search Header Input */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for food, grocery..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <MaterialIcons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter Category Pills */}
      {hasAnyResults ? (
        <View style={styles.pillsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
            <Pressable
              style={[styles.pill, activeTab === 'all' && styles.activePill]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.pillText, activeTab === 'all' && styles.activePillText]}>
                All Results
              </Text>
            </Pressable>
            {hasFood ? (
              <Pressable
                style={[styles.pill, activeTab === 'food' && styles.activePill]}
                onPress={() => setActiveTab('food')}
              >
                <Text style={[styles.pillText, activeTab === 'food' && styles.activePillText]}>
                  Dishes ({results.menuItems.length})
                </Text>
              </Pressable>
            ) : null}
            {hasGroceries ? (
              <Pressable
                style={[styles.pill, activeTab === 'grocery' && styles.activePill]}
                onPress={() => setActiveTab('grocery')}
              >
                <Text style={[styles.pillText, activeTab === 'grocery' && styles.activePillText]}>
                  Groceries ({results.groceryProducts.length})
                </Text>
              </Pressable>
            ) : null}
            {hasRestaurants ? (
              <Pressable
                style={[styles.pill, activeTab === 'restaurant' && styles.activePill]}
                onPress={() => setActiveTab('restaurant')}
              >
                <Text style={[styles.pillText, activeTab === 'restaurant' && styles.activePillText]}>
                  Restaurants ({results.restaurants.length})
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching live catalog...</Text>
          </View>
        ) : !query.trim() ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="search" size={56} color={Colors.border} />
            <Text style={styles.promptTitle}>Type something to search</Text>
            <Text style={styles.promptDesc}>
              Search across local restaurants, fresh groceries, and prepared food dishes.
            </Text>
          </View>
        ) : !hasAnyResults ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="search-off" size={56} color={Colors.border} />
            <Text style={styles.promptTitle}>No matches found for "{query}"</Text>
            <Text style={styles.promptDesc}>
              Check spelling or try more generic food or brand names.
            </Text>
          </View>
        ) : (
          <View style={styles.resultsBody}>
            {/* 1. DISHES & FOOD SECTION */}
            {(activeTab === 'all' || activeTab === 'food') && hasFood ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Dishes & Prepared Food</Text>
                <View style={styles.dishesCard}>
                  {results.menuItems.map((item) => {
                    const foodQty = getFoodQty(item._id);
                    const restName = item.restaurant?.name || 'Local Kitchen';
                    const isClosed = item.restaurant?.availabilityStatus === 'closed';

                    return (
                      <View key={item._id} style={[styles.dishRow, isClosed && styles.closedRow]}>
                        <View style={styles.dishImgWrapper}>
                          <OptimizedImage
                            src={(item.images && item.images[0]) || ''}
                            alt={item.name}
                            preset="thumbnail"
                            style={styles.dishImg}
                            contentFit="cover"
                          />
                        </View>

                        <View style={styles.dishDetails}>
                          <View style={styles.vegTitleRow}>
                            <View
                              style={[
                                styles.vegIndicator,
                                { borderColor: item.isVeg ? '#16a34a' : '#dc2626' },
                              ]}
                            >
                              <View
                                style={[
                                  styles.vegDot,
                                  { backgroundColor: item.isVeg ? '#16a34a' : '#dc2626' },
                                ]}
                              />
                            </View>
                            <Text style={styles.dishName} numberOfLines={1}>
                              {item.name}
                            </Text>
                          </View>
                          <Text style={styles.dishRestText} numberOfLines={1}>
                            from <Text style={styles.dishRestBold}>{restName}</Text>
                          </Text>
                        </View>

                        <View style={styles.dishPriceAction}>
                          <Text style={styles.dishPriceText}>
                            ₹{item.discountedPrice || item.price}
                          </Text>

                          {foodQty > 0 ? (
                            <View style={styles.qtyControlBox}>
                              <Pressable
                                style={styles.qtyBtn}
                                onPress={() => updateQuantity(`food-${item._id}`, foodQty - 1)}
                              >
                                <MaterialIcons name="remove" size={14} color={Colors.white} />
                              </Pressable>
                              <Text style={styles.qtyNum}>{foodQty}</Text>
                              <Pressable
                                style={styles.qtyBtn}
                                onPress={() => updateQuantity(`food-${item._id}`, foodQty + 1)}
                              >
                                <MaterialIcons name="add" size={14} color={Colors.white} />
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              disabled={isClosed}
                              style={[styles.addFoodBtn, isClosed && styles.disabledFoodBtn]}
                              onPress={() => handleAddFoodItem(item)}
                            >
                              <Text
                                style={[
                                  styles.addFoodText,
                                  isClosed && styles.disabledFoodText,
                                ]}
                              >
                                {isClosed ? 'Closed' : 'Add'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* 2. GROCERIES SECTION */}
            {(activeTab === 'all' || activeTab === 'grocery') && hasGroceries ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Fresh Groceries</Text>
                <View style={styles.groceryGrid}>
                  {results.groceryProducts.map((prod) => (
                    <View key={prod._id} style={styles.gridCol}>
                      <ProductCard
                        prod={prod}
                        qty={getGroceryQty(prod._id)}
                        addToCart={addToCart}
                        updateQuantity={updateQuantity}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* 3. RESTAURANTS SECTION */}
            {(activeTab === 'all' || activeTab === 'restaurant') && hasRestaurants ? (
              <View style={styles.sectionBlock}>
                <RestaurantList restaurants={results.restaurants} />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm + 1,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  clearBtn: {
    padding: Spacing.xs,
  },
  pillsWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.xs + 2,
  },
  pillsContainer: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs + 4,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activePill: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  activePillText: {
    color: Colors.white,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  resultsBody: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  sectionBlock: {
    gap: Spacing.xs,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dishesCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm + 2,
  },
  closedRow: {
    opacity: 0.6,
  },
  dishImgWrapper: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  dishImg: {
    width: '100%',
    height: '100%',
  },
  dishDetails: {
    flex: 1,
  },
  vegTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vegIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dishName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  dishRestText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dishRestBold: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  dishPriceAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dishPriceText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
  },
  addFoodBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: BorderRadius.lg,
  },
  addFoodText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  disabledFoodBtn: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  disabledFoodText: {
    color: Colors.textMuted,
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    height: 28,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyNum: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    paddingHorizontal: 2,
  },
  groceryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    justifyContent: 'space-between',
  },
  gridCol: {
    width: '48%',
  },
  centerContainer: {
    paddingVertical: Spacing.xxl * 1.5,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  promptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  promptDesc: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
