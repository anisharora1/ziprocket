import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../services/api';
import OptimizedImage from './OptimizedImage';
import { Restaurant } from '../types';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';
import { getTopRatedSectionRestaurants } from '../utils/orderRestaurants';
import { useLocation } from '../context/LocationContext';

interface TopRatedProps {
  items?: Restaurant[];
}

export default function TopRated({ items }: TopRatedProps = {}) {
  const router = useRouter();
  const { zoneId } = useLocation();

  const { data: promotions = [] } = useQuery<any[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await apiClient.get('/promotions');
      const list = res.data?.promotions || res.data?.data?.promotions || [];
      return list.filter((p: any) => p.isActive);
    },
    enabled: !items,
  });

  const { data: queriedRestaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ['home-restaurants', zoneId || 'all'],
    queryFn: async () => {
      const url = zoneId
        ? `/restaurants?status=approved&isActive=true&limit=50&deliveryZone=${zoneId}`
        : '/restaurants?status=approved&isActive=true&limit=50';
      const res = await apiClient.get(url);
      return res.data?.restaurants || res.data?.data?.restaurants || [];
    },
    enabled: !items,
  });

  const displayRestaurants = useMemo(() => {
    if (items) return items;
    return getTopRatedSectionRestaurants(queriedRestaurants, promotions);
  }, [items, queriedRestaurants, promotions]);

  if (!displayRestaurants || displayRestaurants.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Featured & Top Rated</Text>
        <Text style={styles.seeAllText}>SPONSORED CHOICES</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {displayRestaurants.map((item) => {
          const bannerImg =
            item.popularItems?.[0]?.images?.[0] ||
            (typeof item.image === 'string'
              ? item.image
              : typeof item.image === 'object' && item.image?.url
                ? item.image.url
                : 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4');

          return (
            <Pressable
              key={item._id}
              style={styles.card}
              onPress={() => router.push(`/restaurants/${item._id}` as any)}
            >
              <View style={styles.imageBox}>
                <OptimizedImage
                  src={bannerImg}
                  alt={item.name}
                  preset="card"
                  style={styles.cardImage}
                  contentFit="cover"
                />
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>
                    {(Number(item.rating) || 0) > 0 ? Number(item.rating).toFixed(1) : 'New'}
                  </Text>
                  <MaterialIcons name="star" size={12} color={Colors.primary} />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cuisineText} numberOfLines={1}>
                  {item.cuisines || item.location?.address || 'Hyperlocal cuisine'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
  },
  seeAllText: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  scrollList: {
    gap: Spacing.md,
    paddingRight: Spacing.md,
  },
  card: {
    width: 170,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  imageBox: {
    width: '100%',
    height: 110,
    backgroundColor: Colors.surfaceMuted,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 2,
    ...Shadows.sm,
  },
  ratingText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  infoBox: {
    padding: Spacing.sm,
  },
  nameText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  cuisineText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
