'use client';
import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/services/api';
import { getHighAccuracyGPSFix } from '@/utils/geolocation';
import { isIOSSafari, isInAppBrowser } from '@/utils/inAppBrowser';

interface Location {
  lat: number;
  lng: number;
}

interface SavedAddress {
  _id: string;
  label: "Home" | "Work" | "Other";
  fullAddress: string;
  pincode: string;
  city: string;
  state: string;
  country?: string;
  location: Location;
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

interface LocationContextType {
  location: Location | null;
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
  fetchLocation: () => void;
  dismissPrompt: () => void;
  setSelectedAddress: (addr: SavedAddress | null) => void;
  saveAndSelectAddress: (addrPayload: any) => Promise<boolean>;
  loadSavedAddresses: () => Promise<void>;
  setCustomLocation: (
    coords: Location,
    fullAddress: string,
    pincode: string | null,
    city: string | null,
    state: string | null,
    country: string | null
  ) => Promise<void>;
}

// --- useReducer state & actions for atomic batched updates (eliminates 5-9x re-renders per location change) ---

interface LocationState {
  location: Location | null;
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
}

type LocationAction =
  | { type: 'SET_BATCH'; payload: Partial<LocationState> }
  | { type: 'SET_ZONE'; payload: { zoneId: string | null; zoneName: string | null; error: string | null } }
  | { type: 'SET_SAVED_ADDRESSES'; payload: SavedAddress[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOCATION_LOADED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FIRST_TIME'; payload: boolean }
  | { type: 'CLEAR_LOCATION' };

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
};

function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'SET_BATCH':
      return { ...state, ...action.payload };
    case 'SET_ZONE':
      return { ...state, zoneId: action.payload.zoneId, zoneName: action.payload.zoneName, error: action.payload.error };
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

  // 1. Load active delivery zone details based on coordinates
  const resolveOperationalZone = async (lat: number, lng: number, pin: string | null) => {
    try {
      const res = await apiClient.post("/delivery-zones/check-feasibility", {
        userLat: lat,
        userLng: lng,
        pincode: pin || ""
      });
      if (res.data.success && res.data.isDeliverable) {
        dispatch({ type: 'SET_ZONE', payload: { zoneId: res.data.zoneId, zoneName: res.data.zoneName, error: null } });
      } else {
        dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: res.data.message || "Outside active operating radius" } });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: err.response?.data?.message || "Outside active operating radius" } });
    }
  };

  // 2. Load saved addresses of authenticated user
  const loadSavedAddresses = async () => {
    try {
      const res = await apiClient.get("/addresses");
      if (res.data.success) {
        dispatch({ type: 'SET_SAVED_ADDRESSES', payload: res.data.addresses || [] });
        
        // Auto-select default address if no coordinates are active in session
        const defaultAddr = res.data.addresses.find((a: SavedAddress) => a.isDefault);
        const storedLoc = localStorage.getItem('ziprocket_location');
        if (defaultAddr && !storedLoc) {
          await setSelectedAddress(defaultAddr);
        }
      }
    } catch (err) {
      console.error("Failed to load saved addresses:", err);
    }
  };

  useEffect(() => {
    const initializeLocation = async () => {
      const storedLocation = localStorage.getItem('ziprocket_location');
      let validStoredLocation = false;

      if (storedLocation) {
        try {
          const parsed = JSON.parse(storedLocation);
          if (parsed && parsed.coords) {
            // Single atomic dispatch instead of 10+ individual setState calls
            dispatch({ type: 'SET_BATCH', payload: {
              location: parsed.coords,
              address: parsed.address,
              pincode: parsed.pincode || null,
              city: parsed.city || null,
              state: parsed.state || null,
              country: parsed.country || null,
              zoneId: parsed.zoneId || null,
              zoneName: parsed.zoneName || null,
              selectedAddressId: parsed.selectedAddressId || null,
              deliveryAddress: parsed.deliveryAddress || null,
            }});
            validStoredLocation = true;
            
            // Proactively re-verify zone calculations only if zoneId was not already resolved
            if (parsed.coords && !parsed.zoneId) {
              await resolveOperationalZone(parsed.coords.lat, parsed.coords.lng, parsed.pincode || null);
            }
          }
        } catch (e) {
          console.error("Failed to parse stored location");
        }
      }

      // Check if token exists to fetch saved address book ONLY IF no valid cached location in session
      const token = localStorage.getItem('token');
      let defaultAddressSelected = false;
      if (token && !validStoredLocation) {
        try {
          const res = await apiClient.get("/addresses");
          if (res.data.success) {
            const list = res.data.addresses || [];
            dispatch({ type: 'SET_SAVED_ADDRESSES', payload: list });
            
            // Auto-select default address if no coordinates are active in session
            const defaultAddr = list.find((a: SavedAddress) => a.isDefault);
            if (defaultAddr) {
              await setSelectedAddress(defaultAddr);
              defaultAddressSelected = true;
            }
          }
        } catch (err) {
          console.error("Failed to load saved addresses:", err);
        }
      }

      // If no stored location and no default address was selected, only auto-fetch on mount
      // for non-iOS-Safari browsers when NOT in an in-app browser.
      // On iOS Safari / in-app browsers, geolocation requires explicit user gesture.
      if (!validStoredLocation && !defaultAddressSelected) {
        const isRestricted = isIOSSafari() || isInAppBrowser();
        if (!isRestricted) {
          fetchLocation();
        } else {
          dispatch({ type: 'SET_FIRST_TIME', payload: true });
          dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
        }
      } else {
        dispatch({ type: 'SET_LOCATION_LOADED', payload: true });
      }
    };

    initializeLocation();
  }, []);

  const dismissPrompt = () => {
    dispatch({ type: 'SET_FIRST_TIME', payload: false });
    localStorage.setItem('ziprocket_location_prompted', 'true');
  };

  // 3. Set address based on user action
  const setSelectedAddress = async (addr: SavedAddress | null) => {
    if (!addr) {
      dispatch({ type: 'CLEAR_LOCATION' });
      localStorage.removeItem('ziprocket_location');
      return;
    }

    const newLoc = {
      coords: addr.location,
      address: addr.fullAddress,
      pincode: addr.pincode,
      city: addr.city,
      state: addr.state,
      country: addr.country || null,
      zoneId: addr.deliveryZone || null,
      selectedAddressId: addr._id,
      deliveryAddress: addr.deliveryAddress || null
    };

    // Single atomic dispatch instead of 10 individual setState calls
    dispatch({ type: 'SET_BATCH', payload: {
      location: addr.location,
      address: addr.fullAddress,
      pincode: addr.pincode,
      city: addr.city,
      state: addr.state,
      country: addr.country || null,
      selectedAddressId: addr._id,
      deliveryAddress: addr.deliveryAddress || null,
    }});
    
    if (addr.deliveryZone) {
      dispatch({ type: 'SET_ZONE', payload: {
        zoneId: addr.deliveryZone,
        zoneName: "ZipRocket Active Zone",
        error: null
      }});
    } else {
      // Only resolve zone if not already known from the saved address
      await resolveOperationalZone(addr.location.lat, addr.location.lng, addr.pincode);
    }

    localStorage.setItem('ziprocket_location', JSON.stringify(newLoc));
    dismissPrompt();
  };

  // 4. Save and select address immediately
  const saveAndSelectAddress = async (addrPayload: any): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const res = await apiClient.post("/addresses", addrPayload);
      if (res.data.success) {
        await loadSavedAddresses();
        setSelectedAddress(res.data.address);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Failed to save and select address:", err);
      alert(err.response?.data?.message || "Failed to save address details.");
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 5. Automatic GPS Location Autodetect using Google Geocoding Wrapper API on Backend
  const fetchLocation = async () => {
    dispatch({ type: 'SET_BATCH', payload: { isLoading: true, error: null } });

    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 6000,
        accuracyThresholdMeters: 150
      });

      const latitude = fix.coords.latitude;
      const longitude = fix.coords.longitude;
      const newCoords = { lat: latitude, lng: longitude };

      // Un-block location loaded state as soon as coordinates are acquired
      dispatch({ type: 'SET_BATCH', payload: { location: newCoords, isLocationLoaded: true } });

      // 1. Await reverse-geocode call FIRST to resolve address & pincode
      let fullAddress = 'Address unavailable';
      let pin: string | null = null;
      let c: string | null = null;
      let s: string | null = null;
      let co: string | null = null;

      try {
        const response = await apiClient.get(`/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`);
        if (response.data?.success) {
          const details = response.data.details;
          fullAddress = details.fullAddress;
          pin = details.pincode || null;
          c = details.city || null;
          s = details.state || null;
          co = details.country || null;

          // Single atomic dispatch for all address fields
          dispatch({ type: 'SET_BATCH', payload: {
            address: fullAddress,
            pincode: pin,
            city: c,
            state: s,
            country: co,
            selectedAddressId: null,
            deliveryAddress: null,
          }});
        } else {
          dispatch({ type: 'SET_BATCH', payload: { address: 'Address unavailable' } });
        }
      } catch (geoErr) {
        console.error("Reverse geocode failed:", geoErr);
        dispatch({ type: 'SET_BATCH', payload: { address: 'Address unavailable' } });
      }

      // 2. Fire zone feasibility check using the resolved real pincode
      let zId: string | null = null;
      let zName: string | null = null;

      try {
        const zoneRes = await apiClient.post("/delivery-zones/check-feasibility", {
          userLat: latitude,
          userLng: longitude,
          pincode: pin || ""
        });

        if (zoneRes.data?.success && zoneRes.data?.isDeliverable) {
          zId = zoneRes.data.zoneId;
          zName = zoneRes.data.zoneName;
          dispatch({ type: 'SET_ZONE', payload: { zoneId: zId, zoneName: zName, error: null } });
        } else {
          dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: zoneRes.data?.message || "Sorry, you are currently outside our delivery service area." } });
        }
      } catch (zErr: any) {
        console.error("Zone feasibility check failed:", zErr);
        dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: "Sorry, you are currently outside our delivery service area." } });
      }

      localStorage.setItem('ziprocket_location', JSON.stringify({
        coords: newCoords,
        address: fullAddress,
        pincode: pin,
        city: c,
        state: s,
        country: co,
        zoneId: zId,
        zoneName: zName,
        selectedAddressId: null,
        deliveryAddress: null
      }));

      dismissPrompt();
    } catch (err: any) {
      console.error("Geocoding failed:", err);
      dispatch({ type: 'SET_BATCH', payload: {
        error: err.message || "Failed to resolve your coordinates address",
        address: 'Address unavailable',
        isFirstTime: true,
      }});
      dismissPrompt();
    } finally {
      dispatch({ type: 'SET_BATCH', payload: { isLoading: false, isLocationLoaded: true } });
    }
  };

  // 6. Manual Location Setter (resolves geocoded places)
  const setCustomLocation = async (
    coords: Location,
    fullAddress: string,
    pin: string | null,
    c: string | null,
    s: string | null,
    co: string | null
  ) => {
    // Single atomic dispatch for all fields
    dispatch({ type: 'SET_BATCH', payload: {
      location: coords,
      address: fullAddress,
      pincode: pin,
      city: c,
      state: s,
      country: co,
      selectedAddressId: null,
      deliveryAddress: null,
    }});

    let zId = null;
    let zName = null;
    try {
      const zoneRes = await apiClient.post("/delivery-zones/check-feasibility", {
        userLat: coords.lat,
        userLng: coords.lng,
        pincode: pin || ""
      });
      if (zoneRes.data.success && zoneRes.data.isDeliverable) {
        zId = zoneRes.data.zoneId;
        zName = zoneRes.data.zoneName;
        dispatch({ type: 'SET_ZONE', payload: { zoneId: zId, zoneName: zName, error: null } });
      } else {
        dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: zoneRes.data.message || "Sorry, you are currently outside our delivery service area." } });
      }
    } catch (zErr: any) {
      dispatch({ type: 'SET_ZONE', payload: { zoneId: null, zoneName: null, error: "Sorry, you are currently outside our delivery service area." } });
    }

    localStorage.setItem('ziprocket_location', JSON.stringify({
      coords,
      address: fullAddress,
      pincode: pin,
      city: c,
      state: s,
      country: co,
      zoneId: zId,
      zoneName: zName,
      selectedAddressId: null,
      deliveryAddress: null
    }));
    dismissPrompt();
  };

  const contextValue = useMemo(() => ({
    location: state.location,
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
    fetchLocation,
    dismissPrompt,
    setSelectedAddress,
    saveAndSelectAddress,
    loadSavedAddresses,
    setCustomLocation
  }), [state]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
