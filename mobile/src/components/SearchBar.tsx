import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import { useLocation } from '../context/LocationContext';
import { searchFocusStore } from '../services/searchFocusStore';
import OptimizedImage from './OptimizedImage';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

interface SearchResults {
  restaurants: any[];
  groceryProducts: any[];
  menuItems: any[];
}

interface SearchBarProps {
  inputRef?: React.RefObject<TextInput | null> | React.RefObject<TextInput>;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function SearchBar({ inputRef, onFocus, onBlur }: SearchBarProps) {
  const router = useRouter();
  const { zoneId } = useLocation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    restaurants: [],
    groceryProducts: [],
    menuItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search logic (300ms) matching web client
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ restaurants: [], groceryProducts: [], menuItems: [] });
      setLoading(false);
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
        console.warn('[SearchBar] Global search query failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, zoneId]);

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    searchFocusStore.setIsFocused(true);
    if (query.trim().length >= 2) {
      setIsOpen(true);
    }
    onFocus?.();
  };

  const handleBlur = () => {
    searchFocusStore.setIsFocused(false);
    // Slight delay so suggestion press touches can register cleanly
    blurTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
    onBlur?.();
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ restaurants: [], groceryProducts: [], menuItems: [] });
    setIsOpen(false);
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (!query.trim()) return;

    // Like web handleKeyPress: navigate to matching section or grocery
    setIsOpen(false);
    if (results.restaurants.length > 0 && results.groceryProducts.length === 0) {
      router.push(`/restaurants/${results.restaurants[0]._id}` as any);
    } else if (results.groceryProducts.length > 0 && results.restaurants.length === 0) {
      router.push(`/grocery?q=${encodeURIComponent(query.trim())}` as any);
    } else {
      router.push(`/grocery?q=${encodeURIComponent(query.trim())}` as any);
    }
  };

  const handleSelectRestaurant = (id: string) => {
    setIsOpen(false);
    Keyboard.dismiss();
    router.push(`/restaurants/${id}` as any);
  };

  const handleSelectMenuItem = (item: any) => {
    setIsOpen(false);
    Keyboard.dismiss();
    const rId = item.restaurant?._id || item.restaurant;
    router.push(`/restaurants/${rId}` as any);
  };

  const handleSelectGrocery = (prod: any) => {
    setIsOpen(false);
    Keyboard.dismiss();
    router.push(`/grocery?q=${encodeURIComponent(prod.name)}` as any);
  };

  const hasResults =
    results.restaurants.length > 0 ||
    results.groceryProducts.length > 0 ||
    results.menuItems.length > 0;

  return (
    <View style={styles.container}>
      {/* Input Bar */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={22} color={Colors.textMuted} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search for food, grocery..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim().length >= 2) {
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={clearSearch} style={styles.actionBtn}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.actionBtn}>
            <MaterialIcons name="mic" size={20} color={Colors.primary} />
          </View>
        )}
      </View>

      {/* Live Suggestions Dropdown */}
      {isOpen && (query.trim().length >= 2 || loading) ? (
        <View style={styles.dropdownContainer}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Searching live catalog...</Text>
            </View>
          ) : !hasResults ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="search-off" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No matches found for "{query}"</Text>
              <Text style={styles.emptySubtitle}>
                Try searching for other dishes, groceries, or cuisines.
              </Text>
            </View>
          ) : (
            <ScrollView
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.resultsScroll}
            >
              {/* 1. RESTAURANTS SECTION */}
              {results.restaurants.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialIcons name="storefront" size={15} color={Colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>RESTAURANTS</Text>
                  </View>
                  {results.restaurants.map((rest) => (
                    <Pressable
                      key={rest._id}
                      style={styles.resultItemRow}
                      onPress={() => handleSelectRestaurant(rest._id)}
                    >
                      <View style={styles.resultItemLeft}>
                        <Text style={styles.itemMainTitle} numberOfLines={1}>
                          {rest.name}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {rest.cuisines || 'Multi-cuisine'}
                        </Text>
                      </View>
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingText}>{rest.rating || 'New'}</Text>
                        <MaterialIcons name="star" size={10} color="#137333" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* 2. DISHES & FOOD SECTION */}
              {results.menuItems.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialIcons name="restaurant" size={15} color={Colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>DISHES & FOOD</Text>
                  </View>
                  {results.menuItems.map((item) => {
                    const rId = item.restaurant?._id || item.restaurant;
                    const restName = item.restaurant?.name || 'Local Kitchen';
                    return (
                      <Pressable
                        key={item._id}
                        style={styles.resultItemRow}
                        onPress={() => handleSelectMenuItem(item)}
                      >
                        <View style={styles.resultItemLeft}>
                          <View style={styles.dishTitleRow}>
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
                            <Text style={styles.itemMainTitle} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.isFeatured ? <Text style={styles.fireEmoji}>🔥</Text> : null}
                          </View>
                          <Text style={styles.itemSubtitle} numberOfLines={1}>
                            from {restName}
                          </Text>
                        </View>
                        <View style={styles.priceCol}>
                          {item.discountedPrice &&
                          Number(item.discountedPrice) > 0 &&
                          Number(item.price) > Number(item.discountedPrice) ? (
                            <>
                              <Text style={styles.priceText}>₹{item.discountedPrice}</Text>
                              <Text style={styles.originalPriceText}>₹{item.price}</Text>
                            </>
                          ) : (
                            <Text style={styles.priceText}>₹{item.price}</Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* 3. GROCERIES SECTION */}
              {results.groceryProducts.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialIcons name="shopping-basket" size={15} color={Colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>GROCERIES</Text>
                  </View>
                  {results.groceryProducts.map((prod) => (
                    <Pressable
                      key={prod._id}
                      style={styles.resultItemRow}
                      onPress={() => handleSelectGrocery(prod)}
                    >
                      <View style={styles.groceryThumbWrapper}>
                        {prod.images && prod.images[0] ? (
                          <OptimizedImage
                            src={prod.images[0]}
                            alt={prod.name}
                            style={styles.groceryThumb}
                            preset="thumbnail"
                            contentFit="contain"
                          />
                        ) : (
                          <MaterialIcons
                            name="shopping-bag"
                            size={16}
                            color={Colors.textMuted}
                          />
                        )}
                      </View>
                      <View style={styles.resultItemLeft}>
                        <Text style={styles.itemMainTitle} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {prod.brand || 'Local Brand'}
                          {prod.weightSize ? ` • ${prod.weightSize}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.priceText}>
                        ₹{prod.discountedPrice || prod.price}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
    zIndex: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 52,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm + 1,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    paddingVertical: 0,
  },
  actionBtn: {
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownContainer: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 380,
    ...Shadows.md,
    overflow: 'hidden',
  },
  resultsScroll: {
    maxHeight: 380,
  },
  loadingBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  emptyBox: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionBlock: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: 4,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  resultItemLeft: {
    flex: 1,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vegIndicator: {
    width: 11,
    height: 11,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  fireEmoji: {
    fontSize: 10,
  },
  itemMainTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  itemSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    borderColor: '#CEEAD6',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  ratingText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    fontWeight: '800',
    color: '#137333',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  originalPriceText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  groceryThumbWrapper: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groceryThumb: {
    width: '100%',
    height: '100%',
  },
});
