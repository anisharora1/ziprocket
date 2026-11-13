import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../src/context/CartContext';
import { usePlatform } from '../../src/context/PlatformContext';
import { useSocket } from '../../src/context/SocketContext';
import { useLocation } from '../../src/context/LocationContext';
import { apiClient, isNetworkError } from '../../src/services/api';
import { getIsOnline, onReconnect } from '../../src/services/network';
import OptimizedImage from '../../src/components/OptimizedImage';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  Shadows,
} from '../../src/constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, updateQuantity, clearCart, addToCart } = useCart();
  const {
    getPlatformStatusMessage,
    isGroceryCurrentlyOpen,
    getGroceryStatusMessage,
  } = usePlatform();
  const { socket } = useSocket();
  const { location, pincode, address } = useLocation();

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [vendorAvailability, setVendorAvailability] = useState<string>('open');
  const [multiVendorFee, setMultiVendorFee] = useState<number | null>(null);

  // Socket listener for real-time restaurant status changes
  useEffect(() => {
    if (!socket) return;
    const handleStatusUpdate = (data: {
      restaurantId: string;
      availabilityStatus: string;
      isActive: boolean;
    }) => {
      if (cart.orderType === 'food' && cart.vendorId === data.restaurantId) {
        if (
          data.isActive === false ||
          data.availabilityStatus === 'closed' ||
          data.availabilityStatus === 'disabled'
        ) {
          setVendorAvailability(data.availabilityStatus || 'closed');
        } else {
          setVendorAvailability(data.availabilityStatus || 'open');
        }
      }
    };

    socket.on('restaurant_status_updated', handleStatusUpdate);
    return () => {
      socket.off('restaurant_status_updated', handleStatusUpdate);
    };
  }, [socket, cart.vendorId, cart.orderType]);

  // Initial fetch for food vendor availability
  const fetchVendorStatus = useCallback(async () => {
    if (cart.orderType === 'food' && cart.vendorId) {
      try {
        const res = await apiClient.get(`/restaurants/${cart.vendorId}`);
        if (res.data?.success && res.data?.restaurant) {
          const rest = res.data.restaurant;
          if (
            rest.isActive === false ||
            rest.availabilityStatus === 'closed' ||
            rest.availabilityStatus === 'disabled' ||
            rest.isCurrentlyOpen === false
          ) {
            setVendorAvailability(rest.availabilityStatus === 'disabled' ? 'disabled' : 'closed');
          } else {
            setVendorAvailability('open');
          }
        }
      } catch (err: any) {
        if (__DEV__ && !isNetworkError(err)) {
          console.warn('[Cart] Failed to check restaurant status:', err);
        }
      }
    }
  }, [cart.orderType, cart.vendorId]);

  useEffect(() => {
    fetchVendorStatus();
  }, [fetchVendorStatus]);

  // Reload vendor status on network reconnect
  useEffect(() => {
    const unsub = onReconnect(() => {
      fetchVendorStatus();
    });
    return unsub;
  }, [fetchVendorStatus]);

  // Fetch multiVendorFee from the server bill endpoint when cart is mixed
  useEffect(() => {
    if (!cart.isMixed) {
      setMultiVendorFee(null);
      return;
    }

    const fetchMixedFee = async () => {
      try {
        const payload: any = {
          vendorId: cart.vendorId,
          items: cart.items.map((c) => ({
            menuItem: c.id.replace('food-', ''),
            price: c.price,
            quantity: c.quantity,
          })),
          groceryItems: (cart.groceryItems || []).map((c) => ({
            groceryItem: c.id.replace('groc-', ''),
            price: c.price,
            quantity: c.quantity,
          })),
          orderType: 'mixed',
          userLat: location?.lat || 28.6139,
          userLng: location?.lng || 77.2090,
          pincode: pincode || undefined,
          address: address ? { fullAddress: address } : undefined,
        };
        const res = await apiClient.post('/delivery-zones/calculate-bill', payload);
        if (res.data?.multiVendorFee !== undefined) {
          setMultiVendorFee(Number(res.data.multiVendorFee));
        }
      } catch (err) {
        try {
          const zoneRes = await apiClient.get('/delivery-zones');
          if (zoneRes.data?.zones?.[0]?.multiVendorFee !== undefined) {
            setMultiVendorFee(Number(zoneRes.data.zones[0].multiVendorFee));
          }
        } catch (e) {
          if (__DEV__) {
            console.warn('[Cart] Failed to fetch multi-vendor fee:', e);
          }
        }
      }
    };

    fetchMixedFee();
  }, [cart.isMixed, cart.vendorId, cart.items, cart.groceryItems, location, pincode, address]);

  const platformMsg = getPlatformStatusMessage();

  const isCartServiceClosed = useMemo(() => {
    if (platformMsg) return true;
    if (cart.orderType === 'grocery' && !isGroceryCurrentlyOpen()) return true;
    if (cart.orderType === 'food' && vendorAvailability !== 'open') return true;
    return false;
  }, [platformMsg, cart.orderType, isGroceryCurrentlyOpen, vendorAvailability]);

  const cartServiceMessage = useMemo(() => {
    if (platformMsg) return platformMsg;
    if (cart.orderType === 'grocery') {
      return getGroceryStatusMessage();
    }
    if (cart.orderType === 'food' && vendorAvailability !== 'open') {
      return vendorAvailability === 'disabled'
        ? 'Yeh restaurant abhi temporary band hai.'
        : 'Yeh restaurant abhi band hai.';
    }
    return null;
  }, [platformMsg, cart.orderType, getGroceryStatusMessage, vendorAvailability]);

  const isMixed = cart.isMixed;
  const foodItems = useMemo(
    () => (cart.orderType === 'food' ? cart.items || [] : []),
    [cart.orderType, cart.items]
  );
  const groceryItems = useMemo(
    () => (cart.orderType === 'grocery' ? cart.items || [] : cart.groceryItems || []),
    [cart.orderType, cart.items, cart.groceryItems]
  );

  const totalItemsCount =
    foodItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0) +
    groceryItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);

  const foodSubtotal = foodItems.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
  const grocerySubtotal = groceryItems.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
  const basketSubtotal = foodSubtotal + grocerySubtotal;

  // Fetch recommendations whenever cart items change
  const fetchRecommendations = useCallback(async () => {
    if (totalItemsCount === 0) {
      setRecommendations([]);
      return;
    }
    try {
      setLoadingRecs(true);
      const allCartItemIds = [
        ...foodItems.map((i) => i.id),
        ...groceryItems.map((i) => i.id),
      ];
      const res = await apiClient.post('/recommendations', {
        orderType: cart.orderType,
        vendorId: cart.orderType === 'food' ? cart.vendorId : 'grocery',
        cartItemIds: allCartItemIds,
      });
      if (res.data?.success) {
        setRecommendations(res.data.recommendations || []);
      }
    } catch (err: any) {
      if (__DEV__ && !isNetworkError(err)) {
        console.warn('[Cart] Failed to load recommendations:', err);
      }
    } finally {
      setLoadingRecs(false);
    }
  }, [totalItemsCount, foodItems, groceryItems, cart.orderType, cart.vendorId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Reload recommendations on network reconnect
  useEffect(() => {
    const unsub = onReconnect(() => {
      fetchRecommendations();
    });
    return unsub;
  }, [fetchRecommendations]);

  const handleAddRecommendedItem = (item: any) => {
    const isGrocery = cart.orderType === 'grocery' || item.category !== undefined;
    const itemId = isGrocery ? `groc-${item._id}` : `food-${item._id}`;

    addToCart({
      item: {
        id: itemId,
        name: item.name,
        price: item.price,
        quantity: 1,
        img: item.images?.[0] || '',
      },
      vendorId: isGrocery ? 'zip-grocery-hub' : (cart.vendorId || item.restaurant?._id || item.restaurant),
      vendorName: isGrocery ? 'ZipGrocery Stores' : (cart.vendorName || item.restaurant?.name || 'Restaurant'),
      orderType: isGrocery ? 'grocery' : 'food',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header: White bar, bottom border 1px slate-100 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.slate800} />
          </Pressable>
          <Text style={styles.headerTitle}>Aapka Cart</Text>
        </View>

        {totalItemsCount > 0 ? (
          <Pressable
            onPress={clearCart}
            style={styles.clearAllBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.clearAllText}>CLEAR ALL</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          totalItemsCount > 0 && { paddingBottom: 130 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {totalItemsCount === 0 ? (
          /* Empty state card: Blinkit style */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="shopping-basket" size={36} color={Colors.slate300} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>
              Cart me abhi koi samaan nahi hai. Mazedaar khana ya taaza grocery add karein!
            </Text>
            <View style={styles.emptyButtonsRow}>
              <Pressable
                style={styles.orderFoodBtn}
                onPress={() => router.push('/(tabs)/home' as any)}
              >
                <Text style={styles.orderFoodBtnText}>Order Food</Text>
              </Pressable>
              <Pressable
                style={styles.shopGroceriesBtn}
                onPress={() => router.push('/grocery' as any)}
              >
                <Text style={styles.shopGroceriesBtnText}>Shop Groceries</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.contentBlocks}>
            {/* Mixed Order Notice */}
            {isMixed && (
              <View style={styles.mixedNoticeCard}>
                <MaterialIcons name="info" size={20} color={Colors.warning} style={styles.mixedNoticeIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mixedNoticeTitle}>Mixed Cart Order</Text>
                  <Text style={styles.mixedNoticeText}>
                    Mixed order: a one-time Rs {multiVendorFee !== null ? multiVendorFee : 5} multi-vendor fee applies
                  </Text>
                </View>
              </View>
            )}

            {/* Closed warning banner */}
            {isCartServiceClosed && cartServiceMessage ? (
              <View style={styles.closedWarningBanner}>
                <MaterialIcons
                  name="error"
                  size={20}
                  color={Colors.rose500}
                  style={styles.closedWarningIcon}
                />
                <View style={styles.closedWarningContent}>
                  <Text style={styles.closedWarningTitle}>Order Abhi Band Hai</Text>
                  <Text style={styles.closedWarningDesc}>{cartServiceMessage}</Text>
                </View>
              </View>
            ) : null}

            {/* SECTION 1: FOOD ITEMS (WHEN PRESENT) */}
            {foodItems.length > 0 && (
              <View style={styles.sectionCard}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <View style={styles.foodIconCircle}>
                      <MaterialIcons name="restaurant" size={16} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.sectionCategoryLabel}>RESTAURANT</Text>
                      <Text style={styles.sectionVendorName} numberOfLines={1}>
                        From {cart.vendorName || 'Restaurant Partner'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSubtotal}>₹{foodSubtotal.toFixed(2)}</Text>
                </View>

                {/* Items List */}
                {foodItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      index < foodItems.length - 1 && styles.itemRowBorder,
                    ]}
                  >
                    <View style={styles.itemImgWrapper}>
                      {item.img ? (
                        <OptimizedImage
                          src={item.img}
                          alt={item.name}
                          preset="thumbnail"
                          style={styles.itemImg}
                          contentFit="cover"
                        />
                      ) : (
                        <MaterialIcons name="fastfood" size={20} color={Colors.slate300} />
                      )}
                    </View>

                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>₹{item.price}</Text>
                    </View>

                    <View style={styles.stepperContainer}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialIcons name="remove" size={15} color={Colors.primary} />
                      </Pressable>
                      <Text style={styles.stepperQty}>{item.quantity}</Text>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialIcons name="add" size={15} color={Colors.primary} />
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* Add More Food Items */}
                <Pressable
                  style={styles.addMoreBtn}
                  onPress={() => {
                    if (cart.vendorId) {
                      router.push(`/restaurants/${cart.vendorId}` as any);
                    } else {
                      router.push('/(tabs)/home' as any);
                    }
                  }}
                >
                  <Text style={styles.addMoreFoodText}>+ ADD MORE FOOD ITEMS</Text>
                </Pressable>
              </View>
            )}

            {/* SECTION 2: GROCERY ITEMS (WHEN PRESENT) */}
            {groceryItems.length > 0 && (
              <View style={styles.sectionCard}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <View style={styles.groceryIconCircle}>
                      <MaterialIcons name="store" size={16} color={Colors.emerald700} />
                    </View>
                    <View>
                      <Text style={styles.sectionCategoryLabel}>DEPOT</Text>
                      <Text style={styles.sectionVendorName} numberOfLines={1}>
                        Groceries
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSubtotal}>₹{grocerySubtotal.toFixed(2)}</Text>
                </View>

                {/* Items List */}
                {groceryItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      index < groceryItems.length - 1 && styles.itemRowBorder,
                    ]}
                  >
                    <View style={styles.itemImgWrapper}>
                      {item.img ? (
                        <OptimizedImage
                          src={item.img}
                          alt={item.name}
                          preset="thumbnail"
                          style={styles.itemImg}
                          contentFit="cover"
                        />
                      ) : (
                        <MaterialIcons name="shopping-bag" size={20} color={Colors.slate300} />
                      )}
                    </View>

                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>₹{item.price}</Text>
                    </View>

                    <View style={styles.stepperContainer}>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialIcons name="remove" size={15} color={Colors.primary} />
                      </Pressable>
                      <Text style={styles.stepperQty}>{item.quantity}</Text>
                      <Pressable
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <MaterialIcons name="add" size={15} color={Colors.primary} />
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* Add More Groceries */}
                <Pressable
                  style={styles.addMoreBtn}
                  onPress={() => router.push('/grocery' as any)}
                >
                  <Text style={styles.addMoreGroceryText}>+ ADD MORE GROCERIES</Text>
                </Pressable>
              </View>
            )}

            {/* Recommendations Section */}
            {recommendations.length > 0 ? (
              <View style={styles.recommendationsSection}>
                <View style={styles.recommendationsHeader}>
                  <View>
                    <Text style={styles.recsHeading}>Iske Saath Yeh Bhi Try Karein</Text>
                    <Text style={styles.recsSubheading}>AAPKE CART KE HISAAB SE SUJHAV</Text>
                  </View>
                  <View style={styles.recsBadge}>
                    <Text style={styles.recsBadgeText}>SUJHAV</Text>
                  </View>
                </View>

                {loadingRecs ? (
                  <View style={styles.recsLoadingBox}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : (
                  <FlatList
                    data={recommendations}
                    keyExtractor={(rec) => rec._id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={154}
                    decelerationRate="fast"
                    contentContainerStyle={styles.recsListContent}
                    renderItem={({ item: rec }) => (
                      <View style={styles.recCard}>
                        <View style={styles.recImgWrapper}>
                          {rec.images?.[0] ? (
                            <OptimizedImage
                              src={rec.images[0]}
                              alt={rec.name}
                              preset="thumbnail"
                              style={styles.recImg}
                              contentFit="cover"
                            />
                          ) : rec.category !== undefined ? (
                            <MaterialIcons name="shopping-bag" size={24} color={Colors.slate300} />
                          ) : (
                            <MaterialIcons name="fastfood" size={24} color={Colors.slate300} />
                          )}
                        </View>

                        <Text style={styles.recName} numberOfLines={2}>
                          {rec.name}
                        </Text>
                        {rec.weightSize ? (
                          <Text style={styles.recSize} numberOfLines={1}>
                            {rec.weightSize}
                          </Text>
                        ) : null}

                        <View style={styles.recFooter}>
                          <Text style={styles.recPrice}>₹{rec.price}</Text>
                          <Pressable
                            style={styles.recAddBtn}
                            onPress={() => handleAddRecommendedItem(rec)}
                          >
                            <Text style={styles.recAddBtnText}>ADD</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  />
                )}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Fixed Bottom Checkout Bar (when cart has items) */}
      {totalItemsCount > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.subtotalBlock}>
            <Text style={styles.subtotalLabel}>BASKET SUBTOTAL</Text>
            <View style={styles.subtotalValueRow}>
              <Text style={styles.subtotalAmount}>₹{basketSubtotal.toFixed(2)}</Text>
              <Text style={styles.itemCountText}>
                ({totalItemsCount} {totalItemsCount === 1 ? 'ITEM' : 'ITEMS'})
              </Text>
            </View>
          </View>

          {isCartServiceClosed ? (
            <View style={styles.closedBtn}>
              <Text style={styles.closedBtnText}>CLOSED</Text>
              <MaterialIcons name="lock" size={16} color={Colors.slate400} />
            </View>
          ) : (
            <Pressable
              style={styles.checkoutBtn}
              onPress={() => {
                if (!getIsOnline()) {
                  Alert.alert('Offline', "You're offline. Connect to the internet to proceed to checkout.");
                  return;
                }
                router.push('/checkout' as any);
              }}
            >
              <Text style={styles.checkoutBtnText}>NEXT: CHECKOUT</Text>
              <MaterialIcons name="arrow-forward" size={16} color={Colors.white} />
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    height: 54,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.slate50,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.slate900,
    letterSpacing: -0.3,
  },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
  },
  clearAllText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.rose500,
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.cartBg,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  contentBlocks: {
    gap: 16,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.slate100,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.slate800,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate400,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  orderFoodBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  orderFoodBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shopGroceriesBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.slate200,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopGroceriesBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mixedNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...Shadows.sm,
  },
  mixedNoticeIcon: {
    marginTop: 1,
  },
  mixedNoticeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
    lineHeight: 18,
  },
  mixedNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginTop: 2,
  },
  closedWarningBanner: {
    backgroundColor: Colors.roseWarningBg,
    borderWidth: 1,
    borderColor: Colors.roseWarningBorder,
    borderRadius: BorderRadius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...Shadows.sm,
  },
  closedWarningIcon: {
    marginTop: 1,
  },
  closedWarningContent: {
    flex: 1,
  },
  closedWarningTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.rose800,
  },
  closedWarningDesc: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.rose600,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.slate100,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sectionHeader: {
    padding: 14,
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  foodIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.orange50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCategoryLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    fontWeight: '900',
    color: Colors.slate400,
    letterSpacing: 1.5,
  },
  sectionVendorName: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    fontWeight: '900',
    color: Colors.slate800,
    marginTop: 2,
  },
  sectionSubtotal: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.slate700,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate50,
  },
  itemImgWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.8)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImg: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.slate800,
  },
  itemPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    fontWeight: '900',
    color: Colors.slate900,
    marginTop: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 92, 0, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.20)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    width: 24,
    textAlign: 'center',
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  addMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.slate50,
  },
  addMoreFoodText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 1,
  },
  addMoreGroceryText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.emerald700,
    letterSpacing: 1,
  },
  recommendationsSection: {
    gap: 12,
    paddingTop: 4,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recsHeading: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    fontWeight: '900',
    color: Colors.slate900,
  },
  recsSubheading: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate450,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  recsBadge: {
    backgroundColor: 'rgba(255, 92, 0, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  recsBadgeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 8,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  recsLoadingBox: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recsListContent: {
    gap: 14,
    paddingRight: Spacing.md,
  },
  recCard: {
    width: 140,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.slate100,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  recImgWrapper: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.8)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recImg: {
    width: '100%',
    height: '100%',
  },
  recName: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate800,
    minHeight: 32,
    lineHeight: 15,
  },
  recSize: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.slate400,
    marginTop: 2,
  },
  recFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.slate50,
  },
  recPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.slate900,
  },
  recAddBtn: {
    backgroundColor: Colors.emerald600,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  recAddBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.md,
  },
  subtotalBlock: {
    flex: 1,
  },
  subtotalLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    fontWeight: '900',
    color: Colors.slate450,
    letterSpacing: 1.5,
  },
  subtotalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  subtotalAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    fontWeight: '900',
    color: Colors.slate900,
  },
  itemCountText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  checkoutBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.8,
  },
  closedBtn: {
    backgroundColor: Colors.slate200,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closedBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },
});
