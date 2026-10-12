import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import OptimizedImage from './OptimizedImage';
import { PopularItem } from '../types';
import {
  Colors,
  BorderRadius,
  FontFamily,
  Typography,
} from '../constants/theme';

export interface RestaurantCardCarouselProps {
  items?: PopularItem[];
  fallbackImage: string;
  restaurantName: string;
  cardIndex?: number;
  onPress?: () => void;
}

function getItemImageUrl(item: PopularItem, fallback: string): string {
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    const first = item.images[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (
      typeof first === 'object' &&
      first?.url &&
      typeof first.url === 'string' &&
      first.url.trim()
    ) {
      return first.url.trim();
    }
  }
  return fallback;
}

export default function RestaurantCardCarousel({
  items = [],
  fallbackImage,
  restaurantName,
  cardIndex = 0,
  onPress,
}: RestaurantCardCarouselProps) {
  const displayItems = useMemo(() => (items || []).slice(0, 10), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const flatListRef = useRef<FlatList<PopularItem>>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const staggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserDraggingRef = useRef(false);

  const isFocused = useIsFocused();

  // AppState listener to halt auto-sliding when app is backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        setAppActive(nextState === 'active');
      }
    );
    return () => {
      subscription.remove();
    };
  }, []);

  // Measure card container width to enable precise slide paging
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.round(width) !== Math.round(cardWidth)) {
      setCardWidth(Math.round(width));
    }
  };

  // Auto-slide effect: runs only when focused, app is active, not paused, and has > 1 item
  useEffect(() => {
    if (!isFocused || !appActive || isPaused || displayItems.length <= 1 || cardWidth <= 0) {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      if (staggerTimer.current) clearTimeout(staggerTimer.current);
      return;
    }

    const staggerDelay = (cardIndex || 0) * 400;

    const startInterval = () => {
      autoScrollTimer.current = setInterval(() => {
        setActiveIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % displayItems.length;
          flatListRef.current?.scrollToOffset({
            offset: nextIndex * cardWidth,
            animated: true,
          });
          return nextIndex;
        });
      }, 2500);
    };

    staggerTimer.current = setTimeout(() => {
      startInterval();
    }, staggerDelay);

    return () => {
      if (staggerTimer.current) clearTimeout(staggerTimer.current);
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [isFocused, appActive, isPaused, displayItems.length, cardWidth, cardIndex]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      if (staggerTimer.current) clearTimeout(staggerTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  // User drag & momentum handlers
  const handleScrollBeginDrag = () => {
    isUserDraggingRef.current = true;
    setIsPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    if (staggerTimer.current) clearTimeout(staggerTimer.current);
  };

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardWidth > 0) {
        const offsetX = e.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / cardWidth);
        if (newIndex >= 0 && newIndex < displayItems.length) {
          setActiveIndex(newIndex);
        }
      }

      if (isUserDraggingRef.current) {
        isUserDraggingRef.current = false;
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => {
          setIsPaused(false);
        }, 6000);
      }
    },
    [cardWidth, displayItems.length]
  );

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = e.nativeEvent.velocity;
    if (!velocity || (velocity.x === 0 && velocity.y === 0)) {
      handleScrollEnd(e);
    }
  };

  // If no items, render single fallback image
  if (!displayItems || displayItems.length === 0) {
    return (
      <View style={styles.container} onLayout={handleLayout}>
        <OptimizedImage
          src={fallbackImage}
          alt={restaurantName}
          preset="large"
          style={styles.image}
          contentFit="cover"
        />
      </View>
    );
  }

  const renderSlide = ({ item }: { item: PopularItem }) => {
    const imageUrl = getItemImageUrl(item, fallbackImage);
    const hasDiscount =
      item.discountedPrice !== undefined &&
      item.discountedPrice !== null &&
      Number(item.discountedPrice) > 0 &&
      Number(item.discountedPrice) < item.price;

    return (
      <Pressable
        style={[styles.slide, { width: cardWidth }]}
        onPress={onPress}
      >
        <OptimizedImage
          src={imageUrl}
          alt={`${restaurantName} - ${item.name}`}
          preset="large"
          style={styles.image}
          contentFit="cover"
        />

        {/* Top-left item name + price badge */}
        <View style={styles.itemBadge} pointerEvents="none">
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isFeatured && (
              <View style={styles.featuredChip}>
                <Text style={styles.featuredEmoji}>🔥</Text>
              </View>
            )}
          </View>

          <View style={styles.priceRow}>
            {hasDiscount ? (
              <>
                <Text style={styles.discountedPrice}>
                  ₹{item.discountedPrice}
                </Text>
                <Text style={styles.originalPrice}>₹{item.price}</Text>
              </>
            ) : (
              <Text style={styles.regularPrice}>₹{item.price}</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {cardWidth > 0 ? (
        <FlatList
          ref={flatListRef}
          data={displayItems}
          keyExtractor={(item, index) => item._id || `${item.name}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          getItemLayout={(_, index) => ({
            length: cardWidth,
            offset: cardWidth * index,
            index,
          })}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleScrollEnd}
          renderItem={renderSlide}
        />
      ) : (
        <OptimizedImage
          src={fallbackImage}
          alt={restaurantName}
          preset="large"
          style={styles.image}
          contentFit="cover"
        />
      )}

      {/* Bottom-center dot indicators */}
      {displayItems.length > 1 && (
        <View style={styles.dotsOverlay} pointerEvents="none">
          <View style={styles.dotsPill}>
            {displayItems.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === activeIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  slide: {
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemBadge: {
    position: 'absolute',
    top: 44,
    left: 12,
    maxWidth: '70%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemName: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    flexShrink: 1,
  },
  featuredChip: {
    backgroundColor: Colors.ratingGold,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredEmoji: {
    fontSize: 10,
    lineHeight: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  discountedPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.ratingGold,
  },
  originalPrice: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    fontWeight: Typography.fontWeight.medium,
    color: 'rgba(255, 255, 255, 0.6)',
    textDecorationLine: 'line-through',
  },
  regularPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.ratingGold,
  },
  dotsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dotsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  dot: {
    borderRadius: 3,
  },
  activeDot: {
    width: 14,
    height: 6,
    backgroundColor: Colors.white,
  },
  inactiveDot: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
