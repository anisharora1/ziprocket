import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useLocation } from './LocationContext';
import {
  ThemeCampaign,
  ThemeCampaignImages,
  ThemeHomeColors,
  ThemeHomeSection,
  isWithinCampaignWindow,
  validateThemeCampaign,
} from '../utils/themeCampaign';

const STORAGE_KEY = 'TC_ACTIVE_V1';
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647;

const EMPTY_SECTIONS: ThemeHomeSection[] = [];

const ThemeCampaignContext = createContext<ThemeCampaign | null>(null);
const ThemeColorsContext = createContext<ThemeHomeColors | null>(null);
const ThemeImagesContext = createContext<ThemeCampaignImages | null>(null);
const ThemeSectionsContext = createContext<ThemeHomeSection[]>(EMPTY_SECTIONS);

export function ThemeCampaignProvider({ children }: { children: React.ReactNode }) {
  const { zoneId } = useLocation();
  const [activeCampaign, setActiveCampaign] = useState<ThemeCampaign | null>(null);

  // 1. Hydrate last good campaign from disk off the first-render path
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          const validated = validateThemeCampaign(parsed);
          if (validated) {
            setActiveCampaign(validated);
          } else {
            AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
          }
        } catch {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Background fetch via existing QueryClient (never blocks rendering)
  const { data: fetchedCampaign } = useQuery<ThemeCampaign | null>({
    queryKey: ['theme-campaign', 'home', zoneId || 'all'],
    queryFn: async () => {
      const res = await apiClient.get('/app-config/mobile', {
        params: zoneId ? { surface: 'home', zoneId } : { surface: 'home' },
      });
      const rawCampaign = res.data?.campaign ?? null;
      return validateThemeCampaign(rawCampaign);
    },
    staleTime: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // 3. Apply fetched campaign, persist to disk, and prefetch images
  useEffect(() => {
    if (fetchedCampaign === undefined) return;

    if (fetchedCampaign === null) {
      setActiveCampaign(null);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return;
    }

    setActiveCampaign(fetchedCampaign);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fetchedCampaign)).catch(() => {});

    const urlsToPrefetch: string[] = [];
    if (fetchedCampaign.home.images.garland) {
      urlsToPrefetch.push(fetchedCampaign.home.images.garland);
    }
    for (const heroItem of fetchedCampaign.home.images.hero) {
      if (heroItem.imageUrl) {
        urlsToPrefetch.push(heroItem.imageUrl);
      }
    }
    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch).catch(() => {});
    }
  }, [fetchedCampaign]);

  // 4. Expire active campaign automatically at endsAt and on app foreground
  useEffect(() => {
    if (!activeCampaign) return;

    const checkExpiry = () => {
      if (!isWithinCampaignWindow(activeCampaign.startsAt, activeCampaign.endsAt)) {
        setActiveCampaign(null);
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      }
    };

    const endMs = new Date(activeCampaign.endsAt).getTime();
    const delayMs = endMs - Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (delayMs <= 0) {
      checkExpiry();
    } else if (delayMs <= MAX_TIMEOUT_MS) {
      timer = setTimeout(checkExpiry, delayMs + 50);
    }

    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        checkExpiry();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [activeCampaign]);

  const colors = useMemo(() => activeCampaign?.home.colors ?? null, [activeCampaign]);
  const images = useMemo(() => activeCampaign?.home.images ?? null, [activeCampaign]);
  const sections = useMemo(
    () => activeCampaign?.home.sections ?? EMPTY_SECTIONS,
    [activeCampaign]
  );

  return (
    <ThemeCampaignContext.Provider value={activeCampaign}>
      <ThemeColorsContext.Provider value={colors}>
        <ThemeImagesContext.Provider value={images}>
          <ThemeSectionsContext.Provider value={sections}>
            {children}
          </ThemeSectionsContext.Provider>
        </ThemeImagesContext.Provider>
      </ThemeColorsContext.Provider>
    </ThemeCampaignContext.Provider>
  );
}

export function useThemeCampaign(): ThemeCampaign | null {
  return useContext(ThemeCampaignContext);
}

export function useThemeColors(): ThemeHomeColors | null {
  return useContext(ThemeColorsContext);
}

export function useThemeImages(): ThemeCampaignImages | null {
  return useContext(ThemeImagesContext);
}

export function useThemeSections(): ThemeHomeSection[] {
  return useContext(ThemeSectionsContext);
}
