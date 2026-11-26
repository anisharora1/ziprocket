import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  AccessibilityInfo,
  AppState,
  type AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';
import { useThemeOverlay } from '../context/ThemeCampaignProvider';

const LOTTIE_CACHE_PREFIX = 'TC_LOTTIE_V1:';
const DOWNLOAD_TIMEOUT_MS = 5000;
const MAX_LOTTIE_BYTES = 400 * 1024;

interface ThemeOverlayProps {
  placement: 'header' | 'fullscreen';
}

function ThemeOverlay({ placement }: ThemeOverlayProps) {
  const overlay = useThemeOverlay();
  const lottieRef = useRef<LottieView>(null);

  const [animationData, setAnimationData] = useState<Record<string, unknown> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  const isMatchingPlacement = Boolean(overlay && overlay.placement === placement);
  const url = overlay?.url;

  // 1. Respect OS Reduce Motion setting
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(Boolean(enabled));
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // 2. Track AppState (pause on background)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      setIsAppActive(status === 'active');
    });
    return () => sub.remove();
  }, []);

  // 3. Track Home tab focus (pause on blur)
  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
      };
    }, [])
  );

  // 4. Load Lottie JSON from AsyncStorage or download once (5s timeout, max 400 KB)
  useEffect(() => {
    if (!isMatchingPlacement || !url) {
      setAnimationData(null);
      return;
    }

    let cancelled = false;
    const cacheKey = `${LOTTIE_CACHE_PREFIX}${url}`;

    const loadAnimation = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!cancelled && parsed && typeof parsed === 'object') {
            setAnimationData(parsed);
            return;
          }
        }
      } catch {
        AsyncStorage.removeItem(cacheKey).catch(() => {});
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;

        const contentLength = response.headers.get('content-length');
        if (contentLength && Number(contentLength) > MAX_LOTTIE_BYTES) {
          return;
        }

        const text = await response.text();
        if (text.length > MAX_LOTTIE_BYTES) {
          return;
        }

        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') return;

        await AsyncStorage.setItem(cacheKey, text).catch(() => {});
        if (!cancelled) {
          setAnimationData(parsed);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[ThemeOverlay] Failed to load overlay:', err);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [isMatchingPlacement, url]);

  // 5. Pause/play when tab focus or app active state changes
  const shouldPlay = isMatchingPlacement && !reduceMotion && isTabFocused && isAppActive;

  useEffect(() => {
    if (!animationData || !lottieRef.current) return;
    if (shouldPlay) {
      lottieRef.current.play();
    } else {
      lottieRef.current.pause();
    }
  }, [animationData, shouldPlay]);

  if (!isMatchingPlacement || reduceMotion || !animationData || !overlay) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        placement === 'header' ? styles.headerLayer : styles.fullscreenLayer,
      ]}
    >
      <LottieView
        ref={lottieRef}
        source={animationData as any}
        autoPlay={shouldPlay}
        loop={overlay.loop}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { opacity: overlay.opacity }]}
      />
    </View>
  );
}

export default React.memo(ThemeOverlay);

const styles = StyleSheet.create({
  headerLayer: {
    zIndex: 2,
  },
  fullscreenLayer: {
    zIndex: 999,
  },
});
