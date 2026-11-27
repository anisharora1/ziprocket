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
  ThemeGroceryCampaign,
  ThemeGroceryColors,
  ThemeHomeColors,
  ThemeHomeSection,
  ThemeOverlay,
  isWithinCampaignWindow,
  validateGroceryThemeCampaign,
  validateThemeCampaign,
} from '../utils/themeCampaign';

const HOME_STORAGE_KEY = 'TC_ACTIVE_V1';
const GROCERY_STORAGE_KEY = 'TC_GROCERY_V1';
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647;

const EMPTY_SECTIONS: ThemeHomeSection[] = [];

const ThemeCampaignContext = createContext<ThemeCampaign | null>(null);
const ThemeColorsContext = createContext<ThemeHomeColors | null>(null);
const ThemeImagesContext = createContext<ThemeCampaignImages | null>(null);
const ThemeSectionsContext = createContext<ThemeHomeSection[]>(EMPTY_SECTIONS);
const ThemeOverlayContext = createContext<ThemeOverlay | null>(null);

const GroceryThemeCampaignContext = createContext<ThemeGroceryCampaign | null>(null);
const GroceryThemeColorsContext = createContext<ThemeGroceryColors | null>(null);
const GroceryThemeImagesContext = createContext<ThemeCampaignImages | null>(null);
const GroceryThemeSectionsContext = createContext<ThemeHomeSection[]>(EMPTY_SECTIONS);
const GroceryThemeOverlayContext = createContext<ThemeOverlay | null>(null);

function useCampaignSurface<TCampaign extends { startsAt: string; endsAt: string }>(
  surface: 'home' | 'grocery',
  storageKey: string,
  zoneId: string | null,
  validator: (raw: unknown) => TCampaign | null,
  getImages: (campaign: TCampaign) => ThemeCampaignImages
): TCampaign | null {
  const [activeCampaign, setActiveCampaign] = useState<TCampaign | null>(null);

  // 1. Hydrate last good campaign from disk off the first-render path
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          const validated = validator(parsed);
          if (validated) {
            setActiveCampaign(validated);
          } else {
            AsyncStorage.removeItem(storageKey).catch(() => {});
          }
        } catch {
          AsyncStorage.removeItem(storageKey).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [storageKey, validator]);

  // 2. Background fetch via existing QueryClient (never blocks rendering)
  const { data: fetchedCampaign } = useQuery<TCampaign | null>({
    queryKey: ['theme-campaign', surface, zoneId || 'all'],
    queryFn: async () => {
      const res = await apiClient.get('/app-config/mobile', {
        params: zoneId ? { surface, zoneId } : { surface },
      });
      const rawCampaign = res.data?.campaign ?? null;
      return validator(rawCampaign);
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
      AsyncStorage.removeItem(storageKey).catch(() => {});
      return;
    }

    setActiveCampaign(fetchedCampaign);
    AsyncStorage.setItem(storageKey, JSON.stringify(fetchedCampaign)).catch(() => {});

    const imgs = getImages(fetchedCampaign);
    const urlsToPrefetch: string[] = [];
    if (imgs.garland) {
      urlsToPrefetch.push(imgs.garland);
    }
    for (const heroItem of imgs.hero) {
      if (heroItem.imageUrl) {
        urlsToPrefetch.push(heroItem.imageUrl);
      }
    }
    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch).catch(() => {});
    }
  }, [fetchedCampaign, storageKey, getImages]);

  // 4. Expire active campaign automatically at endsAt and on app foreground
  useEffect(() => {
    if (!activeCampaign) return;

    const checkExpiry = () => {
      if (!isWithinCampaignWindow(activeCampaign.startsAt, activeCampaign.endsAt)) {
        setActiveCampaign(null);
        AsyncStorage.removeItem(storageKey).catch(() => {});
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
  }, [activeCampaign, storageKey]);

  return activeCampaign;
}

const getHomeImages = (c: ThemeCampaign) => c.home.images;
const getGroceryImages = (c: ThemeGroceryCampaign) => c.grocery.images;

export function ThemeCampaignProvider({ children }: { children: React.ReactNode }) {
  const { zoneId } = useLocation();

  const homeCampaign = useCampaignSurface(
    'home',
    HOME_STORAGE_KEY,
    zoneId,
    validateThemeCampaign,
    getHomeImages
  );

  const groceryCampaign = useCampaignSurface(
    'grocery',
    GROCERY_STORAGE_KEY,
    zoneId,
    validateGroceryThemeCampaign,
    getGroceryImages
  );

  const homeColors = useMemo(() => homeCampaign?.home.colors ?? null, [homeCampaign]);
  const homeImages = useMemo(() => homeCampaign?.home.images ?? null, [homeCampaign]);
  const homeSections = useMemo(
    () => homeCampaign?.home.sections ?? EMPTY_SECTIONS,
    [homeCampaign]
  );
  const homeOverlay = useMemo(() => homeCampaign?.overlay ?? null, [homeCampaign]);

  const groceryColors = useMemo(() => groceryCampaign?.grocery.colors ?? null, [groceryCampaign]);
  const groceryImages = useMemo(() => groceryCampaign?.grocery.images ?? null, [groceryCampaign]);
  const grocerySections = useMemo(
    () => groceryCampaign?.grocery.sections ?? EMPTY_SECTIONS,
    [groceryCampaign]
  );
  const groceryOverlay = useMemo(() => groceryCampaign?.overlay ?? null, [groceryCampaign]);

  return (
    <ThemeCampaignContext.Provider value={homeCampaign}>
      <ThemeColorsContext.Provider value={homeColors}>
        <ThemeImagesContext.Provider value={homeImages}>
          <ThemeSectionsContext.Provider value={homeSections}>
            <ThemeOverlayContext.Provider value={homeOverlay}>
              <GroceryThemeCampaignContext.Provider value={groceryCampaign}>
                <GroceryThemeColorsContext.Provider value={groceryColors}>
                  <GroceryThemeImagesContext.Provider value={groceryImages}>
                    <GroceryThemeSectionsContext.Provider value={grocerySections}>
                      <GroceryThemeOverlayContext.Provider value={groceryOverlay}>
                        {children}
                      </GroceryThemeOverlayContext.Provider>
                    </GroceryThemeSectionsContext.Provider>
                  </GroceryThemeImagesContext.Provider>
                </GroceryThemeColorsContext.Provider>
              </GroceryThemeCampaignContext.Provider>
            </ThemeOverlayContext.Provider>
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

export function useThemeOverlay(): ThemeOverlay | null {
  return useContext(ThemeOverlayContext);
}

export function useGroceryThemeCampaign(): ThemeGroceryCampaign | null {
  return useContext(GroceryThemeCampaignContext);
}

export function useGroceryThemeColors(): ThemeGroceryColors | null {
  return useContext(GroceryThemeColorsContext);
}

export function useGroceryThemeImages(): ThemeCampaignImages | null {
  return useContext(GroceryThemeImagesContext);
}

export function useGroceryThemeSections(): ThemeHomeSection[] {
  return useContext(GroceryThemeSectionsContext);
}

export function useGroceryThemeOverlay(): ThemeOverlay | null {
  return useContext(GroceryThemeOverlayContext);
}
