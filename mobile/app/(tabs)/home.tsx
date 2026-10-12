import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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
import {
  getTopRatedSectionRestaurants,
  getHomeRestaurantList,
} from '../../src/utils/orderRestaurants';

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { focusSearch } = useLocalSearchParams<{ focusSearch?: string }>();
  const prevFocusSearchRef = useRef<string | undefined>(undefined);
  const { zoneId } = useLocation();

  // Seed that increments only on pull-to-refresh to trigger random reshuffle without re-render jumping
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    if (focusSearch && focusSearch !== prevFocusSearchRef.current) {
      prevFocusSearchRef.current = focusSearch;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  // Up to 50 restaurants filtered by deliveryZone if available
  const {
    data: restaurants = [],
    isLoading,
    refetch: refetchRestaurants,
    isRefetching: isRestaurantsRefetching,
  } = useQuery<Restaurant[]>({
    queryKey: ['home-restaurants', zoneId || 'all'],
    queryFn: async () => {
      const url = zoneId
        ? `/restaurants?status=approved&isActive=true&limit=50&deliveryZone=${zoneId}`
        : '/restaurants?status=approved&isActive=true&limit=50';
      const res = await apiClient.get(url);
      return res.data?.restaurants || res.data?.data?.restaurants || [];
    },
  });

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

  const isRefreshing = isRestaurantsRefetching || isPromotionsRefetching;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.body}>
          <SearchBar inputRef={searchInputRef} />
          <HeroCarousel />
          <Categories />
          <TopRated items={topRatedRestaurants} />
          {isLoading && restaurants.length === 0 ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <RestaurantList restaurants={homeRestaurants} />
          )}
          <PopularGroceries />
        </View>

        {!isLoading && <BrandFooter />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  centerLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
