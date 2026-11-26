import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useThemeImages } from '../context/ThemeCampaignProvider';
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

function HeroCarousel() {
  const router = useRouter();
  const themeImages = useThemeImages();
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedThemedSlots, setFailedThemedSlots] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);

  const { data: banners = [] } = useQuery<Promotion[]>({
    queryKey: ['hero-promotions'],
    queryFn: async () => {
      const res = await apiClient.get('/promotions');
      const list = res.data?.promotions || res.data?.data?.promotions || [];
      return list.filter((p: Promotion) => p.isActive);
    },
  });

  const themedHero = themeImages?.hero;
  const isThemed = Boolean(themedHero && themedHero.length > 0);
  const slideCount = isThemed ? themedHero!.length : banners.length;

  useEffect(() => {
    setFailedThemedSlots({});
    setActiveIndex(0);
  }, [themedHero]);

  // Auto-scroll banners every 4 seconds
  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % slideCount;
        scrollRef.current?.scrollTo({
          x: next * BANNER_WIDTH,
          animated: true,
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [slideCount]);

  const handleBannerPress = useCallback(
    (banner: Promotion) => {
      let destination =
        banner.category || (banner.targetType === 'grocery' ? '/grocery' : '/restaurants');
      if (destination === '/restaurant') {
        destination = '/restaurants';
      }

      if (banner.restaurant) {
        const restId =
          typeof banner.restaurant === 'object' ? banner.restaurant._id : banner.restaurant;
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
      }
    },
    [router]
  );

  const handleThemedPress = useCallback(
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
      const contentOffset = event.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffset / BANNER_WIDTH);
      if (index !== activeIndex && index >= 0 && index < slideCount) {
        setActiveIndex(index);
      }
    },
    [activeIndex, slideCount]
  );

  if (slideCount === 0) {
    return null;
  }

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
        {isThemed
          ? themedHero!.map((item, idx) => {
              const fallbackBanner =
                failedThemedSlots[idx] && banners.length > 0
                  ? banners[idx % banners.length]
                  : null;

              if (fallbackBanner) {
                return (
                  <Pressable
                    key={`fallback-${idx}-${fallbackBanner._id}`}
                    style={styles.bannerWrapper}
                    onPress={() => handleBannerPress(fallbackBanner)}
                    accessibilityRole="button"
                    accessibilityLabel={fallbackBanner.title}
                  >
                    <OptimizedImage
                      src={fallbackBanner.image}
                      alt={fallbackBanner.title}
                      preset="large"
                      style={styles.bannerImage}
                      contentFit="cover"
                    />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={`themed-hero-${idx}`}
                  style={styles.bannerWrapper}
                  onPress={() => handleThemedPress(item.deepLink)}
                  accessibilityRole="button"
                  accessibilityLabel={`Festival banner ${idx + 1}`}
                >
                  <OptimizedImage
                    src={item.imageUrl}
                    alt={`Festival banner ${idx + 1}`}
                    preset="large"
                    style={styles.bannerImage}
                    contentFit="cover"
                    onError={() =>
                      setFailedThemedSlots((prev) => ({ ...prev, [idx]: true }))
                    }
                  />
                </Pressable>
              );
            })
          : banners.map((item) => (
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
      {slideCount > 1 && (
        <View style={styles.dotsRow}>
          {Array.from({ length: slideCount }).map((_, idx) => (
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

export default React.memo(HeroCarousel);

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
