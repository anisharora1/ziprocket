'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/services/api';

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
      if (res.data.success) {
        setZoneId(res.data.zoneId);
        setZoneName(res.data.zoneName);
        setError(null);
      }
    } catch (err: any) {
      console.warn("Location lies outside delivery zones:", err.response?.data?.message);
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
      const hasPrompted = localStorage.getItem('ziprocket_location_prompted');

      if (storedLocation) {
        try {
          const parsed = JSON.parse(storedLocation);
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
          
          // Proactively re-verify zone calculations only if zoneId was not already resolved
          if (parsed.coords && !parsed.zoneId) {
            await resolveOperationalZone(parsed.coords.lat, parsed.coords.lng, parsed.pincode || null);
          }
        } catch (e) {
          console.error("Failed to parse stored location");
        }
      } else if (!hasPrompted) {
        setIsFirstTime(true);
      }

      // Check if token exists to fetch saved address book
      const token = localStorage.getItem('token');
      if (token) {
        await loadSavedAddresses();
      }

      setIsLocationLoaded(true);
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
    }

    await resolveOperationalZone(addr.location.lat, addr.location.lng, addr.pincode);
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
  const fetchLocation = () => {
    setIsLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };
        setLocation(newCoords);

        try {
          // Query secure geocoding wrapper on the backend
          const response = await apiClient.get(`/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (response.data.success) {
            const { fullAddress, pincode: pin, city: c, state: s, country: co } = response.data.details;
            
            setAddress(fullAddress);
            setPincode(pin || null);
            setCity(c || null);
            setState(s || null);
            setCountry(co || null);
            setSelectedAddressId(null); // GPS Override unsets address ID
            setDeliveryAddress(null); // Reset until manual address is captured

            // Resolve operational zone and save
            let zId = null;
            let zName = null;
            try {
              const zoneRes = await apiClient.post("/delivery-zones/check-feasibility", {
                userLat: latitude,
                userLng: longitude,
                pincode: pin || ""
              });
              if (zoneRes.data.success) {
                zId = zoneRes.data.zoneId;
                zName = zoneRes.data.zoneName;
                setZoneId(zId);
                setZoneName(zName);
              }
            } catch (zErr) {
              console.warn("User is outside delivery limits.");
              setError("Sorry, you are currently outside our delivery service area.");
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
          }
          dismissPrompt();
        } catch (err: any) {
          console.error("Geocoding failed:", err);
          setError("Failed to resolve your coordinates address");
          setAddress('Address unavailable');
          localStorage.setItem('ziprocket_location', JSON.stringify({ coords: newCoords, address: 'Address unavailable' }));
          dismissPrompt();
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError('GPS coordinates access permission was denied');
        setIsLoading(false);
      }
    );
  };

  return (
    <LocationContext.Provider value={{
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
      loadSavedAddresses
    }}>
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
