import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../src/services/api';
import { useCart, useCartActions } from '../../src/context/CartContext';
import { usePlatform } from '../../src/context/PlatformContext';
import {
  useGroceryThemeColors,
  useGroceryThemeImages,
  useGroceryThemeOverlay,
} from '../../src/context/ThemeCampaignProvider';
import { isLightColor, ThemeHeroItem } from '../../src/utils/themeCampaign';
import OptimizedImage from '../../src/components/OptimizedImage';
import ProductCard, { Product } from '../../src/components/ProductCard';
import ThemeProductStrips from '../../src/components/ThemeProductStrips';
import ThemeOverlay from '../../src/components/ThemeOverlay';
import FloatingCartButton from '../../src/components/FloatingCartButton';
import BrandFooter from '../../src/components/BrandFooter';
import { useIsOnline } from '../../src/services/network';
import OfflineState from '../../src/components/OfflineState';
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

interface CategoryTileItem {
  id: string;
  name: string;
  image: string;
  color: string;
  bg: string;
}

const TILE_CARD_PADDING = Spacing.xs + 2;
const TILE_LABEL_LINE_HEIGHT = 18;

const GroceryCategoryTile = React.memo(function GroceryCategoryTile({
  cat,
  tileWidth,
  fontSize,
  accentColor,
  onPress,
}: {
  cat: CategoryTileItem;
  tileWidth: number;
  fontSize: number;
  accentColor: string | null;
  onPress: (catId: string) => void;
}) {
  const imageWidth = Math.max(0, tileWidth - 2 * TILE_CARD_PADDING);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        { width: tileWidth },
        pressed && { opacity: 0.85 },
      ]}
      onPress={() => onPress(cat.id)}
      accessibilityRole="button"
      accessibilityLabel={cat.name}
    >
      <View
        style={[
          styles.categoryImageWrapper,
          { width: imageWidth },
          accentColor
            ? {
                backgroundColor: Colors.white,
                borderWidth: 2,
                borderColor: accentColor,
              }
            : { backgroundColor: cat.bg },
        ]}
      >
        <OptimizedImage
          src={cat.image}
          alt={cat.name}
          preset="tile"
          style={styles.categoryImage}
          contentFit="cover"
        />
      </View>
      <Text
        style={[styles.categoryName, { fontSize }]}
        numberOfLines={2}
        allowFontScaling
        maxFontSizeMultiplier={1.15}
      >
        {cat.name}
      </Text>
    </Pressable>
  );
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const HERO_HEIGHT = HERO_WIDTH * 0.44;

const GroceryThemedHero = React.memo(function GroceryThemedHero({
  heroItems,
  accentColor,
  onFallback,
}: {
  heroItems: ThemeHeroItem[];
  accentColor: string;
  onFallback: () => React.ReactNode;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlots, setFailedSlots] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setFailedSlots({});
    setActiveIndex(0);
  }, [heroItems]);

  useEffect(() => {
    if (heroItems.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % heroItems.length;
        scrollRef.current?.scrollTo({ x: next * HERO_WIDTH, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [heroItems.length]);

  const handlePress = useCallback(
    async (deepLink?: string) => {
      if (!deepLink) return;
      const trimmed = deepLink.trim();
      if (!trimmed) return;
      try {
        if (trimmed.startsWith('/')) {
          router.push(trimmed as any);
          return;
        }
        const canOpen = await Linking.canOpenURL(trimmed);
        if (canOpen) {
          await Linking.openURL(trimmed);
        }
      } catch {
        // Ignore unresolvable deep links
      }
    },
    [router]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(event.nativeEvent.contentOffset.x / HERO_WIDTH);
      if (idx !== activeIndex && idx >= 0 && idx < heroItems.length) {
        setActiveIndex(idx);
      }
    },
    [activeIndex, heroItems.length]
  );

  return (
    <View style={styles.themedHeroContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {heroItems.map((item, idx) =>
          failedSlots[idx] ? (
            <View key={`fallback-${idx}`} style={{ width: HERO_WIDTH }}>
              {onFallback()}
            </View>
          ) : (
            <Pressable
              key={`groc-hero-${idx}`}
              style={styles.themedHeroSlide}
              onPress={() => handlePress(item.deepLink)}
              accessibilityRole="button"
              accessibilityLabel={`Grocery campaign banner ${idx + 1}`}
            >
              <OptimizedImage
                src={item.imageUrl}
                alt={`Grocery campaign banner ${idx + 1}`}
                preset="large"
                style={styles.themedHeroImage}
                contentFit="cover"
                onError={() =>
                  setFailedSlots((prev) => ({ ...prev, [idx]: true }))
                }
              />
            </Pressable>
          )
        )}
      </ScrollView>
      {heroItems.length > 1 && (
        <View style={styles.themedDotsRow}>
          {heroItems.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.themedDot,
                idx === activeIndex
                  ? { width: 18, backgroundColor: accentColor }
                  : null,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default function GroceryIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tileGap = Spacing.sm;
  const tileWidth = (windowWidth - 2 * Spacing.md - 2 * tileGap) / 3;
  const tileLabelFontSize = windowWidth < 380 ? Typography.fontSize.md - 1 : Typography.fontSize.md;
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { cart } = useCart();
  const { addToCart, updateQuantity } = useCartActions();
  const { getGroceryStatusMessage } = usePlatform();
  const groceryStatusMessage = getGroceryStatusMessage();
  const groceryColors = useGroceryThemeColors();
  const groceryImages = useGroceryThemeImages();
  const groceryOverlay = useGroceryThemeOverlay();

  const [searchQuery, setSearchQuery] = useState(q || '');

  useEffect(() => {
    if (q) {
      setSearchQuery(q);
    }
  }, [q]);

  const isOnline = useIsOnline();

  // Fetch featured & recent grocery products
  const {
    data: featuredProducts = [],
    isLoading: featuredLoading,
    isError: featuredError,
    fetchStatus: featuredFetchStatus,
    refetch: refetchFeatured,
  } = useQuery<Product[]>({
    queryKey: ['grocery-featured'],
    queryFn: async () => {
      const res = await apiClient.get('/grocery?isFeatured=true&limit=8');
      return res.data?.products || [];
    },
  });

  const {
    data: recentProducts = [],
    isLoading: recentLoading,
    isError: recentError,
    fetchStatus: recentFetchStatus,
    refetch: refetchRecent,
  } = useQuery<Product[]>({
    queryKey: ['grocery-recent'],
    queryFn: async () => {
      const res = await apiClient.get('/grocery?limit=10');
      return res.data?.products || [];
    },
  });

  const isInitialLoading =
    (featuredLoading && featuredProducts.length === 0 && isOnline && featuredFetchStatus !== 'paused') ||
    (recentLoading && recentProducts.length === 0 && isOnline && recentFetchStatus !== 'paused');

  // Search query
  const {
    data: searchResults = [],
    isFetching: isSearching,
    isError: searchError,
    fetchStatus: searchFetchStatus,
    refetch: refetchSearch,
  } = useQuery<Product[]>({
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

  const getCartQuantity = useCallback(
    (productId: string) => {
      const item = [...cart.items, ...(cart.groceryItems || [])].find(
        (i) => i.id === `groc-${productId}` || i.id === productId
      );
      return item ? item.quantity : 0;
    },
    [cart.items, cart.groceryItems]
  );

  const handleCategoryPress = useCallback(
    (catId: string) => {
      router.push({
        pathname: '/grocery/category/[categoryName]',
        params: { categoryName: catId },
      } as any);
    },
    [router]
  );

  const renderSearchBox = () => (
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
  );

  const renderDefaultHeroBanner = (includeSearchBox: boolean) => (
    <View style={styles.heroBanner}>
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>DELIVERY IN 10 MINUTES</Text>
      </View>
      <Text style={styles.bannerTitle}>ZipGrocery Store</Text>
      <Text
        style={[
          styles.bannerSubtitle,
          !includeSearchBox && { marginBottom: 0 },
        ]}
      >
        Fresh vegetables, dairy, household items & munchies delivered instantly!
      </Text>
      {includeSearchBox ? renderSearchBox() : null}
    </View>
  );

  const hasThemedHero = Boolean(groceryImages?.hero && groceryImages.hero.length > 0);
  const statusBarStyle = groceryColors
    ? isLightColor(groceryColors.stageFrom)
      ? 'dark'
      : 'light'
    : 'dark';

  return (
    <SafeAreaView
      style={[
        styles.container,
        groceryColors ? { backgroundColor: groceryColors.pageBg } : null,
      ]}
      edges={groceryColors ? ['left', 'right'] : ['top', 'left', 'right']}
    >
      <StatusBar style={statusBarStyle} />

      {groceryColors ? (
        <LinearGradient
          colors={[groceryColors.stageFrom, groceryColors.stageTo]}
          style={[styles.themedStage, { paddingTop: insets.top }]}
        >
          {groceryImages?.garland ? (
            <Image
              source={{ uri: groceryImages.garland }}
              style={styles.garlandOverlay}
              contentFit="cover"
              pointerEvents="none"
            />
          ) : null}
          {groceryOverlay?.placement === 'header' ? (
            <ThemeOverlay surface="grocery" placement="header" />
          ) : null}
          <View style={styles.stageForeground}>
            <View style={[styles.topBar, styles.themedTopBar]}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <MaterialIcons
                  name="arrow-back"
                  size={22}
                  color={groceryColors.headerText}
                />
              </Pressable>
              <Text
                style={[styles.topBarTitle, { color: groceryColors.headerText }]}
              >
                Grocery Store
              </Text>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.themedSearchContainer}>{renderSearchBox()}</View>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Grocery Store</Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Hero Banner */}
          {groceryColors ? (
            hasThemedHero ? (
              <GroceryThemedHero
                heroItems={groceryImages!.hero}
                accentColor={groceryColors.accent}
                onFallback={() => renderDefaultHeroBanner(false)}
              />
            ) : (
              renderDefaultHeroBanner(false)
            )
          ) : (
            renderDefaultHeroBanner(true)
          )}

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
              <Text style={styles.sectionTitle}>{`Search Results for "${searchQuery}"`}</Text>
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>Clear</Text>
              </Pressable>
            </View>

            {searchResults.length === 0 && (!isOnline || searchFetchStatus === 'paused' || searchError) ? (
              <OfflineState compact onRetry={refetchSearch} />
            ) : isSearching ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Searching groceries...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <MaterialIcons name="shopping-bag" size={40} color={Colors.textMuted} />
                <Text style={styles.emptySearchText}>
                  {'No grocery items match your search. Try "milk" or "oil".'}
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
            {/* Festival / Event Product Strips */}
            <ThemeProductStrips
              surface="grocery"
              getCartQuantity={getCartQuantity}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
            />

            {/* Shop by Category Grid */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>SHOP BY CATEGORY</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <GroceryCategoryTile
                    key={cat.id}
                    cat={cat}
                    tileWidth={tileWidth}
                    fontSize={tileLabelFontSize}
                    accentColor={groceryColors ? groceryColors.accent : null}
                    onPress={handleCategoryPress}
                  />
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

              {featuredProducts.length === 0 && (!isOnline || featuredFetchStatus === 'paused' || featuredError) ? (
                <OfflineState compact onRetry={refetchFeatured} />
              ) : featuredLoading && featuredProducts.length === 0 ? (
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

              {recentProducts.length === 0 && (!isOnline || recentFetchStatus === 'paused' || recentError) ? (
                <OfflineState compact onRetry={refetchRecent} />
              ) : recentLoading && recentProducts.length === 0 ? (
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
        </View>

        {!isInitialLoading && <BrandFooter />}
      </ScrollView>

      {groceryOverlay?.placement === 'fullscreen' ? (
        <ThemeOverlay surface="grocery" placement="fullscreen" />
      ) : null}

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
  themedStage: {
    position: 'relative',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: Spacing.md,
    overflow: 'hidden',
    zIndex: 100,
  },
  themedTopBar: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  themedSearchContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  stageForeground: {
    zIndex: 3,
  },
  garlandOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    aspectRatio: 6,
    zIndex: 1,
  },
  themedHeroContainer: {
    marginBottom: Spacing.md,
  },
  themedHeroSlide: {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    ...Shadows.md,
  },
  themedHeroImage: {
    width: '100%',
    height: '100%',
  },
  themedDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  themedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
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
    paddingBottom: 0,
  },
  body: {
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
    justifyContent: 'flex-start',
  },
  categoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: TILE_CARD_PADDING,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  categoryImageWrapper: {
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: TILE_LABEL_LINE_HEIGHT,
    minHeight: 2 * TILE_LABEL_LINE_HEIGHT,
    marginTop: Spacing.xs,
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
