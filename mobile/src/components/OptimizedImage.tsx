import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StyleProp } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export type ImagePreset = 'thumbnail' | 'tile' | 'product' | 'card' | 'large' | 'avatar';

export interface OptimizedImageProps {
  src: any;
  alt?: string;
  preset?: ImagePreset;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  onError?: () => void;
}

export const getOptimizedCloudinaryUrl = (
  url: string,
  preset: ImagePreset = 'card'
): string => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return url;

  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  let transformations = 'f_auto,q_auto';
  switch (preset) {
    case 'thumbnail':
      transformations = 'w_150,h_150,c_fill,g_auto,f_auto,q_auto';
      break;
    case 'tile':
      transformations = 'w_360,h_360,c_fill,g_auto,f_auto,q_auto';
      break;
    case 'product':
      transformations = 'w_400,h_400,c_pad,b_white,f_auto,q_auto';
      break;
    case 'avatar':
      transformations = 'w_100,h_100,c_fill,g_face,f_auto,q_auto';
      break;
    case 'card':
      transformations = 'w_400,h_300,c_fill,g_auto,f_auto,q_auto';
      break;
    case 'large':
      transformations = 'w_1000,c_limit,f_auto,q_auto';
      break;
  }

  return `${parts[0]}/upload/${transformations}/${parts[1]}`;
};

export const getOptimizedUnsplashUrl = (
  url: string,
  preset: ImagePreset = 'card'
): string => {
  if (!url || typeof url !== 'string' || !url.includes('images.unsplash.com')) return url;

  try {
    const [baseUrl, query] = url.split('?');
    const searchParams = new URLSearchParams(query || '');

    searchParams.set('auto', 'format');
    if (!searchParams.has('q')) {
      searchParams.set('q', '80');
    }

    switch (preset) {
      case 'thumbnail':
        searchParams.set('w', '150');
        searchParams.set('h', '150');
        searchParams.set('fit', 'crop');
        break;
      case 'tile':
        searchParams.set('w', '360');
        searchParams.set('h', '360');
        searchParams.set('fit', 'crop');
        break;
      case 'avatar':
        searchParams.set('w', '100');
        searchParams.set('h', '100');
        searchParams.set('fit', 'crop');
        searchParams.set('facepad', '2');
        break;
      case 'card':
        searchParams.set('w', '400');
        searchParams.set('h', '300');
        searchParams.set('fit', 'crop');
        break;
      case 'large':
        searchParams.set('w', '1000');
        break;
    }

    return `${baseUrl}?${searchParams.toString()}`;
  } catch (e) {
    return url;
  }
};

export const getOptimizedSrc = (
  src: any,
  preset: ImagePreset = 'card'
): string => {
  if (!src) return '';

  let url = src;
  if (typeof src === 'object' && src !== null) {
    url = src.url || src.uri || '';
  }

  if (typeof url !== 'string') return '';

  let cleanUrl = url;
  let maxUnescape = 10;
  while (
    maxUnescape > 0 &&
    (cleanUrl.includes('&amp;') || cleanUrl.includes('&#x2F;') || cleanUrl.includes('&#47;'))
  ) {
    cleanUrl = cleanUrl
      .replace(/&amp;/g, '&')
      .replace(/&#x2F;/gi, '/')
      .replace(/&#47;/g, '/');
    maxUnescape--;
  }

  if (cleanUrl.includes('res.cloudinary.com')) {
    return getOptimizedCloudinaryUrl(cleanUrl, preset);
  } else if (cleanUrl.includes('images.unsplash.com')) {
    return getOptimizedUnsplashUrl(cleanUrl, preset);
  }
  return cleanUrl;
};

export default function OptimizedImage({
  src,
  alt = 'Image',
  preset = 'card',
  style,
  contentFit = 'cover',
  priority = false,
  onError,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optimizedUri = getOptimizedSrc(src, preset);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setHasError(false);
    setRetryCount(0);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [optimizedUri]);

  if (!optimizedUri || hasError) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <MaterialIcons name="image" size={24} color={Colors.textMuted} />
      </View>
    );
  }

  return (
    <Image
      key={`${optimizedUri}-${retryCount}`}
      source={{ uri: optimizedUri }}
      recyclingKey={optimizedUri}
      accessibilityLabel={alt}
      contentFit={contentFit}
      priority={priority ? 'high' : 'normal'}
      transition={200}
      style={style}
      onError={() => {
        if (retryCount === 0) {
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            setHasError(false);
            setRetryCount(1);
          }, 1500);
          return;
        }
        setHasError(true);
        onError?.();
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    backgroundColor: Colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
