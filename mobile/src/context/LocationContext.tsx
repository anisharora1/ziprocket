import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocationApi from 'expo-location';
import { apiClient, isNetworkError } from '../services/api';
import { getHighAccuracyGPSFix } from '../utils/geolocation';
import { getIsOnline, onReconnect } from '../services/network';
import { useAuth } from './AuthContext';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export type Location = LocationCoords;

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
  address: string | null;
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
  isFirstTime: boolean;
  isLocationLoaded: boolean;
  isPickerOpen: boolean;
  fetchLocation: () => Promise<void>;
  dismissPrompt: () => Promise<void>;
  setSelectedAddress: (addr: SavedAddress | null) => Promise<void>;
  saveAndSelectAddress: (addrPayload: any) => Promise<boolean>;
  loadSavedAddresses: () => Promise<void>;
  setCustomLocation: (
    coords: LocationCoords,
    fullAddress: string,
    pincode: string | null,
    city: string | null,
    state: string | null,
    country: string | null
  ) => Promise<void>;
  resolveOperationalZone: (lat: number, lng: number, pin: string | null) => Promise<void>;
  openPicker: () => void;
  closePicker: () => void;
  setManualAddress?: (addr: string, zone?: string) => Promise<void>;
}

export interface LocationState {
  location: LocationCoords | null;
  address: string | null;
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
  isFirstTime: boolean;
  isLocationLoaded: boolean;
  isPickerOpen: boolean;
}

type LocationAction =
  | { type: 'SET_BATCH'; payload: Partial<LocationState> }
  | { type: 'SET_ZONE'; payload: { zoneId: string | null; zoneName: string | null; error: string | null } }
  | { type: 'SET_SAVED_ADDRESSES'; payload: SavedAddress[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOCATION_LOADED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FIRST_TIME'; payload: boolean }
  | { type: 'SET_PICKER_OPEN'; payload: boolean }
  | { type: 'CLEAR_LOCATION' }
  | { type: 'CLEAR_AUTH_ADDRESSES' };

const STORAGE_LOCATION_KEY = 'ziprocket_location';
const STORAGE_PROMPTED_KEY = 'ziprocket_location_prompted';

const initialState: LocationState = {
  location: null,
  address: null,
  pincode: null,
  city: null,
  state: null,
  country: null,
  zoneId: null,
  zoneName: null,
  savedAddresses: [],
  selectedAddressId: null,
  deliveryAddress: null,
  isLoading: false,
  error: null,
  isFirstTime: false,
  isLocationLoaded: false,
  isPickerOpen: false,
};

function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'SET_BATCH':
      return { ...state, ...action.payload };
    case 'SET_ZONE':
      return {
        ...state,
        zoneId: action.payload.zoneId,
        zoneName: action.payload.zoneName,
        error: action.payload.error,
      };
    case 'SET_SAVED_ADDRESSES':
      return { ...state, savedAddresses: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOCATION_LOADED':
      return { ...state, isLocationLoaded: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_FIRST_TIME':
      return { ...state, isFirstTime: action.payload };
    case 'SET_PICKER_OPEN':
      return { ...state, isPickerOpen: action.payload };
    case 'CLEAR_AUTH_ADDRESSES':
      return {
        ...state,
        savedAddresses: [],
        selectedAddressId: null,
      };
    case 'CLEAR_LOCATION':
      return {
        ...initialState,
        savedAddresses: state.savedAddresses,
        isLocationLoaded: state.isLocationLoaded,
      };
    default:
      return state;
  }
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(locationReducer, initialState);
  const { token } = useAuth();
  const prevTokenRef = useRef<string | null>(token);

  // 1. Resolve active delivery zone based on coordinates & pincode
  const resolveOperationalZone = useCallback(
    async (lat: number, lng: number, pin: string | null) => {
      try {
        const res = await apiClient.post('/delivery-zones/check-feasibility', {
          userLat: lat,
          userLng: lng,
          pincode: pin || '',
        });
        if (res.data?.success && res.data?.isDeliverable) {
          dispatch({
            type: 'SET_ZONE',
            payload: {
              zoneId: res.data.zoneId,
              zoneName: res.data.zoneName,
              error: null,
            },
          });
        } else {
          dispatch({
            type: 'SET_ZONE',
            payload: {
              zoneId: null,
              zoneName: null,
              error: res.data?.message || 'Outside active operating radius',
            },
          });
        }
      } catch (err: any) {
        dispatch({
          type: 'SET_ZONE',
          payload: {
            zoneId: null,
            zoneName: null,
            error: err.response?.data?.message || 'Outside active operating radius',
          },
        });
      }
    },
    []
  );

  // Dismiss first-launch prompt
  const dismissPrompt = useCallback(async () => {
    dispatch({ type: 'SET_FIRST_TIME', payload: false });
    try {
      await AsyncStorage.setItem(STORAGE_PROMPTED_KEY, 'true');
    } catch (e) {
      // Ignored
    }
  }, []);

  // 2. Load saved addresses of authenticated user
  const loadSavedAddresses = useCallback(async () => {
    try {
      const res = await apiClient.get('/addresses');
      if (res.data?.success) {
        const list: SavedAddress[] = res.data.addresses || [];
        dispatch({ type: 'SET_SAVED_ADDRESSES', payload: list });

        // Auto-select default address if no coordinates are active in session
        const defaultAddr = list.find((a: SavedAddress) => a.isDefault);
        const storedLoc = await AsyncStorage.getItem(STORAGE_LOCATION_KEY);
        if (defaultAddr && !storedLoc) {
          await setSelectedAddress(defaultAddr);
        }
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        console.error('Failed to load saved addresses:', err);
      }
    }
  }, []);

  // 3. Set address based on user action
  const setSelectedAddress = useCallback(
    async (addr: SavedAddress | null) => {
      if (!addr) {
        dispatch({ type: 'CLEAR_LOCATION' });
        await AsyncStorage.removeItem(STORAGE_LOCATION_KEY);
        return;
      }

      const newLoc = {
        coords: addr.location,
        location: addr.location,
        address: addr.fullAddress,
        pincode: addr.pincode,
        city: addr.city,
        state: addr.state,
        country: addr.country || null,
        zoneId: addr.deliveryZone || null,
        zoneName: 'ZipRocket Active Zone',
        selectedAddressId: addr._id,
        deliveryAddress: addr.deliveryAddress || null,
      };

      dispatch({
        type: 'SET_BATCH',
        payload: {
          location: addr.location,
          address: addr.fullAddress,
          pincode: addr.pincode,
          city: addr.city,
          state: addr.state,
          country: addr.country || null,
          selectedAddressId: addr._id,
          deliveryAddress: addr.deliveryAddress || null,
        },
      });

      if (addr.deliveryZone) {
        dispatch({
          type: 'SET_ZONE',
          payload: {
            zoneId: addr.deliveryZone,
            zoneName: 'ZipRocket Active Zone',
            error: null,
          },
        });
      } else {
        await resolveOperationalZone(addr.location.lat, addr.location.lng, addr.pincode);
      }

      await AsyncStorage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(newLoc));
      await dismissPrompt();
    },
    [resolveOperationalZone, dismissPrompt]
  );

  // 4. Save and select address immediately
  const saveAndSelectAddress = useCallback(
    async (addrPayload: any): Promise<boolean> => {
      if (!getIsOnline()) {
        Alert.alert('Offline', "You're offline. Connect to the internet to save addresses.");
        return false;
      }
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const res = await apiClient.post('/addresses', addrPayload);
        if (res.data?.success && res.data?.address) {
          await loadSavedAddresses();
          await setSelectedAddress(res.data.address);
          return true;
        }
        return false;
      } catch (err: any) {
        if (isNetworkError(err)) {
          Alert.alert('Offline', "You're offline. Connect to the internet to save addresses.");
        } else {
          console.error('Failed to save and select address:', err);
        }
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [loadSavedAddresses, setSelectedAddress]
  );

  // 5. Automatic GPS Location Autodetect using reverse-geocode & feasibility
  const fetchLocation = useCallback(async () => {
    dispatch({ type: 'SET_BATCH', payload: { isLoading: true, error: null } });

    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 6000,
        accuracyThresholdMeters: 150,
      });

      const latitude = fix.coords.latitude;
      const longitude = fix.coords.longitude;
      const newCoords = { lat: latitude, lng: longitude };

      // Un-block location loaded state as soon as coordinates are acquired
      dispatch({
        type: 'SET_BATCH',
        payload: { location: newCoords, isLocationLoaded: true },
      });

      // 1. Await reverse-geocode call FIRST to resolve address & pincode
      let fullAddress = 'Address unavailable';
      let pin: string | null = null;
      let c: string | null = null;
      let s: string | null = null;
      let co: string | null = null;

      try {
        const response = await apiClient.get(
          `/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`
        );
        if (response.data?.success && response.data?.details) {
          const details = response.data.details;
          fullAddress = details.fullAddress || 'Address unavailable';
          pin = details.pincode || null;
          c = details.city || null;
          s = details.state || null;
          co = details.country || null;

          dispatch({
            type: 'SET_BATCH',
            payload: {
              address: fullAddress,
              pincode: pin,
              city: c,
              state: s,
              country: co,
              selectedAddressId: null,
              deliveryAddress: null,
            },
          });
        } else {
          dispatch({ type: 'SET_BATCH', payload: { address: 'Address unavailable' } });
        }
      } catch (geoErr) {
        if (!isNetworkError(geoErr)) {
          console.error('Reverse geocode failed:', geoErr);
        }
        dispatch({ type: 'SET_BATCH', payload: { address: 'Address unavailable' } });
      }

      // 2. Fire zone feasibility check using the resolved real pincode
      let zId: string | null = null;
      let zName: string | null = null;

      try {
        const zoneRes = await apiClient.post('/delivery-zones/check-feasibility', {
          userLat: latitude,
          userLng: longitude,
          pincode: pin || '',
        });

        if (zoneRes.data?.success && zoneRes.data?.isDeliverable) {
          zId = zoneRes.data.zoneId;
          zName = zoneRes.data.zoneName;
          dispatch({
            type: 'SET_ZONE',
            payload: { zoneId: zId, zoneName: zName, error: null },
          });
        } else {
          dispatch({
            type: 'SET_ZONE',
            payload: {
              zoneId: null,
              zoneName: null,
              error:
                zoneRes.data?.message || 'Sorry, you are currently outside our delivery service area.',
            },
          });
        }
      } catch (zErr: any) {
        if (!isNetworkError(zErr)) {
          console.error('Zone feasibility check failed:', zErr);
        }
        dispatch({
          type: 'SET_ZONE',
          payload: {
            zoneId: null,
            zoneName: null,
            error: 'Sorry, you are currently outside our delivery service area.',
          },
        });
      }

      await AsyncStorage.setItem(
        STORAGE_LOCATION_KEY,
        JSON.stringify({
          coords: newCoords,
          location: newCoords,
          address: fullAddress,
          pincode: pin,
          city: c,
          state: s,
          country: co,
          zoneId: zId,
          zoneName: zName,
          selectedAddressId: null,
          deliveryAddress: null,
        })
      );

      await dismissPrompt();
    } catch (err: any) {
      console.error('Geocoding failed:', err);
      dispatch({
        type: 'SET_BATCH',
        payload: {
          error: err.message || 'Failed to resolve your coordinates address',
          address: 'Address unavailable',
          isFirstTime: true,
        },
      });
      await dismissPrompt();
    } finally {
      dispatch({ type: 'SET_BATCH', payload: { isLoading: false, isLocationLoaded: true } });
    }
  }, [dismissPrompt]);

  // 6. Manual Location Setter (resolves geocoded places)
  const setCustomLocation = useCallback(
    async (
      coords: LocationCoords,
      fullAddress: string,
      pin: string | null,
      c: string | null,
      s: string | null,
      co: string | null
    ) => {
      dispatch({
        type: 'SET_BATCH',
        payload: {
          location: coords,
          address: fullAddress,
          pincode: pin,
          city: c,
          state: s,
          country: co,
          selectedAddressId: null,
          deliveryAddress: null,
        },
      });

      let zId: string | null = null;
      let zName: string | null = null;
      try {
        const zoneRes = await apiClient.post('/delivery-zones/check-feasibility', {
          userLat: coords.lat,
          userLng: coords.lng,
          pincode: pin || '',
        });
        if (zoneRes.data?.success && zoneRes.data?.isDeliverable) {
          zId = zoneRes.data.zoneId;
          zName = zoneRes.data.zoneName;
          dispatch({
            type: 'SET_ZONE',
            payload: { zoneId: zId, zoneName: zName, error: null },
          });
        } else {
          dispatch({
            type: 'SET_ZONE',
            payload: {
              zoneId: null,
              zoneName: null,
              error:
                zoneRes.data?.message || 'Sorry, you are currently outside our delivery service area.',
            },
          });
        }
      } catch (zErr: any) {
        dispatch({
          type: 'SET_ZONE',
          payload: {
            zoneId: null,
            zoneName: null,
            error: 'Sorry, you are currently outside our delivery service area.',
          },
        });
      }

      await AsyncStorage.setItem(
        STORAGE_LOCATION_KEY,
        JSON.stringify({
          coords,
          location: coords,
          address: fullAddress,
          pincode: pin,
          city: c,
          state: s,
          country: co,
          zoneId: zId,
          zoneName: zName,
          selectedAddressId: null,
          deliveryAddress: null,
        })
      );
      await dismissPrompt();
    },
    [dismissPrompt]
  );

  // Backward-compatible setManualAddress
  const setManualAddress = useCallback(
    async (newAddr: string, newZone?: string) => {
      const coords = state.location || { lat: 26.443352, lng: 85.902705 };
      await setCustomLocation(coords, newAddr, state.pincode, state.city, state.state, state.country);
    },
    [state.location, state.pincode, state.city, state.state, state.country, setCustomLocation]
  );

  // 7. Startup Order (initializeLocation) EXACTLY as web:
  // (a) if stored location exists, restore it (and re-resolve zone if zoneId is missing);
  // (b) else if token exists, load saved addresses and auto-select default one;
  // (c) else (no stored location and no default address):
  //     fetch GPS automatically ONLY ONCE on first launch if location permission is already granted;
  //     otherwise set isFirstTime = true so first-launch prompt modal appears (iOS rule: iOS never auto-fetches without user gesture).
  // Then isLocationLoaded = true.
  useEffect(() => {
    const initializeLocation = async () => {
      let validStoredLocation = false;

      try {
        const storedLocation = await AsyncStorage.getItem(STORAGE_LOCATION_KEY);
        if (storedLocation) {
          const parsed = JSON.parse(storedLocation);
          const coords = parsed.coords || parsed.location;
          if (parsed && coords) {
            dispatch({
              type: 'SET_BATCH',
              payload: {
                location: coords,
                address: parsed.address || null,
                pincode: parsed.pincode || null,
                city: parsed.city || null,
                state: parsed.state || null,
                country: parsed.country || null,
                zoneId: parsed.zoneId || null,
                zoneName: parsed.zoneName || null,
                selectedAddressId: parsed.selectedAddressId || null,
                deliveryAddress: parsed.deliveryAddress || null,
              },
            });
            validStoredLocation = true;

            // Proactively re-verify zone calculations only if zoneId was not already resolved
            if (coords && !parsed.zoneId) {
              await resolveOperationalZone(coords.lat, coords.lng, parsed.pincode || null);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse stored location');
      }

      // Check if token exists to fetch saved address book ONLY IF no valid cached location
      let defaultAddressSelected = false;
      if (token && !validStoredLocation) {
        try {
          const res = await apiClient.get('/addresses');
          if (res.data?.success) {
            const list = res.data.addresses || [];
            dispatch({ type: 'SET_SAVED_ADDRESSES', payload: list });

            const defaultAddr = list.find((a: SavedAddress) => a.isDefault);
            if (defaultAddr) {
              await setSelectedAddress(defaultAddr);
              defaultAddressSelected = true;
            }
          }
        } catch (err) {
          if (!isNetworkError(err)) {
            console.error('Failed to load saved addresses:', err);
          }
        }
      }

      // If no stored location and no default address was selected:
      if (!validStoredLocation && !defaultAddressSelected) {
        try {
          const prompted = await AsyncStorage.getItem(STORAGE_PROMPTED_KEY);
          if (Platform.OS === 'ios') {
            // iOS never auto-fetches without user gesture
            if (!prompted) {
              dispatch({ type: 'SET_FIRST_TIME', payload: true });
            }
            dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
          } else {
            // Android: check if permission already granted
            const perm = await LocationApi.getForegroundPermissionsAsync();
            if (perm.status === LocationApi.PermissionStatus.GRANTED) {
              await fetchLocation();
            } else {
              if (!prompted) {
                dispatch({ type: 'SET_FIRST_TIME', payload: true });
              }
              dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
            }
          }
        } catch (err) {
          dispatch({ type: 'SET_FIRST_TIME', payload: true });
          dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
        }
      } else {
        dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
      }
    };

    initializeLocation();
  }, []);

  // Watch for auth changes:
  // On logout: preserve device-level location, clear savedAddresses & selectedAddressId
  // On login: reload saved addresses
  useEffect(() => {
    if (prevTokenRef.current && !token) {
      dispatch({ type: 'CLEAR_AUTH_ADDRESSES' });
    } else if (!prevTokenRef.current && token) {
      loadSavedAddresses();
    }
    prevTokenRef.current = token;
  }, [token, loadSavedAddresses]);

  // Reload saved addresses on reconnect
  useEffect(() => {
    const unsub = onReconnect(() => {
      if (token) {
        loadSavedAddresses();
      }
    });
    return unsub;
  }, [token, loadSavedAddresses]);

  const openPicker = useCallback(() => {
    dispatch({ type: 'SET_PICKER_OPEN', payload: true });
  }, []);

  const closePicker = useCallback(() => {
    dispatch({ type: 'SET_PICKER_OPEN', payload: false });
  }, []);

  const contextValue = useMemo(
    () => ({
      location: state.location,
      coords: state.location, // Backward-compatible alias
      address: state.address,
      pincode: state.pincode,
      city: state.city,
      state: state.state,
      country: state.country,
      zoneId: state.zoneId,
      zoneName: state.zoneName,
      savedAddresses: state.savedAddresses,
      selectedAddressId: state.selectedAddressId,
      deliveryAddress: state.deliveryAddress,
      isLoading: state.isLoading,
      error: state.error,
      isFirstTime: state.isFirstTime,
      isLocationLoaded: state.isLocationLoaded,
      isPickerOpen: state.isPickerOpen,
      fetchLocation,
      dismissPrompt,
      setSelectedAddress,
      saveAndSelectAddress,
      loadSavedAddresses,
      setCustomLocation,
      resolveOperationalZone,
      openPicker,
      closePicker,
      setManualAddress,
    }),
    [
      state,
      fetchLocation,
      dismissPrompt,
      setSelectedAddress,
      saveAndSelectAddress,
      loadSavedAddresses,
      setCustomLocation,
      resolveOperationalZone,
      openPicker,
      closePicker,
      setManualAddress,
    ]
  );

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>;
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
