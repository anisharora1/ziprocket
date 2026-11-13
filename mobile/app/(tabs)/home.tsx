import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Header from '../../src/components/Header';
import SearchBar from '../../src/components/SearchBar';
import HeroCarousel from '../../src/components/HeroCarousel';
import Categories from '../../src/components/Categories';
import TopRated from '../../src/components/TopRated';
import RestaurantList from '../../src/components/RestaurantList';
import PopularGroceries from '../../src/components/PopularGroceries';
import BrandFooter from '../../src/components/BrandFooter';
import { apiClient } from '../../src/services/api';
import { Restaurant } from '../../src/types';
import { Colors, Spacing } from '../../src/constants/theme';
import { searchFocusStore } from '../../src/services/searchFocusStore';
import { useLocation } from '../../src/context/LocationContext';
import { useIsOnline } from '../../src/services/network';
import OfflineState from '../../src/components/OfflineState';
import {
  getTopRatedSectionRestaurants,
  getHomeRestaurantList,
} from '../../src/utils/orderRestaurants';

export default function HomeScreen() {
  const flatListRef = useRef<FlatList<Restaurant>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { focusSearch } = useLocalSearchParams<{ focusSearch?: string }>();
  const prevFocusSearchRef = useRef<string | undefined>(undefined);
  const { zoneId } = useLocation();

  // Seed that increments only on pull-to-refresh to trigger random reshuffle without re-render jumping
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    if (focusSearch && focusSearch !== prevFocusSearchRef.current) {
      prevFocusSearchRef.current = focusSearch;
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [focusSearch]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        searchInputRef.current?.blur();
        searchFocusStore.setIsFocused(false);
      };
    }, [])
  );

  // Shared promotions query key with TopRated
  const {
    data: promotions = [],
    refetch: refetchPromotions,
    isRefetching: isPromotionsRefetching,
  } = useQuery<any[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await apiClient.get('/promotions');
      const list = res.data?.promotions || res.data?.data?.promotions || [];
      return list.filter((p: any) => p.isActive);
    },
  });

  const isOnline = useIsOnline();

  // Paginated restaurants query (pages of 10) filtered by deliveryZone if available
  const {
    data,
    isLoading,
    isError: isRestaurantsError,
    fetchStatus: restaurantsFetchStatus,
    refetch: refetchRestaurants,
    isRefetching: isRestaurantsRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Restaurant[]>({
    queryKey: ['home-restaurants', zoneId || 'all'],
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;
      const url = zoneId
        ? `/restaurants?status=approved&isActive=true&page=${page}&limit=10&deliveryZone=${zoneId}`
        : `/restaurants?status=approved&isActive=true&page=${page}&limit=10`;
      const res = await apiClient.get(url);
      const list = res.data?.restaurants || res.data?.data?.restaurants || [];
      return list as Restaurant[];
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < 10) {
        return undefined;
      }
      return allPages.length + 1;
    },
  });

  const restaurants = useMemo(() => {
    return data?.pages ? data.pages.flatMap((page) => page) : [];
  }, [data]);

  // TopRated section: featured + top 3 rated (rating > 0, highest first)
  const topRatedRestaurants = useMemo(() => {
    return getTopRatedSectionRestaurants(restaurants, promotions);
  }, [restaurants, promotions]);

  // Main Restaurants list: featured first, then ALL other restaurants shuffled (Fisher-Yates)
  const homeRestaurants = useMemo(() => {
    return getHomeRestaurantList(restaurants, promotions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, promotions, shuffleSeed]);

  const handleRefresh = useCallback(() => {
    setShuffleSeed((prev) => prev + 1);
    refetchRestaurants();
    refetchPromotions();
  }, [refetchRestaurants, refetchPromotions]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isRefreshing = isRestaurantsRefetching || isPromotionsRefetching;

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBody}>
        <SearchBar inputRef={searchInputRef} />
        <HeroCarousel />
        <Categories />
        <TopRated items={topRatedRestaurants} />
        {restaurants.length === 0 &&
        (isRestaurantsError ||
          restaurantsFetchStatus === 'paused' ||
          !isOnline) ? (
          <OfflineState compact onRetry={handleRefresh} />
        ) : isLoading && restaurants.length === 0 ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}
      </View>
    ),
    [
      topRatedRestaurants,
      restaurants.length,
      isRestaurantsError,
      restaurantsFetchStatus,
      isOnline,
      isLoading,
      handleRefresh,
    ]
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footerBody}>
        {isFetchingNextPage && (
          <View style={styles.footerLoading}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
        <View style={styles.footerGroceries}>
          <PopularGroceries />
        </View>
        {!isLoading && <BrandFooter />}
      </View>
    ),
    [isFetchingNextPage, isLoading]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header />
      <RestaurantList
        restaurants={homeRestaurants}
        flatListRef={flatListRef}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBody: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  footerBody: {
    gap: Spacing.sm,
  },
  footerGroceries: {
    paddingHorizontal: Spacing.md,
  },
  footerLoading: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
