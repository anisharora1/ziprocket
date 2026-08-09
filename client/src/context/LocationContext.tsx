'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '@/services/api';
import { getHighAccuracyGPSFix } from '@/utils/geolocation';

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

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [pincode, setPincode] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress['deliveryAddress'] | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLocationLoaded, setIsLocationLoaded] = useState(false);

  // 1. Load active delivery zone details based on coordinates
  const resolveOperationalZone = async (lat: number, lng: number, pin: string | null) => {
    try {
      const res = await apiClient.post("/delivery-zones/check-feasibility", {
        userLat: lat,
        userLng: lng,
        pincode: pin || ""
      });
      if (res.data.success && res.data.isDeliverable) {
        setZoneId(res.data.zoneId);
        setZoneName(res.data.zoneName);
        setError(null);
      } else {
        setError(res.data.message || "Outside active operating radius");
        setZoneId(null);
        setZoneName(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Outside active operating radius");
      setZoneId(null);
      setZoneName(null);
    }
  };

  // 2. Load saved addresses of authenticated user
  const loadSavedAddresses = async () => {
    try {
      const res = await apiClient.get("/addresses");
      if (res.data.success) {
        setSavedAddresses(res.data.addresses || []);
        
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
            setLocation(parsed.coords);
            setAddress(parsed.address);
            setPincode(parsed.pincode || null);
            setCity(parsed.city || null);
            setState(parsed.state || null);
            setCountry(parsed.country || null);
            setZoneId(parsed.zoneId || null);
            setZoneName(parsed.zoneName || null);
            setSelectedAddressId(parsed.selectedAddressId || null);
            setDeliveryAddress(parsed.deliveryAddress || null);
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
            setSavedAddresses(list);
            
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

      // If no stored location and no default address was selected, auto-detect location
      if (!validStoredLocation && !defaultAddressSelected) {
        fetchLocation();
      } else {
        setIsLocationLoaded(true);
      }
    };

    initializeLocation();
  }, []);

  const dismissPrompt = () => {
    setIsFirstTime(false);
    localStorage.setItem('ziprocket_location_prompted', 'true');
  };

  // 3. Set address based on user action
  const setSelectedAddress = async (addr: SavedAddress | null) => {
    if (!addr) {
      setLocation(null);
      setAddress(null);
      setPincode(null);
      setCity(null);
      setState(null);
      setCountry(null);
      setZoneId(null);
      setZoneName(null);
      setSelectedAddressId(null);
      setDeliveryAddress(null);
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

    setLocation(addr.location);
    setAddress(addr.fullAddress);
    setPincode(addr.pincode);
    setCity(addr.city);
    setState(addr.state);
    setCountry(addr.country || null);
    setSelectedAddressId(addr._id);
    setDeliveryAddress(addr.deliveryAddress || null);
    
    if (addr.deliveryZone) {
      setZoneId(addr.deliveryZone);
      // Retrieve zone details from saved addresses list if possible
      const matched = savedAddresses.find(a => a.deliveryZone === addr.deliveryZone);
      setZoneName(matched ? "ZipRocket Active Zone" : "Local Operating Area");
      setError(null);
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
      setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // 5. Automatic GPS Location Autodetect using Google Geocoding Wrapper API on Backend
  const fetchLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 6000,
        accuracyThresholdMeters: 150
      });

      const latitude = fix.coords.latitude;
      const longitude = fix.coords.longitude;
      const newCoords = { lat: latitude, lng: longitude };
      setLocation(newCoords);

      // Un-block location loaded state as soon as coordinates are acquired
      setIsLocationLoaded(true);

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

          setAddress(fullAddress);
          setPincode(pin);
          setCity(c);
          setState(s);
          setCountry(co);
          setSelectedAddressId(null);
          setDeliveryAddress(null);
        } else {
          setAddress('Address unavailable');
        }
      } catch (geoErr) {
        console.error("Reverse geocode failed:", geoErr);
        setAddress('Address unavailable');
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
          setZoneId(zId);
          setZoneName(zName);
          setError(null);
        } else {
          setError(zoneRes.data?.message || "Sorry, you are currently outside our delivery service area.");
          setZoneId(null);
          setZoneName(null);
        }
      } catch (zErr: any) {
        console.error("Zone feasibility check failed:", zErr);
        setError("Sorry, you are currently outside our delivery service area.");
        setZoneId(null);
        setZoneName(null);
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
      setError(err.message || "Failed to resolve your coordinates address");
      setAddress('Address unavailable');
      setIsFirstTime(true);
      dismissPrompt();
    } finally {
      setIsLoading(false);
      setIsLocationLoaded(true);
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
    setLocation(coords);
    setAddress(fullAddress);
    setPincode(pin);
    setCity(c);
    setState(s);
    setCountry(co);
    setSelectedAddressId(null);
    setDeliveryAddress(null);

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
        setZoneId(zId);
        setZoneName(zName);
        setError(null);
      } else {
        setError(zoneRes.data.message || "Sorry, you are currently outside our delivery service area.");
        setZoneId(null);
        setZoneName(null);
      }
    } catch (zErr: any) {
      setError("Sorry, you are currently outside our delivery service area.");
      setZoneId(null);
      setZoneName(null);
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
    location,
    address,
    pincode,
    city,
    state,
    country,
    zoneId,
    zoneName,
    savedAddresses,
    selectedAddressId,
    deliveryAddress,
    isLoading,
    error,
    isFirstTime,
    isLocationLoaded,
    fetchLocation,
    dismissPrompt,
    setSelectedAddress,
    saveAndSelectAddress,
    loadSavedAddresses,
    setCustomLocation
  }), [
    location, address, pincode, city, state, country,
    zoneId, zoneName, savedAddresses, selectedAddressId,
    deliveryAddress, isLoading, error, isFirstTime, isLocationLoaded
  ]);

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
