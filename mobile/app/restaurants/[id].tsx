import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  StyleSheet,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../src/services/api';
import { useCart } from '../../src/context/CartContext';
import { usePlatform } from '../../src/context/PlatformContext';
import { isWithinOperatingHours, formatToAMPM } from '../../src/utils/restaurantHours';
import OptimizedImage from '../../src/components/OptimizedImage';
import FloatingCartButton from '../../src/components/FloatingCartButton';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../../src/constants/theme';

export interface MenuItemType {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot';
  category?: string;
  images?: string[];
  isAvailable?: boolean;
  isVeg?: boolean;
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, addToCart, updateQuantity } = useCart();
  const { settings, isPlatformCurrentlyOpen, getPlatformStatusMessage } = usePlatform();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);

  // Parallel fetch restaurant details & menu
  const {
    data: restData,
    isLoading: restLoading,
    isError: restError,
    refetch: refetchRest,
  } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: async () => {
      const res = await apiClient.get(`/restaurants/${id}`);
      return res.data?.restaurant || res.data?.data?.restaurant || null;
    },
    enabled: !!id,
  });

  const {
    data: menuData = [],
    isLoading: menuLoading,
    isError: menuError,
    refetch: refetchMenu,
  } = useQuery<MenuItemType[]>({
    queryKey: ['restaurant-menu', id],
    queryFn: async () => {
      const res = await apiClient.get(`/restaurants/${id}/menu`);
      return res.data?.menuItems || res.data?.data?.menuItems || [];
    },
    enabled: !!id,
  });

  const loading = restLoading || menuLoading;
  const isError = restError || menuError;

  const restaurant = restData;
  const menuItems = menuData;

  const categories = useMemo(() => {
    return Array.from(
      new Set((menuItems || []).map((item) => item.category).filter(Boolean) as string[])
    );
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return (menuItems || []).filter((item) => {
      if (vegOnly && !item.isVeg) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [menuItems, vegOnly, searchQuery]);

  const groupedItems = useMemo(() => {
    return filteredMenuItems.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItemType[]>);
  }, [filteredMenuItems]);

  const displayedCategories = useMemo(() => {
    if (activeCategory !== 'All') {
      return categories.filter((c) => c === activeCategory && (groupedItems[c] || []).length > 0);
    }
    return categories.filter((c) => (groupedItems[c] || []).length > 0);
  }, [categories, activeCategory, groupedItems]);

  const getCartQuantity = (itemId: string) => {
    const found = cart.items.find((i) => i.id === `food-${itemId}`);
    return found ? found.quantity : 0;
  };

  const getEffectivePrice = (item: MenuItemType) => {
    if (item.discountedPrice && Number(item.discountedPrice) > 0) {
      return Number(item.discountedPrice);
    }
    return Number(item.price);
  };

  const handleAddItem = (item: MenuItemType) => {
    if (!restaurant) return;
    addToCart({
      item: {
        id: `food-${item._id}`,
        name: item.name,
        price: getEffectivePrice(item),
        quantity: 1,
        img: item.images && item.images[0] ? item.images[0] : '',
      },
      vendorId: restaurant._id || id || '',
      vendorName: restaurant.name,
      orderType: 'food',
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out the menu at ${restaurant?.name || 'ZipRocket'}!`,
        title: restaurant?.name || 'ZipRocket Restaurant',
      });
    } catch {
      // Ignored
    }
  };

  const isWithinHours = isWithinOperatingHours(
    restaurant?.operatingHours?.open,
    restaurant?.operatingHours?.close
  );
  const isRestaurantOpen =
    restaurant &&
    restaurant.isActive !== false &&
    restaurant.availabilityStatus === 'open' &&
    isWithinHours;
  const platformMsg = getPlatformStatusMessage();
  const isOrderingDisabled = !!platformMsg || !isRestaurantOpen;

  const openTimeFormatted = restaurant?.operatingHours?.open
    ? formatToAMPM(restaurant.operatingHours.open)
    : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Loading Restaurant...</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading delicious menu items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Restaurant Unavailable</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.errorBox}>
          <MaterialIcons name="store" size={64} color={Colors.textMuted} />
          <Text style={styles.errorTitle}>Restaurant Unavailable</Text>
          <Text style={styles.errorSubtitle}>
            We couldn't load this restaurant's menu. It may be temporarily deactivated or offline.
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              refetchRest();
              refetchMenu();
            }}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <View style={styles.topBarActions}>
          <Pressable onPress={handleShare} style={styles.topIconBtn}>
            <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setIsFavorite(!isFavorite)} style={styles.topIconBtn}>
            <MaterialIcons
              name={isFavorite ? 'favorite' : 'favorite-border'}
              size={20}
              color={isFavorite ? Colors.error : Colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Restaurant Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
                {restaurant.isVerified ? (
                  <MaterialIcons name="check-circle" size={18} color={Colors.primary} />
                ) : null}
              </View>

              {restaurant.cuisines ? (
                <Text style={styles.cuisinesText}>
                  {Array.isArray(restaurant.cuisines)
                    ? restaurant.cuisines.join(' • ')
                    : restaurant.cuisines}
                </Text>
              ) : null}

              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={14} color={Colors.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {restaurant.location?.address || 'Benipatti, Bihar'}
                </Text>
              </View>

              {/* Status Badges */}
              <View style={styles.badgesRow}>
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={14} color={Colors.ratingGold} />
                  <Text style={styles.ratingText}>
                    {restaurant.rating > 0 ? Number(restaurant.rating).toFixed(1) : 'New'}
                  </Text>
                </View>

                <View style={styles.ordersBadge}>
                  <MaterialIcons name="store" size={14} color={Colors.textMuted} />
                  <Text style={styles.ordersText}>
                    {restaurant.totalOrders ? `${restaurant.totalOrders}+ orders` : '100+ orders'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    isRestaurantOpen ? styles.statusPillOpen : styles.statusPillClosed,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isRestaurantOpen ? styles.statusDotOpen : styles.statusDotClosed,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      isRestaurantOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed,
                    ]}
                  >
                    {isRestaurantOpen ? 'Open Now' : 'Closed'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Restaurant Cover Image */}
            <View style={styles.heroImageContainer}>
              <OptimizedImage
                src={
                  restaurant.image ||
                  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800'
                }
                alt={restaurant.name}
                preset="card"
                style={styles.heroImage}
                contentFit="cover"
              />
            </View>
          </View>
        </View>

        {/* Ordering Warning Alert Banner */}
        {isOrderingDisabled && (
          <View style={styles.warningBanner}>
            <MaterialIcons name="error" size={20} color={Colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>
                {settings?.maintenanceMode
                  ? 'Platform Maintenance Mode'
                  : !isPlatformCurrentlyOpen()
                  ? 'ZipRocket Orders Currently Closed'
                  : 'Restaurant Currently Unavailable'}
              </Text>
              <Text style={styles.warningDesc}>
                {platformMsg ||
                  (restaurant?.availabilityStatus === 'disabled'
                    ? 'This restaurant is temporarily disabled by administration.'
                    : !isWithinHours && openTimeFormatted
                    ? `This restaurant is currently closed. It reopens at ${openTimeFormatted}.`
                    : 'This restaurant is currently closed and not accepting online orders right now.')}
              </Text>
            </View>
          </View>
        )}

        {/* Sticky Search & Filter Toolbar */}
        <View style={styles.toolbarCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search dishes in ${restaurant.name}...`}
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={16} color={Colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {/* Veg Only Filter Button */}
            <Pressable
              style={[styles.vegBtn, vegOnly && styles.vegBtnActive]}
              onPress={() => setVegOnly(!vegOnly)}
            >
              <View style={[styles.vegDot, vegOnly && styles.vegDotActive]} />
              <Text style={[styles.vegBtnText, vegOnly && styles.vegBtnTextActive]}>Veg</Text>
            </Pressable>
          </View>

          {/* Horizontal Category Pills */}
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPillsRow}
            >
              <Pressable
                style={[styles.categoryPill, activeCategory === 'All' && styles.categoryPillActive]}
                onPress={() => setActiveCategory('All')}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    activeCategory === 'All' && styles.categoryPillTextActive,
                  ]}
                >
                  All ({filteredMenuItems.length})
                </Text>
              </Pressable>
              {categories.map((cat) => {
                const count = (groupedItems[cat] || []).length;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.categoryPill, activeCategory === cat && styles.categoryPillActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        activeCategory === cat && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat} {count > 0 ? `(${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Menu Items List */}
        {!menuItems || menuItems.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <MaterialIcons name="restaurant-menu" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Menu Items Available</Text>
            <Text style={styles.emptySubtitle}>
              This restaurant has not listed any dishes on their menu yet.
            </Text>
          </View>
        ) : filteredMenuItems.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <MaterialIcons name="search" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Matching Dishes Found</Text>
            <Text style={styles.emptySubtitle}>
              {vegOnly
                ? 'No pure vegetarian items match your filter.'
                : `No dishes match "${searchQuery}".`}
            </Text>
            <Pressable
              style={styles.clearFilterBtn}
              onPress={() => {
                setSearchQuery('');
                setVegOnly(false);
                setActiveCategory('All');
              }}
            >
              <Text style={styles.clearFilterText}>CLEAR ALL FILTERS</Text>
            </Pressable>
          </View>
        ) : (
          displayedCategories.map((category) => {
            const items = groupedItems[category] || [];
            if (items.length === 0) return null;

            return (
              <View key={`cat-${category}`} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>

                {items.map((item) => {
                  const qty = getCartQuantity(item._id);
                  const effectivePrice = getEffectivePrice(item);
                  const isItemDisabled =
                    !item.isAvailable ||
                    isOrderingDisabled ||
                    restaurant.isActive === false ||
                    restaurant.availabilityStatus !== 'open';

                  return (
                    <Pressable
                      key={item._id}
                      style={[
                        styles.dishCard,
                        !item.isAvailable && { opacity: 0.65 },
                      ]}
                      onPress={() => setSelectedItem(item)}
                    >
                      <View style={styles.dishInfoCol}>
                        {/* Veg indicator & Category */}
                        <View style={styles.vegIndicatorRow}>
                          <View
                            style={[
                              styles.vegIndicatorBox,
                              { borderColor: item.isVeg ? '#16A34A' : '#DC2626' },
                            ]}
                          >
                            <View
                              style={[
                                styles.vegIndicatorCircle,
                                { backgroundColor: item.isVeg ? '#16A34A' : '#DC2626' },
                              ]}
                            />
                          </View>
                          {item.isFeatured ? (
                            <View style={styles.bestsellerChip}>
                              <Text style={styles.bestsellerChipText}>🔥 BESTSELLER</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.dishName} numberOfLines={2}>
                          {item.name}
                        </Text>

                        {item.description ? (
                          <Text style={styles.dishDesc} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}

                        {/* Meta Tags: prep time & spice */}
                        <View style={styles.dishMetaRow}>
                          <Text style={styles.dishMetaTag}>⏱️ ~{item.prepTimeMinutes || 15}m</Text>
                          {item.spiceLevel && item.spiceLevel !== 'none' ? (
                            <Text style={styles.dishMetaTag}>
                              🌶️ {item.spiceLevel.toUpperCase()}
                            </Text>
                          ) : null}
                        </View>

                        {/* Price */}
                        <View style={styles.priceRow}>
                          <Text style={styles.dishPrice}>₹{effectivePrice}</Text>
                          {item.discountedPrice &&
                          Number(item.discountedPrice) > 0 &&
                          item.price > item.discountedPrice ? (
                            <Text style={styles.dishOriginalPrice}>₹{item.price}</Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Right side: Image & Add button overlay */}
                      <View style={styles.dishImageCol}>
                        {item.images && item.images[0] ? (
                          <OptimizedImage
                            src={item.images[0]}
                            alt={item.name}
                            preset="thumbnail"
                            style={styles.dishImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.dishImagePlaceholder}>
                            <MaterialIcons name="image" size={32} color={Colors.textMuted} />
                          </View>
                        )}

                        <View style={styles.dishAddBtnContainer}>
                          {qty > 0 ? (
                            <View style={styles.stepperBox}>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => updateQuantity(`food-${item._id}`, qty - 1)}
                              >
                                <MaterialIcons name="remove" size={14} color={Colors.primary} />
                              </Pressable>
                              <Text style={styles.stepperQtyText}>{qty}</Text>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => updateQuantity(`food-${item._id}`, qty + 1)}
                              >
                                <MaterialIcons name="add" size={14} color={Colors.primary} />
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={[
                                styles.addBtn,
                                isItemDisabled && styles.addBtnDisabled,
                              ]}
                              disabled={isItemDisabled}
                              onPress={() => handleAddItem(item)}
                            >
                              <Text
                                style={[
                                  styles.addBtnText,
                                  isItemDisabled && styles.addBtnTextDisabled,
                                ]}
                              >
                                {!item.isAvailable ? 'OOS' : 'ADD'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Bottom Cart Bar */}
      <FloatingCartButton />

      {/* Item Details Modal */}
      {selectedItem && (
        <Modal
          visible={!!selectedItem}
          animationType="fade"
          transparent
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSelectedItem(null)}
              >
                <MaterialIcons name="close" size={22} color={Colors.white} />
              </Pressable>

              {selectedItem.images && selectedItem.images[0] ? (
                <OptimizedImage
                  src={selectedItem.images[0]}
                  alt={selectedItem.name}
                  preset="card"
                  style={styles.modalImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.modalImage, styles.dishImagePlaceholder]}>
                  <MaterialIcons name="image" size={48} color={Colors.textMuted} />
                </View>
              )}

              <View style={styles.modalBody}>
                <View style={styles.vegIndicatorRow}>
                  <View
                    style={[
                      styles.vegIndicatorBox,
                      { borderColor: selectedItem.isVeg ? '#16A34A' : '#DC2626' },
                    ]}
                  >
                    <View
                      style={[
                        styles.vegIndicatorCircle,
                        { backgroundColor: selectedItem.isVeg ? '#16A34A' : '#DC2626' },
                      ]}
                    />
                  </View>
                  <Text style={styles.modalCategoryText}>
                    {selectedItem.category || 'Food Item'}
                  </Text>
                </View>

                <Text style={styles.modalDishName}>{selectedItem.name}</Text>
                <Text style={styles.modalDishDesc}>
                  {selectedItem.description || 'Prepared with fresh ingredients and authentic flavours.'}
                </Text>

                <View style={styles.modalMetaRow}>
                  <Text style={styles.dishMetaTag}>⏱️ ~{selectedItem.prepTimeMinutes || 15}m prep</Text>
                  {selectedItem.spiceLevel && selectedItem.spiceLevel !== 'none' ? (
                    <Text style={styles.dishMetaTag}>🌶️ {selectedItem.spiceLevel.toUpperCase()}</Text>
                  ) : null}
                </View>

                <View style={styles.modalFooter}>
                  <Text style={styles.modalPrice}>₹{getEffectivePrice(selectedItem)}</Text>
                  {getCartQuantity(selectedItem._id) > 0 ? (
                    <View style={styles.stepperBox}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() =>
                          updateQuantity(
                            `food-${selectedItem._id}`,
                            getCartQuantity(selectedItem._id) - 1
                          )
                        }
                      >
                        <MaterialIcons name="remove" size={14} color={Colors.primary} />
                      </Pressable>
                      <Text style={styles.stepperQtyText}>
                        {getCartQuantity(selectedItem._id)}
                      </Text>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() =>
                          updateQuantity(
                            `food-${selectedItem._id}`,
                            getCartQuantity(selectedItem._id) + 1
                          )
                        }
                      >
                        <MaterialIcons name="add" size={14} color={Colors.primary} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[
                        styles.addBtn,
                        isOrderingDisabled && styles.addBtnDisabled,
                      ]}
                      disabled={isOrderingDisabled || !selectedItem.isAvailable}
                      onPress={() => {
                        handleAddItem(selectedItem);
                      }}
                    >
                      <Text
                        style={[
                          styles.addBtnText,
                          isOrderingDisabled && styles.addBtnTextDisabled,
                        ]}
                      >
                        ADD TO CART
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    flex: 1,
    marginHorizontal: Spacing.sm,
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  topIconBtn: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  errorSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
  },
  retryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  heroRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  restaurantName: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  cuisinesText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  ratingText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#92400E',
  },
  ordersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  ordersText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusPillOpen: {
    backgroundColor: '#ECFDF5',
  },
  statusPillClosed: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOpen: {
    backgroundColor: '#10B981',
  },
  statusDotClosed: {
    backgroundColor: '#EF4444',
  },
  statusPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  statusPillTextOpen: {
    color: '#047857',
  },
  statusPillTextClosed: {
    color: '#B91C1C',
  },
  heroImageContainer: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  warningBanner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  warningTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
  warningDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
    lineHeight: 16,
  },
  toolbarCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    height: 38,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
  },
  vegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    height: 38,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  vegBtnActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  vegDotActive: {
    backgroundColor: '#16A34A',
  },
  vegBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  vegBtnTextActive: {
    color: '#16A34A',
  },
  categoryPillsRow: {
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.white,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    maxWidth: 240,
  },
  clearFilterBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  clearFilterText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.primary,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  categoryTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  categoryBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  dishCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  dishInfoCol: {
    flex: 1,
  },
  vegIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vegIndicatorBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegIndicatorCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bestsellerChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bestsellerChipText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: '#B45309',
  },
  dishName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  dishDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dishMetaTag: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: Spacing.xs,
  },
  dishPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  dishOriginalPrice: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  dishImageCol: {
    width: 96,
    alignItems: 'center',
  },
  dishImage: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  dishImagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishAddBtnContainer: {
    marginTop: -16,
    zIndex: 10,
  },
  addBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 5,
    ...Shadows.sm,
  },
  addBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  addBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  addBtnTextDisabled: {
    color: Colors.textMuted,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperQtyText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: 180,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalCategoryText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  modalDishName: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  modalDishDesc: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  modalMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: Spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  modalPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
});
