const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const FRONTEND_REFERER = "http://localhost:3000/";

// 1. Google Places Autocomplete API (New v1 Endpoint)
export const getAutocompleteSuggestions = async (input: string) => {
    try {
        const url = "https://places.googleapis.com/v1/places:autocomplete";
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY || "",
                "Referer": FRONTEND_REFERER
            },
            body: JSON.stringify({
                input: input,
                includedRegionCodes: ["IN"]
            })
        });
        const data = await res.json() as any;
        if (data.error) {
            console.error("Places API (New) Autocomplete returned error:", data.error);
            return [];
        }
        
        const suggestions = data.suggestions || [];
        return suggestions.map((s: any) => {
            const pred = s.placePrediction;
            if (!pred) return null;
            return {
                place_id: pred.placeId || pred.place.replace("places/", ""),
                description: pred.text?.text || ""
            };
        }).filter(Boolean);
    } catch (err) {
        console.error("Autocomplete fetch failed:", err);
        return [];
    }
};

// 2. Google Place Details API (New v1 Endpoint - fetch coordinates & address details)
export const getPlaceDetails = async (placeId: string) => {
    try {
        // Clean placeId if it contains "places/" prefix
        const cleanPlaceId = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
        const url = `https://places.googleapis.com/v1/${cleanPlaceId}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "X-Goog-Api-Key": GOOGLE_API_KEY || "",
                "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
                "Referer": FRONTEND_REFERER
            }
        });
        const data = await res.json() as any;
        
        if (data.error) {
            throw new Error(data.error.message || "Failed to fetch place details");
        }
        
        // Parse components
        let pincode = "";
        let city = "";
        let state = "";
        let country = "";
        
        if (data.addressComponents) {
            for (const comp of data.addressComponents) {
                if (comp.types.includes("postal_code")) pincode = comp.longText;
                if (comp.types.includes("locality") || comp.types.includes("sublocality") || comp.types.includes("administrative_area_level_2")) {
                    if (!city) city = comp.longText;
                }
                if (comp.types.includes("administrative_area_level_1")) state = comp.longText;
                if (comp.types.includes("country")) country = comp.longText;
            }
        }
        
        // Regex pincode fallback from formattedAddress
        if (!pincode && data.formattedAddress) {
            const match = data.formattedAddress.match(/\b\d{6}\b/);
            if (match) pincode = match[0];
        }
        
        return {
            fullAddress: data.formattedAddress || "",
            lat: data.location?.latitude ?? 0,
            lng: data.location?.longitude ?? 0,
            pincode,
            city: city || "Unknown",
            state: state || "Bihar",
            country: country || "India"
        };
    } catch (err: any) {
        console.error("Place Details (New) failed:", err);
        throw err;
    }
};

// 3. Google Geocoding API (Reverse Geocode GPS coordinates) with Nominatim Fallback
// Helper to perform reverse-lookup using modern Places API v1 searchNearby (works with referer restrictions)
export const getReverseGeocodeFromPlacesAPI = async (lat: number, lng: number) => {
    try {
        const url = "https://places.googleapis.com/v1/places:searchNearby";
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY || "",
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents",
                "Referer": FRONTEND_REFERER
            },
            body: JSON.stringify({
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 120.0
                    }
                },
                maxResultCount: 5
            })
        });
        const data = await res.json() as any;
        
        if (data && data.places && data.places.length > 0) {
            // Find first place with valid components
            for (const place of data.places) {
                if (place.addressComponents && place.addressComponents.length > 0) {
                    let pincode = "";
                    let city = "";
                    let state = "";
                    let country = "";
                    
                    for (const comp of place.addressComponents) {
                        if (comp.types.includes("postal_code")) pincode = comp.longText;
                        if (comp.types.includes("locality") || comp.types.includes("sublocality") || comp.types.includes("administrative_area_level_2")) {
                            if (!city) city = comp.longText;
                        }
                        if (comp.types.includes("administrative_area_level_1")) state = comp.longText;
                        if (comp.types.includes("country")) country = comp.longText;
                    }
                    
                    // Regex pincode fallback from formattedAddress
                    if (!pincode && place.formattedAddress) {
                        const match = place.formattedAddress.match(/\b\d{6}\b/);
                        if (match) pincode = match[0];
                    }
                    
                    return {
                        fullAddress: place.formattedAddress || place.displayName?.text || "",
                        pincode,
                        city: city || "Unknown",
                        state: state || "Punjab",
                        country: country || "India"
                    };
                }
            }
        }
    } catch (err) {
        console.error("Google Places searchNearby fallback failed:", err);
    }
    return null;
};

// 3. Google Geocoding API (Reverse Geocode GPS coordinates) with Nominatim Fallback
export const getReverseGeocode = async (lat: number, lng: number) => {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
        // Try Google Geocoding API with Referer header in case they have a referrer whitelist
        const res = await fetch(url, { headers: { "Referer": FRONTEND_REFERER } });
        const data = await res.json() as any;
        
        if (data.status === "OK" && data.results && data.results.length > 0) {
            let pincode = "";
            let city = "";
            let state = "";
            let country = "";
            
            // Scan across all results to extract components
            for (const result of data.results) {
                if (result.address_components) {
                    for (const comp of result.address_components) {
                        if (!pincode && comp.types.includes("postal_code")) pincode = comp.long_name;
                        if (!city && (comp.types.includes("locality") || comp.types.includes("sublocality") || comp.types.includes("administrative_area_level_2"))) {
                            city = comp.long_name;
                        }
                        if (!state && comp.types.includes("administrative_area_level_1")) state = comp.long_name;
                        if (!country && comp.types.includes("country")) country = comp.long_name;
                    }
                }
            }
            
            // Regex pincode fallback from formatted addresses of results
            if (!pincode) {
                for (const result of data.results) {
                    const match = (result.formatted_address || "").match(/\b\d{6}\b/);
                    if (match) {
                        pincode = match[0];
                        break;
                    }
                }
            }
            
            return {
                fullAddress: data.results[0].formatted_address || "",
                pincode,
                city: city || "Unknown",
                state: state || "Bihar",
                country: country || "India"
            };
        } else {
            console.warn(`Google Geocoding failed with status: ${data.status}. Trying Places searchNearby fallback.`);
            const placesFallback = await getReverseGeocodeFromPlacesAPI(lat, lng);
            if (placesFallback) return placesFallback;
        }
    } catch (err) {
        console.error("Google Geocoding failed with exception. Trying Places searchNearby fallback:", err);
        const placesFallback = await getReverseGeocodeFromPlacesAPI(lat, lng);
        if (placesFallback) return placesFallback;
    }
    
    // Robust fallback to OpenStreetMap Nominatim API (Free and no API Key/Referrer restriction)
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "ZipRocket/1.0"
            }
        });
        const data = await res.json() as any;
        
        if (data && data.address) {
            const fullAddress = data.display_name || "";
            let pincode = data.address.postcode || "";
            const city = data.address.town || data.address.city || data.address.village || data.address.suburb || data.address.state_district || data.address.county || "Unknown";
            const state = data.address.state || "Bihar";
            const country = data.address.country || "India";
            
            // Regex pincode fallback
            if (!pincode) {
                const match = fullAddress.match(/\b\d{6}\b/);
                if (match) pincode = match[0];
            }
            
            return {
                fullAddress,
                pincode,
                city,
                state,
                country
            };
        }
    } catch (err) {
        console.error("Nominatim fallback reverse geocode failed too:", err);
    }
    
    throw new Error("No address found for these coordinates");
};

// 4. Google Distance Matrix API (Compute driving route parameters) with Haversine Fallback
export const getRouteDistanceAndDuration = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { headers: { "Referer": FRONTEND_REFERER } });
        const data = await res.json() as any;
        const element = data.rows?.[0]?.elements?.[0];
        
        if (element && element.status === "OK") {
            return {
                distanceKm: parseFloat((element.distance.value / 1000).toFixed(2)),
                durationMinutes: Math.ceil(element.duration.value / 60)
            };
        }
    } catch (err) {
        console.error("Distance Matrix failed, falling back to Haversine:", err);
    }
    
    // Haversine fallback if API fails
    const R = 6371; // Earth radius in km
    const dLat = (destLat - originLat) * (Math.PI / 180);
    const dLon = (destLng - originLng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(originLat * (Math.PI / 180)) * Math.cos(destLat * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    
    return {
        distanceKm: parseFloat(dist.toFixed(2)),
        durationMinutes: Math.ceil(dist * 3) // Estimated 3 mins per KM driving speed fallback
    };
};
