import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import OptimizedImage from './OptimizedImage';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
} from '../constants/theme';

export interface Promotion {
  _id: string;
  title: string;
  description: string;
  image: string;
  targetType: 'restaurant' | 'grocery';
  category?: string;
  restaurant?: any;
  isActive: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const BANNER_HEIGHT = BANNER_WIDTH * 0.44;

export default function HeroCarousel() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const { data: banners = [] } = useQuery<Promotion[]>({
    queryKey: ['hero-promotions'],
    queryFn: async () => {
      const res = await apiClient.get('/promotions');
      const list = res.data?.promotions || res.data?.data?.promotions || [];
      return list.filter((p: Promotion) => p.isActive);
    },
  });

  // Auto-scroll banners every 4 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({
          x: next * BANNER_WIDTH,
          animated: true,
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const handleBannerPress = (banner: Promotion) => {
    let destination = banner.category || (banner.targetType === 'grocery' ? '/grocery' : '/restaurants');
    if (destination === '/restaurant') {
      destination = '/restaurants';
    }

    if (banner.restaurant) {
      const restId = typeof banner.restaurant === 'object' ? banner.restaurant._id : banner.restaurant;
      router.push(`/restaurants/${restId}` as any);
      return;
    }

    if (destination === '/grocery' || banner.targetType === 'grocery') {
      router.push('/grocery' as any);
      return;
    }

    if (destination.startsWith('/grocery/category/')) {
      router.push(destination as any);
      return;
    }

    if (destination.startsWith('/restaurants/')) {
      router.push(destination as any);
      return;
    }

    if (destination === '/restaurants') {
      router.push('/(tabs)/home' as any);
      return;
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / BANNER_WIDTH);
    if (index !== activeIndex && index >= 0 && index < banners.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {banners.map((item) => (
          <Pressable
            key={item._id}
            style={styles.bannerWrapper}
            onPress={() => handleBannerPress(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <OptimizedImage
              src={item.image}
              alt={item.title}
              preset="large"
              style={styles.bannerImage}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      {banners.length > 1 && (
        <View style={styles.dotsRow}>
          {banners.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === activeIndex ? styles.activeDot : null,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  scrollContent: {
    gap: 0,
  },
  bannerWrapper: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    position: 'relative',
    ...Shadows.md,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  activeDot: {
    width: 18,
    backgroundColor: Colors.primary,
  },
});
