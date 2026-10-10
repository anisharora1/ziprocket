import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/api';
import { getHighAccuracyGPSFix } from '../utils/geolocation';
import { useAuth } from './AuthContext';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface SavedAddress {
  _id: string;
  label: 'Home' | 'Work' | 'Other' | string;
  fullAddress: string;
  pincode: string;
  city: string;
  state: string;
  country?: string;
  location: LocationCoords;
  locationSource?: 'gps' | 'manual';
  deliveryZone?: string;
  isDefault: boolean;
  deliveryAddress?: {
    houseNumber: string;
    street?: string;
    locality: string;
    village: string;
    landmark: string;
    pincode?: string;
    instructions?: string;
  };
}

export interface LocationContextType {
  location: LocationCoords | null;
  coords: LocationCoords | null; // Backward-compatible alias
  address: string;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zoneId: string | null;
  zoneName: string | null;
  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;
  deliveryAddress: SavedAddress['deliveryAddress'] | null;
  isLoading: boolean;
  error: string | null;
  fetchLocation: () => Promise<void>;
  setSelectedAddress: (addr: SavedAddress | null) => Promise<void>;
  saveAndSelectAddress: (addrPayload: any) => Promise<boolean>;
  loadSavedAddresses: () => Promise<void>;
  setManualAddress: (addr: string, zone?: string) => Promise<void>;
}

const STORAGE_LOCATION_KEY = 'ziprocket_location';

const DEFAULT_COORDS: LocationCoords = { lat: 26.443352, lng: 85.902705 };
const DEFAULT_ADDRESS = 'Benipatti, Bihar';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [location, setLocation] = useState<LocationCoords | null>(DEFAULT_COORDS);
  const [address, setAddress] = useState<string>(DEFAULT_ADDRESS);
  const [pincode, setPincode] = useState<string | null>('847223');
  const [city, setCity] = useState<string | null>('Benipatti');
  const [stateName, setStateName] = useState<string | null>('Bihar');
  const [country, setCountry] = useState<string | null>('India');
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress['deliveryAddress'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved addresses of authenticated user
  const loadSavedAddresses = useCallback(async () => {
    try {
      const res = await apiClient.get('/addresses');
      if (res.data?.success) {
        const list: SavedAddress[] = res.data.addresses || [];
        setSavedAddresses(list);

        // Auto-select default if none selected
        const defaultAddr = list.find((a) => a.isDefault);
        if (defaultAddr && !selectedAddressId) {
          setSelectedAddress(defaultAddr);
        }
      }
    } catch (err) {
      // Ignored for guest or network failure
    }
  }, [selectedAddressId]);

  useEffect(() => {
    if (token) {
      loadSavedAddresses();
    }
  }, [token, loadSavedAddresses]);

  // Load cached location from storage on mount
  useEffect(() => {
    const loadCachedLocation = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_LOCATION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.coords || parsed.location) {
            const loc = parsed.coords || parsed.location;
            setLocation(loc);
          }
          if (parsed.address) setAddress(parsed.address);
          if (parsed.pincode) setPincode(parsed.pincode);
          if (parsed.city) setCity(parsed.city);
          if (parsed.state) setStateName(parsed.state);
          if (parsed.zoneId) setZoneId(parsed.zoneId);
          if (parsed.zoneName) setZoneName(parsed.zoneName);
          if (parsed.selectedAddressId) setSelectedAddressId(parsed.selectedAddressId);
          if (parsed.deliveryAddress) setDeliveryAddress(parsed.deliveryAddress);
        }
      } catch (e) {
        // Fallback to default
      }
    };

    loadCachedLocation();
  }, []);

  const setSelectedAddress = useCallback(async (addr: SavedAddress | null) => {
    if (!addr) {
      setSelectedAddressId(null);
      setDeliveryAddress(null);
      return;
    }

    setLocation(addr.location);
    setAddress(addr.fullAddress);
    setPincode(addr.pincode);
    setCity(addr.city);
    setStateName(addr.state);
    setZoneId(addr.deliveryZone || null);
    setSelectedAddressId(addr._id);
    setDeliveryAddress(addr.deliveryAddress || null);

    await AsyncStorage.setItem(
      STORAGE_LOCATION_KEY,
      JSON.stringify({
        coords: addr.location,
        location: addr.location,
        address: addr.fullAddress,
        pincode: addr.pincode,
        city: addr.city,
        state: addr.state,
        zoneId: addr.deliveryZone || null,
        selectedAddressId: addr._id,
        deliveryAddress: addr.deliveryAddress || null,
      })
    );
  }, []);

  const saveAndSelectAddress = useCallback(
    async (addrPayload: any): Promise<boolean> => {
      try {
        setIsLoading(true);
        const res = await apiClient.post('/addresses', addrPayload);
        if (res.data?.success) {
          await loadSavedAddresses();
          if (res.data.address) {
            await setSelectedAddress(res.data.address);
          }
          return true;
        }
        return false;
      } catch (err: any) {
        console.warn('Failed to save address:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadSavedAddresses, setSelectedAddress]
  );

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 6000,
        accuracyThresholdMeters: 150,
      });

      const newCoords = {
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
      };
      setLocation(newCoords);

      // Attempt reverse geocoding via backend API wrapper
      try {
        const res = await apiClient.get(
          `/locations/reverse-geocode?lat=${newCoords.lat}&lng=${newCoords.lng}`
        );
        if (res.data?.success && res.data?.details) {
          const details = res.data.details;
          const fullAddr = details.fullAddress || DEFAULT_ADDRESS;
          setAddress(fullAddr);
          if (details.pincode) setPincode(details.pincode);
          if (details.city) setCity(details.city);
          if (details.state) setStateName(details.state);
          if (details.country) setCountry(details.country);

          // Check zone feasibility
          try {
            const zoneRes = await apiClient.post('/delivery-zones/check-feasibility', {
              userLat: newCoords.lat,
              userLng: newCoords.lng,
              pincode: details.pincode || '',
            });
            if (zoneRes.data?.success && zoneRes.data?.isDeliverable) {
              setZoneId(zoneRes.data.zoneId || null);
              setZoneName(zoneRes.data.zoneName || null);
            }
          } catch {
            // Zone check fallback
          }

          await AsyncStorage.setItem(
            STORAGE_LOCATION_KEY,
            JSON.stringify({
              coords: newCoords,
              location: newCoords,
              address: fullAddr,
              pincode: details.pincode || null,
              city: details.city || null,
              state: details.state || null,
            })
          );
          return;
        }
      } catch (err) {
        console.warn('Reverse geocode failed:', err);
      }
    } catch (e: any) {
      console.warn('[Location] GPS fetch failed:', e);
      setError(e.message || 'GPS location nahi mil saka.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setManualAddress = useCallback(
    async (newAddr: string, newZone?: string) => {
      setAddress(newAddr);
      if (newZone) setZoneId(newZone);
      await AsyncStorage.setItem(
        STORAGE_LOCATION_KEY,
        JSON.stringify({
          address: newAddr,
          coords: location,
          location,
          zoneId: newZone || zoneId,
        })
      );
    },
    [location, zoneId]
  );

  const contextValue = useMemo(
    () => ({
      location,
      coords: location,
      address,
      pincode,
      city,
      state: stateName,
      country,
      zoneId,
      zoneName,
      savedAddresses,
      selectedAddressId,
      deliveryAddress,
      isLoading,
      error,
      fetchLocation,
      setSelectedAddress,
      saveAndSelectAddress,
      loadSavedAddresses,
      setManualAddress,
    }),
    [
      location,
      address,
      pincode,
      city,
      stateName,
      country,
      zoneId,
      zoneName,
      savedAddresses,
      selectedAddressId,
      deliveryAddress,
      isLoading,
      error,
      fetchLocation,
      setSelectedAddress,
      saveAndSelectAddress,
      loadSavedAddresses,
      setManualAddress,
    ]
  );

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>;
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
