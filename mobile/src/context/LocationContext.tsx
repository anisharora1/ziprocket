import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/api';

interface Coords {
  lat: number;
  lng: number;
}

interface LocationContextType {
  address: string;
  coords: Coords | null;
  zoneId: string | null;
  isLoading: boolean;
  fetchLocation: () => Promise<void>;
  setManualAddress: (addr: string, zone?: string) => Promise<void>;
}

const STORAGE_LOCATION_KEY = 'ziprocket_location';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Default fallback location for Benipatti (ZipRocket pilot town)
const DEFAULT_COORDS: Coords = { lat: 26.443352, lng: 85.902705 };
const DEFAULT_ADDRESS = 'Benipatti, Bihar';

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [address, setAddress] = useState<string>(DEFAULT_ADDRESS);
  const [coords, setCoords] = useState<Coords | null>(DEFAULT_COORDS);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load cached location on mount
  useEffect(() => {
    const loadCachedLocation = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_LOCATION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.address) setAddress(parsed.address);
          if (parsed.coords) setCoords(parsed.coords);
          if (parsed.zoneId) setZoneId(parsed.zoneId);
        }
      } catch (e) {
        // Fallback to default
      }
    };

    loadCachedLocation();
  }, []);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setCoords(newCoords);

      // Attempt reverse geocoding via backend or Expo
      try {
        const res = await apiClient.get(
          `/locations/reverse?lat=${newCoords.lat}&lng=${newCoords.lng}`
        );
        if (res.data?.success && res.data?.address) {
          const fetchedAddr = res.data.address;
          setAddress(fetchedAddr);
          const zId = res.data.zoneId || null;
          setZoneId(zId);
          await AsyncStorage.setItem(
            STORAGE_LOCATION_KEY,
            JSON.stringify({ address: fetchedAddr, coords: newCoords, zoneId: zId })
          );
          return;
        }
      } catch (err) {
        // Expo native reverse geocoding fallback
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: newCoords.lat,
          longitude: newCoords.lng,
        });

        if (geo) {
          const formatted = [geo.name, geo.district || geo.city, geo.region]
            .filter(Boolean)
            .join(', ');
          setAddress(formatted || DEFAULT_ADDRESS);
          await AsyncStorage.setItem(
            STORAGE_LOCATION_KEY,
            JSON.stringify({ address: formatted, coords: newCoords, zoneId: null })
          );
        }
      }
    } catch (e) {
      console.warn('[Location] Failed fetching GPS:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setManualAddress = useCallback(async (newAddr: string, newZone?: string) => {
    setAddress(newAddr);
    if (newZone) setZoneId(newZone);
    await AsyncStorage.setItem(
      STORAGE_LOCATION_KEY,
      JSON.stringify({ address: newAddr, coords, zoneId: newZone || zoneId })
    );
  }, [coords, zoneId]);

  return (
    <LocationContext.Provider
      value={{
        address,
        coords,
        zoneId,
        isLoading,
        fetchLocation,
        setManualAddress,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
