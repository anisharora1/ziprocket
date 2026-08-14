"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { apiClient } from "@/services/api";
import { getHighAccuracyGPSFix } from "@/utils/geolocation";
import { usePlatform } from "@/context/PlatformContext";
import PlatformBanner from "@/components/PlatformBanner";
import OptimizedImage from "@/components/OptimizedImage";
import dynamic from "next/dynamic";
import {
  MdRemoveShoppingCart,
  MdCheckCircle,
  MdError,
  MdWarning,
  MdLocationOff,
  MdClose,
  MdArrowForward,
  MdBlock,
  MdTipsAndUpdates,
  MdEditLocation,
  MdArrowBack,
  MdHome,
  MdEdit,
  MdSchedule,
  MdCelebration,
  MdLocalShipping,
  MdShoppingBag,
  MdFastfood,
  MdSell,
  MdChevronRight,
  MdAccountBalanceWallet,
  MdPayments,
  MdThunderstorm,
  MdWork,
  MdHomeWork,
  MdMyLocation,
  MdMic,
  MdMicOff,
  MdSync,
  MdSave,
  MdInfo,
  MdLocationOn,
  MdDescription,
  MdAdd,
} from "react-icons/md";

const LocationSelectorModal = dynamic(() => import("@/components/LocationSelectorModal"), { ssr: false });

interface BillDetails {
    success?: boolean;
    zoneId?: string;
    zoneName?: string;
    itemTotal: number;
    deliveryFee: number;
    smallOrderFee: number;
    platformFee: number;
    packagingCharge: number;
    convenienceFee: number;
    gst: number;
    surgeCharge: number;
    grandTotal: number;
    distanceKm?: number;
    durationMinutes?: number;
    discountAmount?: number;
    couponApplied?: boolean;
    couponError?: string;
}

export default function CheckoutPage() {
    const router = useRouter();
    const [placingOrder, setPlacingOrder] = useState(false);
    const { cart, clearCart } = useCart();
    const {
        isPlatformCurrentlyOpen,
        getPlatformStatusMessage,
        isGroceryCurrentlyOpen,
        getGroceryStatusMessage
    } = usePlatform();

    const [vendorAvailability, setVendorAvailability] = useState<string>("open");

    useEffect(() => {
        const fetchVendorStatus = async () => {
            if (cart.orderType === 'food' && cart.vendorId) {
                try {
                    const res = await apiClient.get(`/restaurants/${cart.vendorId}`);
                    if (res.data.success && res.data.restaurant) {
                        setVendorAvailability(res.data.restaurant.availabilityStatus || "open");
                    }
                } catch (err) {
                    console.error("Failed to check restaurant status in checkout:", err);
                }
            }
        };
        fetchVendorStatus();
    }, [cart.vendorId, cart.orderType]);

    const platformMsg = getPlatformStatusMessage();
    const isCheckoutDisabled = (() => {
        if (platformMsg) return true;
        if (cart.orderType === "grocery" && !isGroceryCurrentlyOpen()) return true;
        if (cart.orderType === "food" && vendorAvailability !== "open") return true;
        return false;
    })();

    const checkoutDisabledMessage = (() => {
        if (platformMsg) return platformMsg;
        if (cart.orderType === "grocery") {
            return "Grocery ordering is currently unavailable. Please try again later.";
        }
        if (cart.orderType === "food" && vendorAvailability !== "open") {
            return "Ordering from this restaurant is currently unavailable.";
        }
        return null;
    })();

    // ── Notification Card Overlay System ──────────────────────────────────────
    type NotifType = 'success' | 'error' | 'warning' | 'zone';
    interface NotifCard { type: NotifType; title: string; message: string; onAction?: () => void; actionLabel?: string; redirectTo?: string; redirectDelay?: number; }
    const [notifCard, setNotifCard] = useState<NotifCard | null>(null);
    const showCard = (card: NotifCard) => setNotifCard(card);
    const closeCard = () => setNotifCard(null);

    // ── Out-of-Zone Overlay Card ───────────────────────────────────────────────
    const [showOutOfZoneOverlay, setShowOutOfZoneOverlay] = useState(false);
    const [activeZones, setActiveZones] = useState<string[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('ONLINE');
    const { user } = useAuth();
    const { 
        location: userCoords, 
        address: userAddress, 
        pincode: userPincode, 
        city: userCity, 
        deliveryAddress: userDeliveryAddress, 
        savedAddresses, 
        selectedAddressId,
        setSelectedAddress,
        loadSavedAddresses
    } = useLocation();

    // Custom address overrides during checkout review
    const [isAddressEditModalOpen, setIsAddressEditModalOpen] = useState(false);
    const [editedPhone, setEditedPhone] = useState("");
    const [editedPincode, setEditedPincode] = useState("");
    const [editError, setEditError] = useState<string | null>(null);
    const [validatingEdit, setValidatingEdit] = useState(false);

    // Swiggy-style checkout address states
    const [checkoutAddressStep, setCheckoutAddressStep] = useState<'select' | 'form'>('select');
    const [floor, setFloor] = useState("");
    const [addressLabel, setAddressLabel] = useState<string>('Home');
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    // Rural friendly address fields
    const [village, setVillage] = useState("");
    const [mohalla, setMohalla] = useState("");
    const [landmark, setLandmark] = useState("");
    const [houseNo, setHouseNo] = useState("");
    const [street, setStreet] = useState("");
    const [instructions, setInstructions] = useState("");
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [detectingGps, setDetectingGps] = useState(false);
    const [listeningField, setListeningField] = useState<string | null>(null);

    const [customAddressText, setCustomAddressText] = useState<string | null>(null);
    const [customPhone, setCustomPhone] = useState<string | null>(null);
    const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [customPincode, setCustomPincode] = useState<string | null>(null);
    const [customDeliveryAddress, setCustomDeliveryAddress] = useState<any | null>(null);

    // ── Coupon system states ────────────────────────────────────────────────────
    const [appliedCouponCode, setAppliedCouponCode] = useState<string>("");
    const [couponInputText, setCouponInputText] = useState<string>("");
    const [couponError, setCouponError] = useState<string | null>(null);
    const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
    const [unapplicableCoupons, setUnapplicableCoupons] = useState<any[]>([]);
    const [isCouponDrawerOpen, setIsCouponDrawerOpen] = useState(false);
    const [applyingCoupon, setApplyingCoupon] = useState(false);

    const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleVoiceInput = (fieldName: string, setter: (val: string) => void) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice input is not supported in this browser. Please type manually. / आपके ब्राउज़र में वॉयस इनपुट समर्थित नहीं है।");
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "hi-IN"; // Set language to Hindi/Indian English
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            setListeningField(fieldName);

            recognition.onstart = () => {};

            recognition.onresult = (event: any) => {
                const speechToText = event.results[0][0].transcript;
                setter(speechToText);
            };

            recognition.onerror = (err: any) => {
                if (process.env.NODE_ENV !== "production") {
                    console.error("Speech recognition error:", err);
                }
                alert("Could not recognize voice. Please try again. / आवाज़ पहचानी नहीं जा सकी। पुनः प्रयास करें।");
                setListeningField(null);
            };

            recognition.onend = () => {
                setListeningField(null);
            };

            recognition.start();
        } catch (e) {
            console.error("Speech recognition initialization failed:", e);
            setListeningField(null);
        }
    };

    const handleDetectGPS = () => {
        if (!navigator.geolocation) {
            return setEditError("GPS is not supported by your browser / आपके ब्राउज़र में जीपीएस काम नहीं कर रहा है।");
        }

        setDetectingGps(true);
        setEditError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setGpsCoords({ lat: latitude, lng: longitude });

                try {
                    // Call reverse geocode wrapper securely on backend
                    const res = await apiClient.get(`/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`);
                    if (res.data.success) {
                        const details = res.data.details;
                        if (details.pincode) {
                            setEditedPincode(details.pincode);
                        }
                        if (details.city) {
                            setVillage(details.city);
                        }
                        if (details.fullAddress) {
                            const components = details.fullAddress.split(", ");
                            if (components.length > 1) {
                                setMohalla(components[0] + ", " + components[1]);
                            }
                        }
                    }
                } catch (err: any) {
                    console.error("GPS Reverse Geocode failed, attempting Nominatim client fallback:", err);
                    try {
                        const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
                            headers: { "User-Agent": "ZipRocket/1.0" }
                        });
                        const nomData = await nomRes.json();
                        if (nomData && nomData.address) {
                            const addr = nomData.address;
                            const rPincode = addr.postcode || "";
                            const rVillage = addr.village || addr.suburb || addr.town || addr.city || "";
                            const rDistrict = addr.county || addr.district || "";

                            if (rPincode) setEditedPincode(rPincode);
                            if (rVillage) setVillage(rVillage);
                            if (rDistrict) setMohalla(rDistrict);
                        }
                    } catch (nominatimErr) {
                        console.error("Nominatim reverse geocode fallback failed too:", nominatimErr);
                    }
                } finally {
                    setDetectingGps(false);
                }
            },
            (error) => {
                console.error("GPS error:", error);
                setEditError("Could not access your GPS location. Please enable location services. / जीपीएस स्थान प्राप्त नहीं हो सका।");
                setDetectingGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleOpenAddressEditModal = () => {
        setEditError(null);
        setGpsCoords(customCoords || userCoords || null);
        setEditedPhone(customPhone || user?.phone || "");
        setEditedPincode(customPincode || userPincode || "");

        // Prefill locality and village from context / active location
        setMohalla(userAddress || "");
        setVillage(userCity || "");
        
        // Floor and House No
        setHouseNo("");
        setFloor("");
        setStreet("");
        setLandmark("");
        setInstructions("");
        setAddressLabel("Home");
        setShowInstructions(false);

        if (savedAddresses.length > 0) {
            setCheckoutAddressStep('select');
        } else {
            setCheckoutAddressStep('form');
        }
        setIsAddressEditModalOpen(true);
    };

    // Auto-sync context coordinates and address changes to form inputs
    useEffect(() => {
        if (isAddressEditModalOpen && checkoutAddressStep === 'form') {
            if (userAddress) setMohalla(userAddress);
            if (userCity) setVillage(userCity);
            if (userPincode) setEditedPincode(userPincode);
            if (userCoords) setGpsCoords(userCoords);
        }
    }, [userAddress, userCity, userPincode, userCoords, isAddressEditModalOpen, checkoutAddressStep]);

    const handleSelectSavedAddress = async (addr: any) => {
        await setSelectedAddress(addr);
        // Clear overrides
        setCustomAddressText(null);
        setCustomPhone(null);
        setCustomCoords(null);
        setCustomPincode(null);
        setCustomDeliveryAddress(null);
        setIsAddressEditModalOpen(false);
    };

    const handleSaveAddressEdit = async () => {
        if (!mohalla.trim()) return setEditError("Area/Locality is required. Click 'Change' to select location.");
        if (!village.trim()) return setEditError("Village/City is required.");
        if (!houseNo.trim()) return setEditError("Building / Floor is required.");
        if (!editedPhone.trim()) return setEditError("Phone number is required.");
        if (editedPhone.length < 10) return setEditError("Please enter a valid 10-digit mobile number.");

        // Landmark defaults to "N/A" if empty to satisfy backend validation
        const finalLandmark = landmark.trim() || "N/A";

        // Combine house number and floor if floor is entered
        const combinedHouseNo = floor.trim() ? `${houseNo.trim()}, Floor: ${floor.trim()}` : houseNo.trim();

        const addressTextVal = [
            combinedHouseNo ? `House/Flat No: ${combinedHouseNo}` : "",
            street.trim() ? `Road: ${street.trim()}` : "",
            mohalla.trim() ? `${mohalla.trim()}` : "",
            village.trim() ? `Village: ${village.trim()}` : "",
            finalLandmark && finalLandmark !== "N/A" ? `Near: ${finalLandmark}` : ""
        ].filter(Boolean).join(", ");

        setValidatingEdit(true);
        setEditError(null);

        const activeLat = gpsCoords?.lat ?? userCoords?.lat;
        const activeLng = gpsCoords?.lng ?? userCoords?.lng;

        if (activeLat === undefined || activeLng === undefined) {
            setEditError("Location coordinates are missing.");
            setValidatingEdit(false);
            return;
        }

        const payload = {
            label: addressLabel === "Office" || addressLabel === "Work" ? "Work" : addressLabel === "House" || addressLabel === "Home" ? "Home" : addressLabel,
            location: { lat: activeLat, lng: activeLng },
            deliveryAddress: {
                houseNumber: combinedHouseNo,
                street: street.trim(),
                locality: mohalla.trim(),
                village: village.trim(),
                landmark: finalLandmark,
                pincode: editedPincode,
                instructions: instructions.trim()
            },
            isDefault: false
        };

        const token = localStorage.getItem('token');
        if (token) {
            try {
                const res = await apiClient.post("/addresses", payload);
                if (res.data.success) {
                    await loadSavedAddresses();
                    // Select the newly created address
                    await setSelectedAddress(res.data.address);
                    // Clear overrides in checkout state
                    setCustomAddressText(null);
                    setCustomPhone(null);
                    setCustomCoords(null);
                    setCustomPincode(null);
                    setCustomDeliveryAddress(null);
                    setIsAddressEditModalOpen(false);
                }
            } catch (err: any) {
                console.error("Failed to save address:", err);
                setEditError(err.response?.data?.message || "Failed to save address details.");
            } finally {
                setValidatingEdit(false);
            }
        } else {
            // Guest Flow
            const guestAddress: any = {
                _id: "guest-manual-coords",
                label: addressLabel === "Office" ? "Work" : addressLabel,
                location: { lat: activeLat, lng: activeLng },
                deliveryAddress: payload.deliveryAddress,
                fullAddress: addressTextVal,
                pincode: editedPincode || "000000",
                city: village || "Unknown",
                state: "Punjab",
                deliveryZone: billDetails?.zoneId || null,
                isDefault: false
            };
            await setSelectedAddress(guestAddress);
            setCustomAddressText(addressTextVal);
            setCustomPhone(editedPhone);
            setCustomCoords({ lat: activeLat, lng: activeLng });
            setCustomPincode(editedPincode);
            setCustomDeliveryAddress(payload.deliveryAddress);
            setIsAddressEditModalOpen(false);
            setValidatingEdit(false);
        }
    };

    // Default calculations fallback
    const itemTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const distanceFallback = 2.5;
    const deliveryFeeFallback = itemTotal > 0 ? (cart.orderType === 'grocery' ? (itemTotal >= 200 ? 0 : Math.round(15 * distanceFallback)) : 40) : 0;
    const taxesFallback = Math.round(itemTotal * 0.05);
    const grandTotalFallback = itemTotal + taxesFallback + deliveryFeeFallback;

    const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
    const [loadingBill, setLoadingBill] = useState(true);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBillDetails = async () => {
            try {
                setLoadingBill(true);
                setCheckoutError(null);
                const payload = {
                    vendorId: cart.orderType === 'food' ? cart.vendorId : 'grocery',
                    items: cart.items.map(c => ({
                        menuItem: cart.orderType === 'food' ? c.id.replace('food-', '') : undefined,
                        groceryItem: cart.orderType === 'grocery' ? c.id.replace('groc-', '') : undefined,
                        price: c.price,
                        quantity: c.quantity
                    })),
                    userLat: customCoords?.lat || userCoords?.lat || 28.7041,
                    userLng: customCoords?.lng || userCoords?.lng || 77.1025,
                    orderType: cart.orderType || 'food',
                    pincode: customPincode || userPincode || "",
                    address: {
                        fullAddress: customAddressText || userAddress || "",
                        pincode: customPincode || userPincode || "",
                        lat: customCoords?.lat || userCoords?.lat || 28.7041,
                        lng: customCoords?.lng || userCoords?.lng || 77.1025
                    },
                    couponCode: appliedCouponCode || undefined,
                    userId: user?._id || undefined
                };
                const res = await apiClient.post("/delivery-zones/calculate-bill", payload);
                if (res.data.success && res.data.isDeliverable !== false) {
                    setBillDetails(res.data);
                    if (appliedCouponCode && res.data.couponError) {
                        setCouponError(res.data.couponError);
                        setCouponSuccessMessage(null);
                        setAppliedCouponCode("");
                    } else if (appliedCouponCode && res.data.couponApplied) {
                        setCouponSuccessMessage(`Coupon '${appliedCouponCode}' applied successfully!`);
                        setCouponError(null);
                    }
                    setCheckoutError(null);
                } else {
                    setCheckoutError(res.data.message || "Selected location is outside our operational service geofence bounds.");
                    setBillDetails(null);
                }
            } catch (err: any) {
                console.error("Failed to calculate dynamic checkout fares:", err);
                setCheckoutError(err.response?.data?.message || "Selected location is outside our operational service geofence bounds.");
                setBillDetails(null);
            } finally {
                setLoadingBill(false);
            }
        };

        if (cart.items.length > 0) {
            fetchBillDetails();
        }
    }, [cart.items, cart.vendorId, cart.orderType, userCoords, customCoords, customPincode, userPincode, customAddressText, userAddress, appliedCouponCode, user?._id]);

    useEffect(() => {
        const fetchAvailableCoupons = async () => {
            if (!billDetails?.zoneId) return;
            try {
                const res = await apiClient.post("/coupons/available", {
                    userId: user?._id,
                    subtotal: itemTotal,
                    zoneId: billDetails.zoneId,
                    restaurantId: cart.orderType === 'food' ? cart.vendorId : undefined,
                    orderType: cart.orderType || 'food'
                });
                if (res.data.success) {
                    setAvailableCoupons(res.data.applicable || []);
                    setUnapplicableCoupons(res.data.unapplicable || []);
                }
            } catch (err) {
                console.error("Failed to fetch available coupons:", err);
            }
        };
        fetchAvailableCoupons();
    }, [billDetails?.zoneId, itemTotal, user?._id, cart.orderType, cart.vendorId]);

    const handleApplyCoupon = async (code: string) => {
        if (!code.trim()) return;
        setApplyingCoupon(true);
        setCouponError(null);
        setCouponSuccessMessage(null);
        try {
            const res = await apiClient.post("/coupons/validate", {
                code: code.toUpperCase().trim(),
                userId: user?._id,
                subtotal: itemTotal,
                zoneId: billDetails?.zoneId,
                restaurantId: cart.orderType === 'food' ? cart.vendorId : undefined,
                orderType: cart.orderType || 'food'
            });

            if (res.data.success) {
                setAppliedCouponCode(res.data.couponCode);
                setCouponSuccessMessage(res.data.message);
                setCouponInputText("");
                setIsCouponDrawerOpen(false);
            }
        } catch (err: any) {
            console.error("Failed to apply coupon:", err);
            setCouponError(err.response?.data?.message || "Invalid coupon code.");
        } finally {
            setApplyingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCouponCode("");
        setCouponSuccessMessage(null);
        setCouponError(null);
    };

    const activeDeliveryFee = Number(billDetails?.deliveryFee ?? deliveryFeeFallback) || 0;
    const activeGST = Number(billDetails?.gst ?? taxesFallback) || 0;
    const activeGrandTotal = Number(billDetails?.grandTotal ?? grandTotalFallback) || 0;
    const activeDistance = Number(billDetails?.distanceKm ?? distanceFallback) || 0;

    // Auto-redirect after notification card with a delay
    useEffect(() => {
        if (!notifCard?.redirectTo || !notifCard?.redirectDelay) return;
        const t = setTimeout(() => {
            setNotifCard(null);
            router.push(notifCard.redirectTo!);
        }, notifCard.redirectDelay);
        return () => clearTimeout(t);
    }, [notifCard]);

    // Dynamically inject Razorpay Checkout SDK Script
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePlaceOrder = async () => {
        if (isCheckoutDisabled) {
            showCard({
                type: 'error',
                title: 'Ordering Unavailable',
                message: checkoutDisabledMessage || 'Checkout is currently disabled.'
            });
            return;
        }
        if (cart.items.length === 0) {
            showCard({ type: 'warning', title: 'Cart is Empty', message: 'Please add items to your cart before placing an order.' });
            return;
        }
        if (!user) {
            showCard({ type: 'error', title: 'Login Required', message: 'Please log in to place your order.', onAction: () => router.push('/auth/login'), actionLabel: 'Go to Login' });
            return;
        }
        if (checkoutError) {
            // Fetch active zones to show in overlay
            try {
                const zonesRes = await apiClient.get("/delivery-zones");
                const zones = zonesRes.data?.zones || zonesRes.data || [];
                setActiveZones(zones.map((z: any) => z.name || z.zoneName).filter(Boolean));
            } catch { setActiveZones([]); }
            setShowOutOfZoneOverlay(true);
            return;
        }
        const targetAddress = customAddressText || userAddress;
        const targetCoords = customCoords || userCoords;

        if (!targetAddress || !targetCoords) {
            showCard({ type: 'warning', title: 'Address Required', message: 'Please select or enter a valid delivery address.' });
            return;
        }

        const targetDeliveryAddress = customDeliveryAddress || (selectedAddressId ? savedAddresses.find(a => a._id === selectedAddressId)?.deliveryAddress : userDeliveryAddress) || undefined;

        if (!targetDeliveryAddress || !targetDeliveryAddress.houseNumber || !targetDeliveryAddress.landmark) {
            showCard({
                type: 'warning',
                title: 'Detailed Address Required',
                message: 'Please provide detailed delivery address details (House No, Landmark, etc.) to place your order.',
                onAction: () => handleOpenAddressEditModal(),
                actionLabel: 'Add Address Details'
            });
            return;
        }

        setPlacingOrder(true);
        try {
            // Format items for backend schema
            const orderItems = cart.items.map(c => ({
                menuItem: cart.orderType === 'food' ? c.id.replace('food-', '') : undefined,
                groceryItem: cart.orderType === 'grocery' ? c.id.replace('groc-', '') : undefined,
                quantity: c.quantity,
                price: c.price
            }));

            // 1. Place the initial Order record on MongoDB
            const orderRes = await apiClient.post("/orders", {
                user: user._id,
                restaurant: cart.orderType === 'food' ? cart.vendorId : undefined,
                items: orderItems,
                totalAmount: activeGrandTotal + (billDetails?.discountAmount || 0), // raw grand total before coupon deduction
                deliveryCharge: activeDeliveryFee,
                paymentMethod: paymentMethod,
                distance: activeDistance,
                address: {
                    fullAddress: targetAddress,
                    lat: targetCoords.lat,
                    lng: targetCoords.lng,
                    deliveryAddress: targetDeliveryAddress
                },
                phone: customPhone || user?.phone || "",
                orderType: cart.orderType,
                couponCode: appliedCouponCode || undefined
            });

            const mongoOrder = orderRes.data.order;

            // Handle COD Path directly
            if (paymentMethod === "COD") {
                clearCart();
                showCard({ type: 'success', title: '🎉 ऑर्डर हो गया! / Order Placed!', message: 'Your order has been placed successfully via Cash on Delivery. You can track it in Orders.', onAction: () => router.push('/orders'), actionLabel: 'Track Order', redirectTo: '/orders', redirectDelay: 2500 });
                return;
            }

            // Handle ONLINE Path - Load Razorpay Modal
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                showCard({ type: 'error', title: 'Payment SDK Failed', message: 'Failed to load payment gateway. Please check your internet connection and try again.' });
                setPlacingOrder(false);
                return;
            }

            // 2. Create Razorpay order session on backend
            const rzpSessionRes = await apiClient.post("/payments/create", {
                orderId: mongoOrder._id
            });

            if (!rzpSessionRes.data.success) {
                throw new Error("Unable to create Razorpay payment order session");
            }

            const { order: rzpOrder, key } = rzpSessionRes.data;

            // 3. Open Interactive Razorpay Checkout Modal
            const options = {
                key: key,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
                name: "ZipRocket",
                description: cart.orderType === 'food' ? "Food Delivery Order" : "Grocery Basket Order",
                image: "https://cdn-icons-png.flaticon.com/512/857/857681.png", // Premium meal container icon
                order_id: rzpOrder.id,
                handler: async function (response: any) {
                    try {
                        setPlacingOrder(true);

                        // 4. Secure cryptographic signature verification on server
                        const verifyRes = await apiClient.post("/payments/verify", {
                            orderId: mongoOrder._id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature
                        });

                        if (verifyRes.data.success) {
                            clearCart();
                            showCard({ type: 'success', title: '✅ Payment Successful!', message: 'Your payment was verified and your order is being prepared. You can track your delivery live.', onAction: () => router.push('/orders'), actionLabel: 'Track Order', redirectTo: '/orders', redirectDelay: 3000 });
                        } else {
                            showCard({ type: 'error', title: 'Verification Failed', message: 'Payment verification failed. Please contact our support team.', onAction: () => router.push('/orders'), actionLabel: 'View Orders' });
                        }
                    } catch (err: any) {
                        console.error("Signature verification error:", err);
                        showCard({ type: 'error', title: 'Verification Error', message: err.response?.data?.message || err.message || 'An error occurred during verification.', onAction: () => router.push('/orders'), actionLabel: 'View Orders' });
                    } finally {
                        setPlacingOrder(false);
                    }
                },
                prefill: {
                    name: user.name || "",
                    email: user.email || "",
                    contact: user.phone || ""
                },
                theme: {
                    color: "#FF5C00" // Branded warm orange-red
                },
                modal: {
                    ondismiss: async function () {
                        // User closed the modal/cancelled payment
                        try {
                            await apiClient.post("/payments/failure", {
                                orderId: mongoOrder._id,
                                errorDetails: { message: "Payment cancelled by user" }
                            });
                        } catch (e) {
                            console.error("Cancellation logging failed:", e);
                        }
                        showCard({ type: 'warning', title: 'Payment Cancelled', message: 'Your payment was cancelled. You can retry payment anytime from the Orders page.', onAction: () => router.push('/orders'), actionLabel: 'View Orders', redirectTo: '/orders', redirectDelay: 3000 });
                        clearCart(); // Cleared from active cart as it's now tracked under Orders
                    }
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.on("payment.failed", async function (response: any) {
                // Razorpay core payment failure callback
                try {
                    await apiClient.post("/payments/failure", {
                        orderId: mongoOrder._id,
                        errorDetails: {
                            payment_id: response.error.metadata.payment_id,
                            code: response.error.code,
                            description: response.error.description
                        }
                    });
                } catch (e) {
                    console.error("Failure logging failed:", e);
                }
                showCard({ type: 'error', title: 'Payment Failed', message: `${response.error.description}. You can retry payment from the Orders section.`, onAction: () => router.push('/orders'), actionLabel: 'View Orders', redirectTo: '/orders', redirectDelay: 3500 });
                clearCart();
            });

            setPlacingOrder(false); // Stop button animation before modal overlays
            paymentObject.open();

        } catch (error: any) {
            console.error("Order completion failure:", error);
            const errMsg: string = error.response?.data?.message || error.message || '';

            // ── Backend delivery zone rejection → show beautiful overlay card ──
            const isZoneError =
                errMsg.toLowerCase().includes('unavailable in your area') ||
                errMsg.toLowerCase().includes('outside') ||
                errMsg.toLowerCase().includes('delivery zone') ||
                errMsg.toLowerCase().includes('not serviceable') ||
                errMsg.toLowerCase().includes('geofence') ||
                errMsg.toLowerCase().includes('service area');

            if (isZoneError) {
                try {
                    const zonesRes = await apiClient.get("/delivery-zones");
                    const zones = zonesRes.data?.zones || zonesRes.data || [];
                    setActiveZones(Array.isArray(zones)
                        ? zones.map((z: any) => z.name || z.zoneName).filter(Boolean)
                        : []);
                } catch { setActiveZones([]); }
                setShowOutOfZoneOverlay(true);
            } else {
                showCard({ type: 'error', title: 'Checkout Failed', message: errMsg || 'Something went wrong. Please try again.' });
            }
            setPlacingOrder(false);
        }
    };

    if (cart.items.length === 0) {
        return (
            <div className="bg-[#fcfcfc] min-h-screen flex flex-col items-center justify-center p-4">
                <MdRemoveShoppingCart className="text-[64px] text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 mb-2">Your cart is empty</h2>
                <p className="text-slate-500 mb-6 text-center">Looks like you haven't added anything yet.</p>
                <Link href="/" className="px-6 py-3 bg-[#FF5C00] text-white rounded-full font-medium shadow-md">
                    Browse Shop
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-[#fcfcfc] text-slate-900 pb-36 min-h-screen w-full font-sans">
            <PlatformBanner />

            {/* ── Unified Notification Card Overlay ───────────────────────────── */}
            {notifCard && (() => {
                const cfgMap: Record<NotifType, { grad: string; iconComp: React.ComponentType<{ className?: string }>; btnGrad: string; btnShadow: string }> = {
                    success: {
                        grad: 'from-emerald-500 via-emerald-600 to-teal-600',
                        iconComp: MdCheckCircle,
                        btnGrad: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700',
                        btnShadow: 'shadow-emerald-200',
                    },
                    error: {
                        grad: 'from-rose-500 via-rose-600 to-red-700',
                        iconComp: MdError,
                        btnGrad: 'from-rose-500 to-rose-600 hover:from-rose-600 hover:to-red-700',
                        btnShadow: 'shadow-rose-200',
                    },
                    warning: {
                        grad: 'from-amber-400 via-amber-500 to-orange-500',
                        iconComp: MdWarning,
                        btnGrad: 'from-amber-500 to-orange-500 hover:from-orange-500 hover:to-orange-600',
                        btnShadow: 'shadow-amber-200',
                    },
                    zone: {
                        grad: 'from-rose-500 via-rose-600 to-orange-600',
                        iconComp: MdLocationOff,
                        btnGrad: 'from-[#FF5C00] to-[#e05200] hover:from-[#e05200] hover:to-[#c84900]',
                        btnShadow: 'shadow-orange-200',
                    },
                };
                const c = cfgMap[notifCard.type];
                const IconComp = c.iconComp;
                return (
                    <div
                        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                        style={{ background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(10px)' }}
                    >
                        <div
                            className="w-full sm:max-w-[430px] bg-white rounded-t-[32px] sm:rounded-[28px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.38)] flex flex-col"
                            style={{ animation: 'slideUpCard 0.38s cubic-bezier(0.34,1.26,0.64,1) both' }}
                        >
                            {/* Gradient header */}
                            <div className={`relative bg-gradient-to-br ${c.grad} px-6 pt-8 pb-12 text-white overflow-hidden`}>
                                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
                                <div className="absolute -bottom-6 -left-8 w-32 h-32 rounded-full bg-white/10" />
                                <div className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/15" />
                                {/* Close button */}
                                <button
                                    onClick={closeCard}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <MdClose className="text-[18px]" />
                                </button>
                                {/* Icon */}
                                <div className="flex justify-center mb-5">
                                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center">
                                            <IconComp className="text-[36px] text-white" />
                                        </div>
                                    </div>
                                </div>
                                <h2 className="font-black text-[20px] text-center leading-tight">{notifCard.title}</h2>
                            </div>

                            {/* Body */}
                            <div className="px-6 pt-5 pb-2">
                                <p className="text-[14px] text-slate-600 font-medium text-center leading-relaxed">
                                    {notifCard.message}
                                </p>
                                {notifCard.redirectTo && (
                                    <p className="text-[11px] text-slate-400 font-bold text-center mt-3 uppercase tracking-widest">
                                        Redirecting automatically...
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-6 space-y-3">
                                {notifCard.onAction && notifCard.actionLabel && (
                                    <button
                                        onClick={() => { closeCard(); notifCard.onAction?.(); }}
                                        className={`w-full py-4 bg-gradient-to-r ${c.btnGrad} text-white rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 shadow-lg ${c.btnShadow} transition-all active:scale-[0.98]`}
                                    >
                                        {notifCard.actionLabel}
                                        <MdArrowForward className="text-[18px]" />
                                    </button>
                                )}
                                <button
                                    onClick={closeCard}
                                    className="w-full py-3.5 border-2 border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all"
                                >
                                    <MdClose className="text-[18px]" />
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Out-of-Zone Restriction Overlay Card ─────────────────────── */}
            {showOutOfZoneOverlay && (
                <div
                    className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
                    style={{ background: 'rgba(15,15,15,0.75)', backdropFilter: 'blur(8px)' }}
                >
                    <div
                        className="w-full sm:max-w-[420px] bg-white rounded-t-[32px] sm:rounded-[28px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.35)] flex flex-col"
                        style={{ animation: 'slideUpCard 0.4s cubic-bezier(0.34,1.26,0.64,1) both' }}
                    >
                        {/* Decorative gradient header */}
                        <div className="relative bg-gradient-to-br from-rose-500 via-rose-600 to-orange-600 px-6 pt-8 pb-10 text-white overflow-hidden">
                            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                            <div className="absolute -bottom-4 -left-6 w-28 h-28 rounded-full bg-white/10" />
                            <div className="absolute top-6 right-14 w-12 h-12 rounded-full bg-white/15" />
                            <div className="relative flex justify-center mb-5">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center">
                                            <MdLocationOff className="text-[36px] text-white" />
                                        </div>
                                    </div>
                                    <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center">
                                        <MdBlock className="text-[18px] text-rose-600" />
                                    </span>
                                </div>
                            </div>
                            <h2 className="font-black text-[22px] text-center leading-tight">डिलीवरी उपलब्ध नहीं है</h2>
                            <p className="text-[13px] text-white/80 text-center mt-1 font-medium">Delivery Not Available</p>
                        </div>
                        <div className="px-6 pt-5 pb-2">
                            <p className="text-[14px] text-slate-700 font-semibold text-center leading-relaxed">
                                Sorry, your current location is <span className="text-rose-600 font-black">outside our active delivery zones</span>. We currently only deliver to selected areas.
                            </p>
                            {activeZones.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 text-center">✅ We deliver to these zones</p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {activeZones.map((zone, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold rounded-full">
                                                📍 {zone}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                                <MdTipsAndUpdates className="text-amber-600 text-[20px] shrink-0" />
                                <p className="text-[12px] text-amber-800 font-semibold leading-relaxed">
                                    Try changing your delivery address to a location within our serviceable area to place your order.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 space-y-3">
                            <button
                                onClick={() => { setShowOutOfZoneOverlay(false); handleOpenAddressEditModal(); }}
                                className="w-full py-4 bg-gradient-to-r from-[#FF5C00] to-[#e05200] hover:from-[#e05200] hover:to-[#c84900] text-white rounded-2xl font-black text-[14px] flex items-center justify-center gap-2.5 shadow-lg shadow-orange-200 transition-all active:scale-[0.98]"
                            >
                                <MdEditLocation className="text-[20px]" />
                                पता बदलें / Change Delivery Address
                            </button>
                            <button
                                onClick={() => setShowOutOfZoneOverlay(false)}
                                className="w-full py-3.5 border-2 border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all"
                            >
                                <MdArrowBack className="text-[18px]" />
                                वापस जाएं / Go Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUpCard {
                    from { opacity: 0; transform: translateY(70px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            {/* Top AppBar */}
            <header className="bg-white sticky top-0 z-40 pt-4 pb-3 px-4 flex items-center justify-between border-b border-slate-100">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center transition-transform active:scale-95 -ml-1">
                    <MdArrowBack className="text-[#a73a00] text-xl" />
                </button>
                <h1 className="font-bold text-[17px] text-slate-900 tracking-tight">Checkout</h1>
                <span className="font-bold text-[17px] text-[#a73a00]">ZipRocket</span>
            </header>

            <main className="px-4 py-5 space-y-5">
                {/* Delivery Address */}
                <div
                    onClick={handleOpenAddressEditModal}
                    className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-200 transition-colors"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#fff0e6] flex items-center justify-center text-[#a73a00] shrink-0 mt-0.5">
                            <MdHome className="text-xl" />
                        </div>
                        <div>
                            <h2 className="font-medium text-[15px] text-slate-900 leading-tight">Delivery Details</h2>
                            <p className="text-[12px] text-slate-700 mt-1 leading-relaxed font-bold">{customAddressText || userAddress || "No location selected"}</p>
                            <p className="text-[10px] text-slate-450 font-extrabold mt-1 uppercase tracking-wider">
                                Phone: +91 {customPhone || user?.phone || "Not provided"}
                            </p>
                        </div>
                    </div>
                    <MdEdit className="text-slate-400 text-sm shrink-0" />
                </div>

                {/* Feasibility Warn Banners */}
                {checkoutError && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                            <MdWarning className="text-[16px]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-rose-850 text-[14px]">Outside Service Limits</h3>
                            <p className="text-[12px] text-rose-600 mt-0.5 leading-relaxed font-semibold">
                                {checkoutError}
                            </p>
                        </div>
                    </div>
                )}

                {/* Platform/Restaurant/Grocery Closed Warning Banner */}
                {isCheckoutDisabled && checkoutDisabledMessage && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                            <MdError className="text-[16px]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-rose-850 text-[14px]">Ordering Currently Unavailable</h3>
                            <p className="text-[12px] text-rose-600 mt-0.5 leading-relaxed font-semibold">
                                {checkoutDisabledMessage}
                            </p>
                        </div>
                    </div>
                )}

                {/* Route-Based Distance & ETA */}
                {!loadingBill && billDetails && !checkoutError && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <MdSchedule className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[14px] text-slate-800 leading-tight">Dynamic Route ETA</h3>
                                <p className="text-[12px] text-slate-500 mt-1 leading-none font-medium">Fulfillment Distance: {activeDistance} km</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="font-extrabold text-slate-900 text-base block">{billDetails.durationMinutes || 25} mins</span>
                            <span className="text-[9px] text-emerald-650 font-bold uppercase tracking-wider leading-none block mt-1">Fastest route</span>
                        </div>
                    </div>
                )}

                {/* Offer / Zone Banner */}
                {loadingBill ? (
                    <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                ) : activeDeliveryFee === 0 && !checkoutError ? (
                    <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-100 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                            <MdCelebration className="text-[16px]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-emerald-850 text-[14px]">Free delivery applied!</h3>
                            <p className="text-[12px] text-emerald-600 mt-0.5 font-medium">Free delivery threshold met or zone promotion active.</p>
                        </div>
                    </div>
                ) : !checkoutError ? (
                    <div className="bg-[#fff5f0] rounded-xl p-3.5 border border-[#fdeadd] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#fdeadd] flex items-center justify-center text-[#a73a00] shrink-0 mt-0.5">
                            <MdLocalShipping className="text-[16px]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-[#a73a00] text-[14px]">Standard Hyperlocal Delivery</h3>
                            <p className="text-[12px] text-slate-600 mt-0.5 leading-relaxed font-semibold">
                                Distance of {activeDistance} km mapped dynamically by operational geofence limits ({billDetails?.zoneName || "ZipRocket Zone"}).
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* Order Summary */}
                <section>
                    <h2 className="text-[14px] text-slate-600 mb-3 px-1">Order Summary</h2>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        {cart.items.map((item, index) => (
                            <div key={item.id} className={`p-3.5 flex items-center justify-between ${index < cart.items.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                <div className="flex items-center gap-3">
                                    {item.img ? (
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-50 shrink-0 border border-slate-100 relative">
                                            <OptimizedImage
                                                src={item.img}
                                                alt={item.name}
                                                className="w-full h-full object-cover mix-blend-multiply"
                                                preset="thumbnail"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                                            {cart.orderType === 'grocery' ? (
                                                <MdShoppingBag className="text-slate-350 text-xl" />
                                            ) : (
                                                <MdFastfood className="text-slate-350 text-xl" />
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-medium text-[14px] text-slate-900 line-clamp-1">{item.name}</h3>
                                        <p className="text-[12px] text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                                    </div>
                                </div>
                                <span className="font-medium text-[14px] text-slate-900">₹{item.price * item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Coupons & Loyalty System */}
                <section className="space-y-3">
                    <h2 className="text-[14px] text-slate-600 px-1">Offers & Benefits</h2>

                    {appliedCouponCode ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <MdSell className="text-[20px]" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-emerald-600 text-white font-extrabold text-[11px] rounded tracking-wider uppercase">{appliedCouponCode}</span>
                                        <span className="text-[11px] text-emerald-700 font-bold">Applied!</span>
                                    </div>
                                    <p className="text-[13px] text-slate-700 font-bold mt-1">Saved ₹{billDetails?.discountAmount || 0} on this order</p>
                                </div>
                            </div>
                            <button
                                onClick={handleRemoveCoupon}
                                className="text-xs text-rose-600 font-extrabold hover:text-rose-700 uppercase tracking-wider transition-all px-3 py-1.5 hover:bg-rose-50 rounded-lg"
                            >
                                Remove
                            </button>
                        </div>
                    ) : availableCoupons.length > 0 ? (
                        <div className="bg-[#fff9e6] border border-[#ffe0b3] rounded-xl p-4 flex items-center justify-between shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#fff0e6] text-[#a73a00] flex items-center justify-center">
                                    <MdCelebration className="text-[20px]" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 border border-dashed border-[#a73a00] text-[#a73a00] font-black text-xs rounded uppercase tracking-widest">{availableCoupons[0].code}</span>
                                        <span className="text-[11px] text-emerald-700 font-extrabold">Save ₹{availableCoupons[0].estimatedDiscount}!</span>
                                    </div>
                                    <p className="text-[12px] text-slate-600 mt-1 font-semibold line-clamp-1">{availableCoupons[0].description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleApplyCoupon(availableCoupons[0].code)}
                                disabled={applyingCoupon}
                                className="px-4 py-2 bg-gradient-to-r from-[#FF5C00] to-[#e05200] text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Apply
                            </button>
                        </div>
                    ) : null}

                    <div
                        onClick={() => setIsCouponDrawerOpen(true)}
                        className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-200 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-[#FF5C00] shrink-0 mt-0.5">
                                <MdSell className="text-[20px]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[14px] text-slate-800 leading-tight">Coupons & Promo Offers</h3>
                                <p className="text-[12px] text-slate-500 mt-1 font-medium">
                                    {availableCoupons.length > 0
                                        ? `Select from ${availableCoupons.length} applicable coupons to save more`
                                        : "View restaurant and zone discount promos"}
                                </p>
                            </div>
                        </div>
                        <MdChevronRight className="text-slate-400 text-sm shrink-0" />
                    </div>
                </section>

                {/* Payment Method Selectors */}
                <section>
                    <h2 className="text-[14px] text-slate-600 mb-3 px-1">Payment Method</h2>
                    <div className="space-y-3">
                        {/* ONLINE */}
                        <div
                            onClick={() => !checkoutError && !isCheckoutDisabled && setPaymentMethod('ONLINE')}
                            className={`bg-white rounded-xl p-3.5 shadow-sm border transition-all flex items-center justify-between cursor-pointer ${(checkoutError || isCheckoutDisabled) ? 'opacity-50 cursor-not-allowed' : ''
                                } ${paymentMethod === 'ONLINE' && !checkoutError && !isCheckoutDisabled ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/20' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${paymentMethod === 'ONLINE' && !checkoutError && !isCheckoutDisabled ? 'bg-[#FF5C00]/10 text-[#FF5C00]' : 'bg-slate-100 text-slate-500'}`}>
                                    <MdAccountBalanceWallet className="text-[20px]" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-[14px] text-slate-900 leading-tight">UPI / Online Payment</h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5 pr-4">Pay instantly using Google Pay, PhonePe, Cards or NetBanking</p>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'ONLINE' && !checkoutError && !isCheckoutDisabled ? 'border-[#FF5C00]' : 'border-slate-355'}`}>
                                {paymentMethod === 'ONLINE' && !checkoutError && !isCheckoutDisabled && <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C00]"></div>}
                            </div>
                        </div>

                        {/* CASH ON DELIVERY (COD) */}
                        <div
                            onClick={() => !checkoutError && !isCheckoutDisabled && setPaymentMethod('COD')}
                            className={`bg-white rounded-xl p-3.5 shadow-sm border transition-all flex items-center justify-between cursor-pointer ${(checkoutError || isCheckoutDisabled) ? 'opacity-50 cursor-not-allowed' : ''
                                } ${paymentMethod === 'COD' && !checkoutError && !isCheckoutDisabled ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/20' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${paymentMethod === 'COD' && !checkoutError && !isCheckoutDisabled ? 'bg-[#FF5C00]/10 text-[#FF5C00]' : 'bg-slate-100 text-slate-500'}`}>
                                    <MdPayments className="text-[20px]" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-[14px] text-slate-900 leading-tight">Cash on Delivery (COD)</h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5 pr-4">Pay in cash or scan QR code on delivery</p>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'COD' && !checkoutError && !isCheckoutDisabled ? 'border-[#FF5C00]' : 'border-slate-355'}`}>
                                {paymentMethod === 'COD' && !checkoutError && !isCheckoutDisabled && <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C00]"></div>}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bill Details */}
                <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <h2 className="font-medium text-[15px] text-slate-900 mb-4">Bill Details</h2>
                    {loadingBill ? (
                        <div className="space-y-3.5">
                            <div className="h-4 bg-slate-50 rounded animate-pulse" />
                            <div className="h-4 bg-slate-50 rounded animate-pulse w-5/6" />
                            <div className="h-4 bg-slate-50 rounded animate-pulse w-3/4" />
                            <div className="h-6 bg-slate-100 rounded animate-pulse pt-2" />
                        </div>
                    ) : checkoutError ? (
                        <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                            Fares unavailable because selected location lies outside service area limits.
                        </div>
                    ) : (
                        <div className="space-y-2.5 text-[13px]">
                            <div className="flex justify-between text-slate-600">
                                <span>Item Total</span>
                                <span className="text-slate-900 font-medium">₹{(Number(billDetails?.itemTotal ?? itemTotal) || 0).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between text-slate-600">
                                <span>Delivery Fee</span>
                                <span className="text-slate-900 font-medium">₹{(Number(activeDeliveryFee) || 0).toFixed(2)}</span>
                            </div>

                            {billDetails && Number(billDetails.smallOrderFee) > 0 && (
                                <div className="flex justify-between text-[#FF5C00]">
                                    <span>Small Order Handling Fee</span>
                                    <span className="font-medium">₹{(Number(billDetails.smallOrderFee) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            {billDetails && Number(billDetails.platformFee) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Platform Fee</span>
                                    <span className="text-slate-900 font-medium">₹{(Number(billDetails.platformFee) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            {billDetails && Number(billDetails.packagingCharge) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Packaging Charge</span>
                                    <span className="text-slate-900 font-medium">₹{(Number(billDetails.packagingCharge) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            {billDetails && Number(billDetails.convenienceFee) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Convenience Fee</span>
                                    <span className="text-slate-900 font-medium">₹{(Number(billDetails.convenienceFee) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            {billDetails && Number(billDetails.surgeCharge) > 0 && (
                                <div className="flex justify-between text-[#c2410c] font-semibold animate-pulse">
                                    <span className="flex items-center gap-1">
                                        <MdThunderstorm className="text-[15px]" />
                                        Surge Surcharge Active
                                    </span>
                                    <span>₹{(Number(billDetails.surgeCharge) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-slate-600">
                                <span>Taxes (GST/Service)</span>
                                <span className="text-slate-900 font-medium">₹{(Number(activeGST) || 0).toFixed(2)}</span>
                            </div>

                            {billDetails && billDetails.discountAmount !== undefined && Number(billDetails.discountAmount) > 0 && (
                                <div className="flex justify-between text-emerald-600 font-extrabold animate-pulse bg-emerald-50/50 p-2.5 rounded-xl border border-dashed border-emerald-200">
                                    <span className="flex items-center gap-1.5">
                                        <MdSell className="text-[16px]" />
                                        Coupon Discount ({appliedCouponCode})
                                    </span>
                                    <span>-₹{(Number(billDetails.discountAmount) || 0).toFixed(2)}</span>
                                </div>
                            )}

                            <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex justify-between">
                                <div>
                                    <span className="font-medium text-[15px] text-slate-900 block">Total To Pay</span>
                                    {billDetails?.zoneName && (
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            Calculated at {billDetails.zoneName}
                                        </span>
                                    )}
                                </div>
                                <span className="font-medium text-[16px] text-[#FF5C00]">₹{(Number(activeGrandTotal) || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Bottom Fixed Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 p-4 pb-safe z-50">
                <button
                    onClick={handlePlaceOrder}
                    disabled={placingOrder || loadingBill || !!checkoutError || isCheckoutDisabled}
                    className={`w-full bg-[#FF5C00] hover:bg-[#e05200] text-white rounded-xl py-3.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-sm font-bold ${placingOrder || loadingBill || !!checkoutError || isCheckoutDisabled ? 'opacity-70 cursor-not-allowed bg-slate-350 hover:bg-slate-350' : ''
                        }`}
                >
                    <span className="font-medium text-[15px]">
                        {isCheckoutDisabled
                            ? 'Ordering is unavailable'
                            : checkoutError
                                ? 'Outside Delivery Service Area'
                                : loadingBill
                                    ? 'Calculating dynamic fares...'
                                    : placingOrder
                                        ? 'Processing...'
                                        : (paymentMethod === 'ONLINE' ? 'Pay & Place Order' : 'Place Order')}
                    </span>
                    {!placingOrder && !loadingBill && !checkoutError && !isCheckoutDisabled && <MdArrowForward className="text-[20px]" />}
                </button>
                <p className="text-center text-[10px] text-slate-500 mt-2.5">
                    By placing this order, you agree to our Terms & Conditions
                </p>
            </div>

            {/* Premium Glassmorphic Address & Phone Edit Modal */}
            {isAddressEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[28px] w-[460px] max-w-[92vw] min-w-[320px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col shrink-0 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
                            <div>
                                <h3 className="font-extrabold text-[18px] text-slate-900 tracking-tight">
                                    {checkoutAddressStep === 'select' ? 'डिलिवरी पता चुनें / Select Delivery Address' : 'Location Details'}
                                </h3>
                                <p className="text-[10px] text-[#FF5C00] font-black uppercase tracking-wider mt-0.5">ZipRocket Hyperlocal Logistics</p>
                            </div>
                            <button
                                onClick={() => setIsAddressEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-450 transition-colors"
                            >
                                <MdClose className="text-[18px]" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        {checkoutAddressStep === 'select' ? (
                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Select a Saved Address</h4>
                                {savedAddresses.length === 0 ? (
                                    <div className="bg-slate-50 rounded-2xl p-6 text-center text-xs text-slate-400 font-semibold border border-slate-100">
                                        No saved addresses found.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {savedAddresses.map((addr) => {
                                            const isSelected = selectedAddressId === addr._id;
                                            let IconComp = MdHome;
                                            if (addr.label === 'Work') IconComp = MdWork;
                                            if (addr.label === 'Other') IconComp = MdHomeWork;

                                            return (
                                                <div 
                                                    key={addr._id}
                                                    onClick={() => handleSelectSavedAddress(addr)}
                                                    className={`p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-start ${
                                                        isSelected 
                                                            ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/15' 
                                                            : 'border-slate-100 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'bg-[#FF5C00]/10 text-[#FF5C00]' : 'bg-slate-100 text-slate-550'
                                                        }`}>
                                                            <IconComp className="text-[18px]" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-[14px] text-slate-800 leading-none">{addr.label}</span>
                                                                {addr.isDefault && (
                                                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded">Default</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[12px] text-slate-500 mt-1.5 leading-snug line-clamp-2 pr-4">{addr.fullAddress}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                        isSelected ? 'border-[#FF5C00]' : 'border-slate-300'
                                                    }`}>
                                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C00]"></div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setCheckoutAddressStep('form')}
                                    className="w-full mt-4 py-3.5 bg-[#FF5C00]/10 hover:bg-[#FF5C00]/15 text-[#FF5C00] rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <MdAdd className="text-[18px]" />
                                    Add New Delivery Address
                                </button>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4.5 max-h-[60vh] overflow-y-auto">
                                {editError && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2.5 items-start text-rose-700">
                                        <MdError className="text-[18px] shrink-0 mt-0.5" />
                                        <p className="text-[12px] font-bold leading-relaxed">{editError}</p>
                                    </div>
                                )}

                                {/* Tag segmented control */}
                                <div className="bg-[#f0f0f4] rounded-full p-1 flex justify-between gap-1 w-full">
                                    {([
                                        { id: 'Home', label: 'House', iconComp: MdHome },
                                        { id: 'Work', label: 'Office', iconComp: MdWork },
                                        { id: 'Other', label: 'Other', iconComp: MdMyLocation }
                                    ] as const).map((tag) => {
                                        const isActive = 
                                            (tag.id === 'Home' && (addressLabel === 'Home' || addressLabel === 'House')) ||
                                            (tag.id === 'Work' && (addressLabel === 'Work' || addressLabel === 'Office')) ||
                                            (tag.id === 'Other' && (addressLabel !== 'Home' && addressLabel !== 'House' && addressLabel !== 'Work' && addressLabel !== 'Office'));
                                        const TagIcon = tag.iconComp;

                                        return (
                                            <button
                                                type="button"
                                                key={tag.id}
                                                onClick={() => {
                                                    if (tag.id === 'Home') setAddressLabel('Home');
                                                    else if (tag.id === 'Work') setAddressLabel('Work');
                                                    else setAddressLabel('Other');
                                                }}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-all ${
                                                    isActive 
                                                        ? 'bg-[#FF5C00] text-white shadow-sm' 
                                                        : 'text-slate-600 hover:text-slate-900 bg-transparent'
                                                }`}
                                            >
                                                <TagIcon className="text-[16px]" />
                                                <span>{tag.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Building / Floor input */}
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        value={houseNo}
                                        onChange={(e) => setHouseNo(e.target.value)}
                                        placeholder="Building / Floor *"
                                        className="w-full bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-3 text-[14px] text-slate-800 placeholder-slate-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/25 transition-all outline-none font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.015)]"
                                    />
                                </div>

                                {/* Street input */}
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        value={street}
                                        onChange={(e) => setStreet(e.target.value)}
                                        placeholder="Street (Recommended)"
                                        className="w-full bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-3 text-[14px] text-slate-800 placeholder-slate-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/25 transition-all outline-none font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.015)]"
                                    />
                                </div>

                                {/* Area / Locality block with map preview */}
                                <div className="relative border border-slate-200 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
                                    <span className="absolute -top-2 left-4 bg-white px-1.5 text-[11px] font-bold text-slate-400 tracking-wide">
                                        Area/Locality
                                    </span>
                                    <div className="text-[13px] text-slate-550 font-semibold leading-relaxed pr-2 max-w-[70%] text-left select-none">
                                        {mohalla || userAddress || "No location selected"}
                                    </div>
                                    
                                    {/* Mini map thumbnail */}
                                    <div 
                                        onClick={() => setIsLocationModalOpen(true)}
                                        className="w-[72px] h-[72px] rounded-xl border border-slate-200 bg-slate-50 relative overflow-hidden cursor-pointer flex flex-col items-center justify-center hover:border-[#FF5C00]/50 transition-colors shadow-sm shrink-0"
                                        style={{
                                            backgroundImage: `radial-gradient(circle, #e2e8f0 10%, transparent 11%), radial-gradient(circle, #f1f5f9 20%, transparent 21%)`,
                                            backgroundSize: '12px 12px',
                                            backgroundColor: '#f8fafc'
                                        }}
                                        title="Click to change location"
                                    >
                                        {/* CSS Grid-like Roads visual */}
                                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                                            <div className="absolute top-1/2 left-0 w-full h-[3px] bg-slate-400"></div>
                                            <div className="absolute top-0 left-1/3 w-[3px] h-full bg-slate-400"></div>
                                            <div className="absolute top-1/4 left-2/3 w-[3px] h-full bg-slate-400"></div>
                                        </div>
                                        
                                        {/* Pin Marker */}
                                        <MdLocationOn className="text-[24px] text-[#FF5C00] relative z-10 filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] animate-bounce" />
                                        
                                        {/* Change text tag */}
                                        <span className="absolute bottom-1 text-[9px] font-black text-[#FF5C00] uppercase tracking-wider bg-white/95 px-1.5 py-0.5 rounded shadow-sm z-10 border border-slate-100">
                                            Change
                                        </span>
                                    </div>
                                </div>

                                {/* Save address as input */}
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        value={addressLabel === 'Home' ? 'Home' : addressLabel === 'Work' ? 'Work' : addressLabel}
                                        onChange={(e) => setAddressLabel(e.target.value)}
                                        placeholder="Save address as *"
                                        className="w-full bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-3 text-[14px] text-slate-800 placeholder-slate-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/25 transition-all outline-none font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.015)]"
                                    />
                                </div>

                                {/* Phone Number input */}
                                <div className="space-y-1">
                                    <div className="flex bg-white border border-slate-200 rounded-xl items-center focus-within:border-[#FF5C00] focus-within:ring-1 focus-within:ring-[#FF5C00]/25 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
                                        <span className="text-[13px] text-slate-450 font-bold px-4 border-r border-slate-200">+91</span>
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={editedPhone}
                                            onChange={(e) => setEditedPhone(e.target.value.replace(/\D/g, ""))}
                                            placeholder="Contact Phone Number *"
                                            className="w-full bg-transparent p-3.5 px-4 text-[14px] text-slate-800 placeholder-slate-400 outline-none font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Collapsible instructions */}
                                <div className="pt-1">
                                    {!showInstructions ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowInstructions(true)}
                                            className="text-left text-[11.5px] font-bold text-[#FF5C00] hover:text-[#e05200] transition-colors flex items-center gap-1.5 pl-1"
                                        >
                                            <MdDescription className="text-[15px]" />
                                            Add Delivery Instructions (Optional)
                                        </button>
                                    ) : (
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                                Delivery Instructions
                                            </label>
                                            <textarea
                                                value={instructions}
                                                onChange={(e) => setInstructions(e.target.value)}
                                                placeholder="e.g. Keep at gate / Call before arrival"
                                                rows={2}
                                                className="w-full bg-white border border-slate-200 hover:border-slate-350 rounded-xl p-3.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none font-semibold resize-none focus:border-[#FF5C00] transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div>
                                {checkoutAddressStep === 'form' && savedAddresses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setCheckoutAddressStep('select')}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-550 text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        Back
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsAddressEditModalOpen(false)}
                                    disabled={validatingEdit}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-550 text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Cancel
                                </button>
                                {checkoutAddressStep === 'form' && (
                                    <button
                                        onClick={handleSaveAddressEdit}
                                        disabled={validatingEdit || !village.trim() || !mohalla.trim() || !editedPhone.trim() || !houseNo.trim()}
                                        className="px-5 py-2.5 rounded-xl bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {validatingEdit ? (
                                            <>
                                                <MdSync className="text-[16px] animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <MdSave className="text-[16px]" />
                                                Confirm Address
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sliding Coupons Drawer Modal */}
            {isCouponDrawerOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="bg-white rounded-t-[32px] sm:rounded-[28px] w-full sm:w-[480px] max-h-[85vh] sm:max-h-[75vh] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col"
                        style={{ animation: 'slideUpCard 0.4s cubic-bezier(0.34,1.26,0.64,1) both' }}
                    >
                        {/* Drag indicator for mobile */}
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 sm:hidden shrink-0" />

                        {/* Header */}
                        <div className="px-6 pb-4 pt-1 sm:pt-6 flex items-center justify-between border-b border-slate-50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-[18px] text-slate-900 tracking-tight">लागू कूपन / Available Coupons</h3>
                                <p className="text-[11px] text-[#FF5C00] font-black uppercase tracking-wider mt-0.5">Apply Promo for massive savings</p>
                            </div>
                            <button
                                onClick={() => { setIsCouponDrawerOpen(false); setCouponError(null); }}
                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-450 transition-colors"
                            >
                                <MdClose className="text-[18px]" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Manual Apply Input */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">कूपन कोड दर्ज करें (Enter Coupon Code)</label>
                                <div className="flex bg-slate-50 border border-slate-200 rounded-2xl items-center focus-within:border-[#FF5C00] focus-within:ring-1 focus-within:ring-[#FF5C00]/25 transition-all pr-2">
                                    <input
                                        type="text"
                                        value={couponInputText}
                                        onChange={(e) => setCouponInputText(e.target.value.toUpperCase())}
                                        placeholder="ENTER PROMO CODE (e.g. WELCOME50)"
                                        disabled={applyingCoupon}
                                        className="w-full bg-transparent p-3.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none uppercase font-bold tracking-widest"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleApplyCoupon(couponInputText)}
                                        disabled={applyingCoupon || !couponInputText.trim()}
                                        className="px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                                    >
                                        {applyingCoupon ? "Applying..." : "Apply"}
                                    </button>
                                </div>
                            </div>

                            {couponError && (
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2.5 items-start text-rose-700">
                                    <MdError className="text-[18px] shrink-0 mt-0.5" />
                                    <p className="text-[12px] font-bold leading-relaxed">{couponError}</p>
                                </div>
                            )}

                            {/* List of Applicable Coupons */}
                            {availableCoupons.length > 0 && (
                                <div className="space-y-3.5">
                                    <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">✅ लागू करने के लिए उपलब्ध (Applicable Coupons)</h4>
                                    {availableCoupons.map((coupon) => (
                                        <div
                                            key={coupon._id}
                                            className="bg-emerald-50/30 border border-dashed border-emerald-350 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-extrabold px-3 py-1 rounded-bl-xl tracking-wider uppercase">
                                                SAVE ₹{coupon.estimatedDiscount}
                                            </div>
                                            <div className="flex items-start gap-2.5">
                                                <div className="px-2.5 py-1 bg-white border border-dashed border-emerald-600 text-emerald-700 text-xs font-black rounded uppercase tracking-wider">
                                                    {coupon.code}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="font-extrabold text-[13px] text-slate-850">{coupon.title}</h5>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-semibold">{coupon.description}</p>
                                            </div>
                                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 text-[11px]">
                                                <span className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1">
                                                    <MdCheckCircle className="text-[14px]" />
                                                    Eligible for this order
                                                </span>
                                                <button
                                                    onClick={() => handleApplyCoupon(coupon.code)}
                                                    disabled={applyingCoupon}
                                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-transform active:scale-95 shrink-0 shadow-sm"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* List of Unapplicable Coupons */}
                            {unapplicableCoupons.length > 0 && (
                                <div className="space-y-3.5">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">⚠️ अयोग्य कूपन (Unapplicable Coupons)</h4>
                                    {unapplicableCoupons.map((coupon) => (
                                        <div
                                            key={coupon._id}
                                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 relative opacity-70"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <div className="px-2.5 py-1 bg-white border border-slate-350 text-slate-500 text-xs font-black rounded uppercase tracking-wider">
                                                    {coupon.code}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-[13px] text-slate-700">{coupon.title}</h5>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">{coupon.description}</p>
                                            </div>
                                            <div className="border-t border-slate-200/60 pt-3 mt-1 flex items-start gap-2 text-[10px] text-rose-600 font-bold leading-tight">
                                                <MdInfo className="text-[14px] shrink-0" />
                                                <span>{coupon.reason || "Terms & conditions not met"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {availableCoupons.length === 0 && unapplicableCoupons.length === 0 && (
                                <div className="text-center py-10 flex flex-col items-center justify-center">
                                    <MdSell className="text-[48px] text-slate-300 mb-3" />
                                    <p className="text-[13px] text-slate-500 font-bold">No coupons available / कोई कूपन उपलब्ध नहीं है</p>
                                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Keep shopping to unlock future rewards!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Location Selector Modal for Change button */}
            <LocationSelectorModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
        </div>
    );
}
