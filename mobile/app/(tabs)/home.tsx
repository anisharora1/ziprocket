import React from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function HomeScreen() {
  const {
    data: restaurants = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Restaurant[]>({
    queryKey: ['home-restaurants'],
    queryFn: async () => {
      const res = await apiClient.get('/restaurants?status=approved&isActive=true&limit=10');
      return res.data?.restaurants || res.data?.data?.restaurants || [];
    },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.body}>
          <SearchBar />
          <HeroCarousel />
          <Categories />
          <TopRated />
          {isLoading && restaurants.length === 0 ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <RestaurantList restaurants={restaurants} />
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
