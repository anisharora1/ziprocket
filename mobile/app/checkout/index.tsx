import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { useLocation, SavedAddress } from '../../src/context/LocationContext';
import { usePlatform } from '../../src/context/PlatformContext';
import { useSocket } from '../../src/context/SocketContext';
import { useNotification } from '../../src/context/NotificationContext';
import { apiClient, isNetworkError } from '../../src/services/api';
import { getIsOnline, onReconnect } from '../../src/services/network';
import { getHighAccuracyGPSFix } from '../../src/utils/geolocation';
import OptimizedImage from '../../src/components/OptimizedImage';
import LocationSelectorModal from '../../src/components/LocationSelectorModal';
import CheckoutAddressModal from '../../src/components/CheckoutAddressModal';
import NotificationModal, { NotifCardData } from '../../src/components/NotificationModal';
import { useKeyboardHeight } from '../../src/hooks';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  Shadows,
} from '../../src/constants/theme';

interface BillDetails {
  success?: boolean;
  zoneId?: string;
  zoneName?: string;
  itemTotal: number;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  smallOrderFee?: number;
  platformFee?: number;
  packagingCharge?: number;
  convenienceFee?: number;
  gst: number;
  surgeCharge?: number;
  grandTotal: number;
  distanceKm?: number;
  durationMinutes?: number;
  discountAmount?: number;
  couponApplied?: boolean;
  couponError?: string;
  minOrderValue?: number;
  isBelowMinimum?: boolean;
  amountNeededForMinOrder?: number;
  isDeliverable?: boolean;
  reason?: string;
  message?: string;
}

const getFeasibilityErrorMessage = (reason?: string, fallbackMessage?: string): string => {
  switch (reason) {
    case 'outside_radius':
      return 'Delivery address is outside the maximum delivery radius for this vendor.';
    case 'outside_zone':
      return 'Selected location lies outside our operational delivery zones.';
    case 'invalid_location':
      return 'Please provide valid delivery coordinates. Select your location on the map.';
    case 'restaurant_location_unverified':
      return 'Restaurant location is unverified. Delivery cannot be fulfilled at this time.';
    default:
      return fallbackMessage || 'Selected location is currently not serviceable for delivery.';
  }
};

const getReasonTitle = (reason?: string | null): string => {
  switch (reason) {
    case 'outside_radius':
      return 'Outside Delivery Radius';
    case 'outside_zone':
      return 'Outside Delivery Zone';
    case 'invalid_location':
      return 'Invalid Delivery Location';
    case 'restaurant_location_unverified':
      return 'Restaurant Location Unverified';
    default:
      return 'Delivery Seema se Bahar';
  }
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const { cart, clearCart } = useCart();
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
    loadSavedAddresses,
  } = useLocation();

  const {
    settings,
    isPlatformCurrentlyOpen,
    getPlatformStatusMessage,
    isGroceryCurrentlyOpen,
    getGroceryStatusMessage,
  } = usePlatform();

  const { socket } = useSocket();
  const { promptPermission } = useNotification();

  const [placingOrder, setPlacingOrder] = useState(false);
  const placingOrderRef = useRef(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [vendorAvailability, setVendorAvailability] = useState<string>('open');

  // Notification Modal state
  const [notifCard, setNotifCard] = useState<NotifCardData | null>(null);
  const showCard = (card: NotifCardData) => setNotifCard(card);
  const closeCard = () => setNotifCard(null);

  // Out-of-zone overlay
  const [showOutOfZoneOverlay, setShowOutOfZoneOverlay] = useState(false);
  const [activeZones, setActiveZones] = useState<string[]>([]);

  // Payment method (COD forced in Stage 1)
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');

  // Address overrides and bottom sheet state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [addressStep, setAddressStep] = useState<'select' | 'form'>('select');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [houseNo, setHouseNo] = useState('');
  const [floor, setFloor] = useState('');
  const [street, setStreet] = useState('');
  const [mohalla, setMohalla] = useState('');
  const [village, setVillage] = useState('');
  const [landmark, setLandmark] = useState('');
  const [editedPincode, setEditedPincode] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [validatingEdit, setValidatingEdit] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Custom address overrides on screen
  const [customAddressText, setCustomAddressText] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState<string | null>(null);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [customPincode, setCustomPincode] = useState<string | null>(null);
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState<any | null>(null);

  // Coupon states
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [couponInputText, setCouponInputText] = useState<string>('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [unapplicableCoupons, setUnapplicableCoupons] = useState<any[]>([]);
  const [isCouponDrawerOpen, setIsCouponDrawerOpen] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Bill states
  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutReason, setCheckoutReason] = useState<string | null>(null);

  // Socket listener for real-time restaurant status changes
  useEffect(() => {
    if (!socket) return;
    const handleStatusUpdate = (data: {
      restaurantId: string;
      availabilityStatus: string;
      isActive: boolean;
    }) => {
      if (cart.orderType === 'food' && cart.vendorId === data.restaurantId) {
        if (
          data.isActive === false ||
          data.availabilityStatus === 'closed' ||
          data.availabilityStatus === 'disabled'
        ) {
          setVendorAvailability(data.availabilityStatus === 'disabled' ? 'disabled' : 'closed');
        } else {
          setVendorAvailability('open');
        }
      }
    };

    socket.on('restaurant_status_updated', handleStatusUpdate);
    return () => {
      socket.off('restaurant_status_updated', handleStatusUpdate);
    };
  }, [socket, cart.vendorId, cart.orderType]);

  // Initial fetch for food vendor availability
  const fetchVendorStatus = useCallback(async () => {
    if (cart.orderType === 'food' && cart.vendorId) {
      try {
        const res = await apiClient.get(`/restaurants/${cart.vendorId}`);
        if (res.data?.success && res.data?.restaurant) {
          const rest = res.data.restaurant;
          if (
            rest.isActive === false ||
            rest.availabilityStatus === 'closed' ||
            rest.availabilityStatus === 'disabled' ||
            rest.isCurrentlyOpen === false
          ) {
            setVendorAvailability(rest.availabilityStatus === 'disabled' ? 'disabled' : 'closed');
          } else {
            setVendorAvailability('open');
          }
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          console.warn('[Checkout] Failed checking restaurant status:', err);
        }
      }
    }
  }, [cart.vendorId, cart.orderType]);

  useEffect(() => {
    fetchVendorStatus();
  }, [fetchVendorStatus]);

  const platformMsg = getPlatformStatusMessage();
  const isCheckoutDisabled = useMemo(() => {
    if (platformMsg) return true;
    if (cart.orderType === 'grocery' && !isGroceryCurrentlyOpen()) return true;
    if (cart.orderType === 'food' && vendorAvailability !== 'open') return true;
    return false;
  }, [platformMsg, cart.orderType, isGroceryCurrentlyOpen, vendorAvailability]);

  const checkoutDisabledMessage = useMemo(() => {
    if (platformMsg) return platformMsg;
    if (cart.orderType === 'grocery') {
      return 'Grocery ordering is currently unavailable. Please try again later.';
    }
    if (cart.orderType === 'food' && vendorAvailability !== 'open') {
      return vendorAvailability === 'disabled'
        ? 'This restaurant is temporarily disabled.'
        : 'This restaurant is currently closed.';
    }
    return null;
  }, [platformMsg, cart.orderType, vendorAvailability]);

  // Unified target coordinates & location validity
  const targetCoords = customCoords || userCoords || null;
  const hasValidLocation = Boolean(
    targetCoords &&
    typeof targetCoords.lat === 'number' &&
    typeof targetCoords.lng === 'number' &&
    Number.isFinite(targetCoords.lat) &&
    Number.isFinite(targetCoords.lng) &&
    Math.abs(targetCoords.lat) <= 90 &&
    Math.abs(targetCoords.lng) <= 180 &&
    !(targetCoords.lat === 0 && targetCoords.lng === 0)
  );
  const targetAddress = customAddressText || userAddress || '';
  const targetPincode = customPincode || userPincode || '';

  const itemTotal = useMemo(
    () =>
      cart.items.reduce(
        (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
        0
      ),
    [cart.items]
  );

  // Calculate bill from backend
  const fetchBillDetails = useCallback(async () => {
    if (cart.items.length === 0) {
      setBillDetails(null);
      setLoadingBill(false);
      return;
    }

    // Do not call /delivery-zones/calculate-bill without a valid selected location
    if (!hasValidLocation || !targetCoords) {
      setBillDetails(null);
      setLoadingBill(false);
      setCheckoutError(null);
      setCheckoutReason(null);
      return;
    }

    try {
      setLoadingBill(true);
      setCheckoutError(null);
      setCheckoutReason(null);

      const payload = {
        vendorId: cart.orderType === 'food' ? cart.vendorId : 'grocery',
        items: cart.items.map((c) => ({
          menuItem: cart.orderType === 'food' ? c.id.replace('food-', '') : undefined,
          groceryItem: cart.orderType === 'grocery' ? c.id.replace('groc-', '') : undefined,
          price: c.price,
          quantity: c.quantity,
        })),
        userLat: targetCoords.lat,
        userLng: targetCoords.lng,
        orderType: cart.orderType || 'food',
        pincode: targetPincode,
        address: {
          fullAddress: targetAddress,
          pincode: targetPincode,
          lat: targetCoords.lat,
          lng: targetCoords.lng,
        },
        couponCode: appliedCouponCode || undefined,
        userId: user?._id || undefined,
      };

      const res = await apiClient.post('/delivery-zones/calculate-bill', payload);
      if (res.data?.success && res.data?.isDeliverable !== false) {
        setBillDetails({
          ...res.data,
          isDeliverable: true,
        });
        if (appliedCouponCode && res.data.couponError) {
          setCouponError(res.data.couponError);
          setCouponSuccessMessage(null);
          setAppliedCouponCode('');
        } else if (appliedCouponCode && res.data.couponApplied) {
          setCouponSuccessMessage(`Coupon '${appliedCouponCode}' lag gaya! Badi bachat 🎉`);
          setCouponError(null);
        }
        setCheckoutError(null);
        setCheckoutReason(null);
      } else {
        const reason = res.data?.reason;
        const message = getFeasibilityErrorMessage(reason, res.data?.message);
        setCheckoutError(message);
        setCheckoutReason(reason || null);
        setBillDetails(null);
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Failed to calculate bill details:', err);
      }
      if (isNetworkError(err) || !getIsOnline()) {
        setCheckoutError("You're offline. Connect to the internet to calculate your bill.");
        setCheckoutReason(null);
      } else {
        const reason = err.response?.data?.reason;
        const message = getFeasibilityErrorMessage(reason, err.response?.data?.message);
        setCheckoutError(message);
        setCheckoutReason(reason || null);
      }
      setBillDetails(null);
    } finally {
      setLoadingBill(false);
    }
  }, [
    cart.items,
    cart.vendorId,
    cart.orderType,
    hasValidLocation,
    targetCoords,
    targetAddress,
    targetPincode,
    appliedCouponCode,
    user?._id,
  ]);

  useEffect(() => {
    fetchBillDetails();
  }, [fetchBillDetails]);

  // Fetch available coupons
  const fetchAvailableCoupons = useCallback(async () => {
    if (!billDetails?.zoneId) return;
    try {
      const res = await apiClient.post('/coupons/available', {
        userId: user?._id,
        subtotal: itemTotal,
        zoneId: billDetails.zoneId,
        restaurantId: cart.orderType === 'food' ? cart.vendorId : undefined,
        orderType: cart.orderType || 'food',
      });
      if (res.data?.success) {
        setAvailableCoupons(res.data.applicable || []);
        setUnapplicableCoupons(res.data.unapplicable || []);
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Failed fetching available coupons:', err);
      }
    }
  }, [billDetails?.zoneId, itemTotal, user?._id, cart.orderType, cart.vendorId]);

  useEffect(() => {
    fetchAvailableCoupons();
  }, [fetchAvailableCoupons]);

  // Auto-reload data when connection returns
  useEffect(() => {
    const unsub = onReconnect(() => {
      fetchVendorStatus();
      fetchBillDetails();
      fetchAvailableCoupons();
    });
    return unsub;
  }, [fetchVendorStatus, fetchBillDetails, fetchAvailableCoupons]);

  const handleApplyCoupon = async (code: string) => {
    if (!code.trim()) return;
    if (!getIsOnline()) {
      setCouponError("You're offline. Connect to the internet to apply coupon.");
      return;
    }
    setApplyingCoupon(true);
    setCouponError(null);
    setCouponSuccessMessage(null);
    try {
      const res = await apiClient.post('/coupons/validate', {
        code: code.toUpperCase().trim(),
        userId: user?._id,
        subtotal: itemTotal,
        zoneId: billDetails?.zoneId,
        restaurantId: cart.orderType === 'food' ? cart.vendorId : undefined,
        orderType: cart.orderType || 'food',
      });
      if (res.data?.success) {
        setAppliedCouponCode(res.data.couponCode);
        setCouponSuccessMessage(res.data.message);
        setCouponInputText('');
        setIsCouponDrawerOpen(false);
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Coupon apply error:', err);
      }
      setCouponError(
        isNetworkError(err)
          ? "You're offline. Connect to the internet to apply coupon."
          : err.response?.data?.message || 'Invalid coupon code.'
      );
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode('');
    setCouponSuccessMessage(null);
    setCouponError(null);
  };

  // Derived values directly from server bill (no fallback fee/tax/distance)
  const serverDeliveryFee =
    billDetails?.deliveryFee !== undefined ? Number(billDetails.deliveryFee) : null;
  const serverGST = billDetails?.gst !== undefined ? Number(billDetails.gst) : null;
  const serverGrandTotal =
    billDetails?.grandTotal !== undefined ? Number(billDetails.grandTotal) : null;
  const serverDistanceKm =
    billDetails?.distanceKm !== undefined ? Number(billDetails.distanceKm) : null;
  const serverDurationMinutes =
    billDetails?.durationMinutes !== undefined ? Number(billDetails.durationMinutes) : null;

  const activeFreeDeliveryThreshold = Number(billDetails?.freeDeliveryThreshold) || 0;
  const amountNeededForFreeDelivery = activeFreeDeliveryThreshold - itemTotal;
  const isEligibleForFreeDeliveryNudge =
    serverDeliveryFee !== null &&
    serverDeliveryFee > 0 &&
    amountNeededForFreeDelivery > 0 &&
    activeFreeDeliveryThreshold > 0;

  const activeMinOrderValue =
    billDetails?.minOrderValue !== undefined
      ? Number(billDetails.minOrderValue)
      : cart.orderType === 'food'
        ? settings?.minOrderValueFood || 0
        : settings?.minOrderValueGrocery || 0;
  const isBelowMinimum =
    billDetails?.isBelowMinimum !== undefined
      ? Boolean(billDetails.isBelowMinimum)
      : itemTotal < activeMinOrderValue;
  const amountNeededForMinOrder =
    billDetails?.amountNeededForMinOrder !== undefined
      ? Number(billDetails.amountNeededForMinOrder)
      : isBelowMinimum
        ? Math.max(0, activeMinOrderValue - itemTotal)
        : 0;

  // Auto-redirect effect for notifCard
  useEffect(() => {
    if (!notifCard?.redirectTo || !notifCard?.redirectDelay) return;
    const t = setTimeout(() => {
      setNotifCard(null);
      router.replace(notifCard.redirectTo as any);
    }, notifCard.redirectDelay);
    return () => clearTimeout(t);
  }, [notifCard, router]);

  // Address picker open helper
  const handleOpenAddressModal = () => {
    setEditError(null);
    setGpsCoords(customCoords || userCoords || null);
    setEditedPhone(customPhone || user?.phone || '');
    setEditedPincode(customPincode || userPincode || '');

    // Prefill locality and village from context / active location
    setMohalla(userAddress || '');
    setVillage(userCity || '');

    // Floor and House No
    setHouseNo('');
    setFloor('');
    setStreet('');
    setLandmark('');
    setInstructions('');
    setAddressLabel('Home');
    setShowInstructions(false);

    setAddressStep(savedAddresses.length > 0 ? 'select' : 'form');
    setIsAddressModalOpen(true);
  };

  // Auto-sync context coordinates and address changes to form inputs
  useEffect(() => {
    if (isAddressModalOpen && addressStep === 'form') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (userAddress) setMohalla(userAddress);
      if (userCity) setVillage(userCity);
      if (userPincode) setEditedPincode(userPincode);
      if (userCoords) setGpsCoords(userCoords);
    }
  }, [userAddress, userCity, userPincode, userCoords, isAddressModalOpen, addressStep]);

  const handleSelectSavedAddress = async (addr: SavedAddress) => {
    await setSelectedAddress(addr);
    setCustomAddressText(null);
    setCustomPhone(null);
    setCustomCoords(null);
    setCustomPincode(null);
    setCustomDeliveryAddress(null);
    setIsAddressModalOpen(false);
  };

  const handleDetectGPS = async () => {
    setDetectingGps(true);
    setEditError(null);
    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 6000,
        accuracyThresholdMeters: 150,
      });

      const { latitude, longitude } = fix.coords;
      setGpsCoords({ lat: latitude, lng: longitude });

      try {
        const res = await apiClient.get(
          `/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`
        );
        if (res.data?.success && res.data?.details) {
          const details = res.data.details;
          if (details.pincode) setEditedPincode(details.pincode);
          if (details.city) setVillage(details.city);
          if (details.fullAddress) {
            const comps = details.fullAddress.split(', ');
            if (comps.length > 1) {
              setMohalla(comps[0] + ', ' + comps[1]);
            } else {
              setMohalla(details.fullAddress);
            }
          }
        }
      } catch (geoErr) {
        console.warn('GPS reverse geocode error:', geoErr);
      }
    } catch (err: any) {
      setEditError(err.message || 'GPS location nahi mil saka. Kripya location permission check karein.');
    } finally {
      setDetectingGps(false);
    }
  };

  const handleSaveAddressEdit = async () => {
    if (!getIsOnline()) {
      setEditError("You're offline. Connect to the internet to save your address.");
      return;
    }
    if (!mohalla.trim()) return setEditError("Area / Locality zaroori hai. Location select karne ke liye 'Change' par click karein.");
    if (!village.trim()) return setEditError('Gaon / Shehar (Village/City) enter karein.');
    if (!houseNo.trim()) return setEditError('Building / Floor / Makan No. enter karein.');
    if (!editedPhone.trim()) return setEditError('Mobile number daalna zaroori hai.');
    if (editedPhone.length < 10) return setEditError('Kripya sahi 10-digit mobile number enter karein.');

    const finalLandmark = landmark.trim() || 'N/A';
    const combinedHouseNo = floor.trim() ? `${houseNo.trim()}, Floor: ${floor.trim()}` : houseNo.trim();

    const addressTextVal = [
      combinedHouseNo ? `House/Flat No: ${combinedHouseNo}` : '',
      street.trim() ? `Road: ${street.trim()}` : '',
      mohalla.trim() ? mohalla.trim() : '',
      village.trim() ? `Village: ${village.trim()}` : '',
      finalLandmark && finalLandmark !== 'N/A' ? `Near: ${finalLandmark}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    setValidatingEdit(true);
    setEditError(null);

    const activeLat = gpsCoords?.lat ?? userCoords?.lat;
    const activeLng = gpsCoords?.lng ?? userCoords?.lng;

    if (activeLat === undefined || activeLng === undefined) {
      setEditError('Location coordinates missing hain. Kripya location dobara select karein.');
      setValidatingEdit(false);
      return;
    }

    const payload = {
      label: addressLabel,
      location: { lat: activeLat, lng: activeLng },
      deliveryAddress: {
        houseNumber: combinedHouseNo,
        street: street.trim(),
        locality: mohalla.trim(),
        village: village.trim(),
        landmark: finalLandmark,
        pincode: editedPincode,
        instructions: instructions.trim(),
      },
      isDefault: false,
    };

    if (user) {
      try {
        const res = await apiClient.post('/addresses', payload);
        if (res.data?.success) {
          await loadSavedAddresses();
          if (res.data.address) {
            await setSelectedAddress(res.data.address);
          }
          setCustomAddressText(null);
          setCustomPhone(null);
          setCustomCoords(null);
          setCustomPincode(null);
          setCustomDeliveryAddress(null);
          setIsAddressModalOpen(false);
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          console.warn('Save address error:', err);
        }
        setEditError(
          isNetworkError(err)
            ? "You're offline. Connect to the internet to save your address."
            : err.response?.data?.message || 'Address save nahi ho paya.'
        );
      } finally {
        setValidatingEdit(false);
      }
    } else {
      // Guest flow
      const guestAddress: SavedAddress = {
        _id: 'guest-manual-coords',
        label: addressLabel,
        location: { lat: activeLat, lng: activeLng },
        deliveryAddress: payload.deliveryAddress,
        fullAddress: addressTextVal,
        pincode: editedPincode || '000000',
        city: village || 'Unknown',
        state: 'Punjab',
        deliveryZone: billDetails?.zoneId || undefined,
        isDefault: false,
      };
      await setSelectedAddress(guestAddress);
      setCustomAddressText(addressTextVal);
      setCustomPhone(editedPhone);
      setCustomCoords({ lat: activeLat, lng: activeLng });
      setCustomPincode(editedPincode);
      setCustomDeliveryAddress(payload.deliveryAddress);
      setIsAddressModalOpen(false);
      setValidatingEdit(false);
    }
  };

  // Place order logic
  const handlePlaceOrder = async () => {
    if (placingOrderRef.current || placingOrder) return;

    if (!getIsOnline()) {
      showCard({
        type: 'error',
        title: 'Offline',
        message: "You're offline. Connect to the internet to place your order.",
      });
      return;
    }

    if (isCheckoutDisabled) {
      showCard({
        type: 'error',
        title: 'Ordering Uplabdh Nahi Hai',
        message: checkoutDisabledMessage || 'Ordering abhi ke liye band hai.',
      });
      return;
    }

    if (cart.items.length === 0) {
      showCard({
        type: 'warning',
        title: 'Cart Khali Hai',
        message: 'Order place karne se pehle kripya cart mein items jodein.',
      });
      return;
    }

    if (!user) {
      showCard({
        type: 'error',
        title: 'Login Zaroori Hai',
        message: 'Order karne ke liye kripya pehle login karein.',
        onAction: () => router.push('/(auth)/login'),
        actionLabel: 'Login Karein',
      });
      return;
    }

    if (checkoutError) {
      if (!getIsOnline()) {
        showCard({
          type: 'error',
          title: 'Offline',
          message: "You're offline. Connect to the internet to place your order.",
        });
        return;
      }
      try {
        const zonesRes = await apiClient.get('/delivery-zones');
        const zones = zonesRes.data?.zones || zonesRes.data || [];
        setActiveZones(zones.map((z: any) => z.name || z.zoneName).filter(Boolean));
      } catch {
        setActiveZones([]);
      }
      setShowOutOfZoneOverlay(true);
      return;
    }

    if (!hasValidLocation || !targetCoords) {
      showCard({
        type: 'warning',
        title: 'Address Zaroori Hai',
        message: 'Kripya delivery ke liye sahi address chunein ya naya address daalein.',
        onAction: () => handleOpenAddressModal(),
        actionLabel: 'Address Chunein',
      });
      return;
    }

    if (!billDetails || billDetails.isDeliverable !== true) {
      showCard({
        type: 'warning',
        title: getReasonTitle(checkoutReason),
        message: checkoutError || 'Selected location is currently not serviceable for delivery.',
      });
      return;
    }

    const savedAddressObj = selectedAddressId
      ? savedAddresses.find((a) => a._id === selectedAddressId)
      : null;
    const savedDeliveryAddr = savedAddressObj?.deliveryAddress || null;
    const targetLocationSource = savedAddressObj?.locationSource || 'manual';
    const targetDeliveryAddress =
      customDeliveryAddress || savedDeliveryAddr || userDeliveryAddress || undefined;

    if (!targetDeliveryAddress || !targetDeliveryAddress.houseNumber || !targetDeliveryAddress.landmark) {
      showCard({
        type: 'warning',
        title: 'Pura Address Zaroori Hai',
        message:
          'Order place karne ke liye kripya apna pura delivery address (Makan No, Landmark, etc.) darj karein.',
        onAction: () => handleOpenAddressModal(),
        actionLabel: 'Address Details Daalein',
      });
      return;
    }

    // Double-tap protection
    placingOrderRef.current = true;
    setPlacingOrder(true);

    try {
      const orderItems = cart.items.map((c) => ({
        menuItem: cart.orderType === 'food' ? c.id.replace('food-', '') : undefined,
        groceryItem: cart.orderType === 'grocery' ? c.id.replace('groc-', '') : undefined,
        quantity: c.quantity,
        price: c.price,
      }));

      // COD Path with server-verified bill and unified target coordinates
      const orderRes = await apiClient.post('/orders', {
        user: user._id,
        restaurant: cart.orderType === 'food' ? cart.vendorId : undefined,
        items: orderItems,
        totalAmount: Number(billDetails.grandTotal) + (billDetails.discountAmount || 0),
        deliveryCharge: Number(billDetails.deliveryFee),
        paymentMethod: 'COD',
        distance: Number(billDetails.distanceKm) || 0,
        address: {
          fullAddress: targetAddress,
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          locationSource: targetLocationSource,
          deliveryAddress: targetDeliveryAddress,
        },
        phone: customPhone || user?.phone || '',
        orderType: cart.orderType,
        couponCode: appliedCouponCode || undefined,
      });

      if (orderRes.data?.success) {
        setOrderPlaced(true);
        clearCart();
        promptPermission('order_placed');
        showCard({
          type: 'success',
          title: '🎉 Order Confirm Ho Gaya!',
          message:
            'Aapka Cash on Delivery order successfully place ho gaya hai. Aap ise Orders section mein live track kar sakte hain.',
          onAction: () => router.replace('/(tabs)/orders' as any),
          actionLabel: 'Order Track Karein',
          redirectTo: '/(tabs)/orders',
          redirectDelay: 2500,
        });
      } else {
        throw new Error(orderRes.data?.message || 'Order place nahi ho paya.');
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Place order error:', err);
      }
      const serverReason = err.response?.data?.reason;
      if (serverReason) {
        const specificMsg = getFeasibilityErrorMessage(serverReason, err.response?.data?.message);
        setCheckoutError(specificMsg);
        setCheckoutReason(serverReason);
        showCard({
          type: 'error',
          title: getReasonTitle(serverReason),
          message: specificMsg,
        });
      } else {
        showCard({
          type: 'error',
          title: isNetworkError(err) ? 'Offline' : 'Order Fail Ho Gaya',
          message: isNetworkError(err)
            ? "You're offline. Connect to the internet to place your order."
            : err.response?.data?.message || err.message || 'Order place karne me dikkat aayi.',
        });
      }
    } finally {
      placingOrderRef.current = false;
      setPlacingOrder(false);
    }
  };

  // If empty and not placed, render empty view
  if (cart.items.length === 0 && !orderPlaced) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-back" size={22} color={Colors.slate800} />
            </Pressable>
            <Text style={styles.headerTitle}>Checkout</Text>
          </View>
          <Text style={styles.headerBrand}>ZipRocket</Text>
        </View>

        <View style={styles.emptyContainer}>
          <MaterialIcons name="remove-shopping-cart" size={64} color={Colors.slate300} />
          <Text style={styles.emptyTitle}>Aapka Cart Khali Hai</Text>
          <Text style={styles.emptyDesc}>
            Checkout karne ke liye cart mein kuch items add karein.
          </Text>
          <Pressable
            style={styles.browseBtn}
            onPress={() => router.replace('/(tabs)/home' as any)}
          >
            <Text style={styles.browseBtnText}>Explore Food & Grocery</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* 1. Top App Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.slate800} />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
        </View>
        <Text style={styles.headerBrand}>ZipRocket</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
      >
        {/* 2. "Delivery ki Jankari" card */}
        <Pressable style={styles.addressCard} onPress={handleOpenAddressModal}>
          <View style={styles.addressCardLeft}>
            <View style={styles.addressIconCircle}>
              <MaterialIcons name="home" size={20} color={Colors.primary} />
            </View>
            <View style={styles.addressTextColumn}>
              <Text style={styles.addressCardHeading}>Delivery ki Jankari</Text>
              <Text style={styles.addressFullText} numberOfLines={2}>
                {hasValidLocation && targetAddress
                  ? targetAddress
                  : 'Select your delivery location'}
              </Text>
              <Text style={styles.addressPhoneText}>
                Phone: +91 {customPhone || user?.phone || 'Unavailable'}
              </Text>
            </View>
          </View>
          <View style={styles.addressActionRow}>
            <Text style={styles.addressActionText}>
              {hasValidLocation ? 'Change' : 'Select'}
            </Text>
            <MaterialIcons name="edit" size={16} color={Colors.primary} />
          </View>
        </Pressable>

        {/* Prompt banner when no valid location selected */}
        {!hasValidLocation ? (
          <Pressable
            style={styles.selectLocationPromptBanner}
            onPress={handleOpenAddressModal}
          >
            <View style={styles.selectLocationPromptLeft}>
              <View style={styles.selectLocationIconCircle}>
                <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.selectLocationPromptTitle}>
                  Select your delivery location
                </Text>
                <Text style={styles.selectLocationPromptDesc}>
                  Pata chunein taaki delivery fee aur delivery time calculate ho sake.
                </Text>
              </View>
            </View>
            <View style={styles.selectLocationPromptBtn}>
              <Text style={styles.selectLocationPromptBtnText}>Select</Text>
            </View>
          </Pressable>
        ) : null}

        {/* 3. Status Banners */}
        {/* Feasibility Warn Banner */}
        {checkoutError ? (
          <View style={styles.roseWarningBanner}>
            <View style={styles.roseIconCircle}>
              <MaterialIcons name="warning" size={16} color={Colors.rose600} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={styles.roseBannerTitle}>{getReasonTitle(checkoutReason)}</Text>
              <Text style={styles.roseBannerDesc}>{checkoutError}</Text>
            </View>
          </View>
        ) : null}

        {/* Closed Warning Banner */}
        {isCheckoutDisabled && checkoutDisabledMessage ? (
          <View style={styles.roseWarningBanner}>
            <View style={styles.roseIconCircle}>
              <MaterialIcons name="error" size={16} color={Colors.rose600} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={styles.roseBannerTitle}>Order Abhi Uplabdh Nahi Hai</Text>
              <Text style={styles.roseBannerDesc}>{checkoutDisabledMessage}</Text>
            </View>
          </View>
        ) : null}

        {/* Route-Based Distance & ETA */}
        {!loadingBill && billDetails && billDetails.isDeliverable === true && !checkoutError ? (
          <View style={styles.etaCard}>
            <View style={styles.etaCardLeft}>
              <View style={styles.emeraldIconCircle}>
                <MaterialIcons name="schedule" size={20} color={Colors.emerald600} />
              </View>
              <View>
                <Text style={styles.etaHeading}>Delivery ka Samay</Text>
                <Text style={styles.etaSub}>
                  Fulfillment Distance:{' '}
                  {serverDistanceKm !== null ? `${serverDistanceKm} km` : 'Calculating...'}
                </Text>
              </View>
            </View>
            <View style={styles.etaCardRight}>
              <Text style={styles.etaMinutes}>
                {serverDurationMinutes !== null
                  ? `${serverDurationMinutes} min me`
                  : '25 min me'}
              </Text>
              <Text style={styles.etaFastBadge}>Fast delivery</Text>
            </View>
          </View>
        ) : null}

        {/* Free Delivery or Safe Delivery Banner */}
        {loadingBill ? (
          <View style={styles.skeletonBanner} />
        ) : serverDeliveryFee === 0 && !checkoutError ? (
          <View style={styles.emeraldBanner}>
            <View style={styles.emeraldIconBadge}>
              <MaterialIcons name="celebration" size={16} color={Colors.emerald700} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={styles.emeraldBannerTitle}>
                Mubarak ho! FREE delivery lag gayi! 🎉
              </Text>
              <Text style={styles.emeraldBannerDesc}>
                Aapke order par delivery charge bilkul FREE hai.
              </Text>
            </View>
          </View>
        ) : !checkoutError && billDetails && billDetails.isDeliverable === true ? (
          <View style={styles.safeDeliveryBanner}>
            <View style={styles.safeIconBadge}>
              <MaterialIcons name="local-shipping" size={16} color={Colors.primary} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={styles.safeBannerTitle}>Surakshit & Superfast Delivery</Text>
              <Text style={styles.safeBannerDesc}>
                {serverDistanceKm !== null
                  ? `${serverDistanceKm} km doori se seedha aapke ghar tak.`
                  : 'Aapke ghar tak surakshit pahunchayenge.'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* 4. Order Items (Samaan) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Order Items (Samaan)</Text>
          <View style={styles.itemsCard}>
            {cart.items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index < cart.items.length - 1 && styles.itemRowBorder,
                ]}
              >
                <View style={styles.itemImgWrapper}>
                  {item.img ? (
                    <OptimizedImage
                      src={item.img}
                      alt={item.name}
                      preset="thumbnail"
                      style={styles.itemImg}
                      contentFit="cover"
                    />
                  ) : (
                    <MaterialIcons
                      name={cart.orderType === 'grocery' ? 'shopping-bag' : 'fastfood'}
                      size={20}
                      color={Colors.slate300}
                    />
                  )}
                </View>
                <View style={styles.itemInfoCol}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemLineTotal}>
                  ₹{(Number(item?.price) || 0) * (Number(item?.quantity) || 1)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5. Offers & Benefits */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Offers & Benefits</Text>

          {appliedCouponCode ? (
            <View style={styles.appliedCouponBanner}>
              <View style={styles.appliedCouponLeft}>
                <View style={styles.appliedCouponIcon}>
                  <MaterialIcons name="sell" size={18} color={Colors.emerald700} />
                </View>
                <View>
                  <View style={styles.appliedTagRow}>
                    <Text style={styles.appliedTagBadge}>{appliedCouponCode}</Text>
                    <Text style={styles.appliedTextSmall}>Applied!</Text>
                  </View>
                  <Text style={styles.appliedSavedText}>
                    Is order par ₹{billDetails?.discountAmount || 0} bachaye!
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleRemoveCoupon} style={styles.removeCouponBtn}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </Pressable>
            </View>
          ) : availableCoupons.length > 0 ? (
            <View style={styles.topCouponPromo}>
              <View style={styles.topCouponLeft}>
                <View style={styles.promoIconCircle}>
                  <MaterialIcons name="celebration" size={18} color={Colors.primary} />
                </View>
                <View>
                  <View style={styles.appliedTagRow}>
                    <Text style={styles.promoDashedCode}>{availableCoupons[0].code}</Text>
                    <Text style={styles.promoSaveHighlight}>
                      Save ₹{availableCoupons[0].estimatedDiscount}!
                    </Text>
                  </View>
                  <Text style={styles.promoDescText} numberOfLines={1}>
                    {availableCoupons[0].description}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.promoApplyBtn}
                onPress={() => handleApplyCoupon(availableCoupons[0].code)}
                disabled={applyingCoupon}
              >
                <Text style={styles.promoApplyBtnText}>Apply</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={styles.couponDrawerTrigger}
            onPress={() => setIsCouponDrawerOpen(true)}
          >
            <View style={styles.couponDrawerLeft}>
              <View style={styles.couponTagCircle}>
                <MaterialIcons name="sell" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.couponTriggerTitle}>Coupons & Promo Offers</Text>
                <Text style={styles.couponTriggerSub}>
                  {availableCoupons.length > 0
                    ? `Aapke liye ${availableCoupons.length} coupons uplabdh hain`
                    : 'Sabhi offers aur discount yahan dekhein'}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.slate400} />
          </Pressable>
        </View>

        {/* 6. Payment Method Selectors */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Payment ka Tarika Chunein</Text>

          {/* COD (Selected) */}
          <Pressable
            style={[
              styles.paymentCard,
              paymentMethod === 'COD' && styles.paymentCardSelected,
            ]}
            onPress={() => !checkoutError && !isCheckoutDisabled && setPaymentMethod('COD')}
          >
            <View style={styles.paymentLeft}>
              <View
                style={[
                  styles.paymentIconCircle,
                  paymentMethod === 'COD' && styles.paymentIconCircleActive,
                ]}
              >
                <MaterialIcons name="payments" size={20} color={Colors.primary} />
              </View>
              <View style={styles.paymentTextCol}>
                <Text style={styles.paymentTitle}>
                  Ghar Pahunche Tab Pay Karein (Cash on Delivery)
                </Text>
                <Text style={styles.paymentSubtitle}>
                  Order milne par cash dein ya delivery wale ko QR scan karke pay karein
                </Text>
              </View>
            </View>
            <View style={styles.radioOuter}>
              {paymentMethod === 'COD' ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>

          {/* ONLINE (Disabled in Stage 1) */}
          <View style={[styles.paymentCard, styles.paymentCardDisabled]}>
            <View style={styles.paymentLeft}>
              <View style={styles.paymentIconCircle}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={20}
                  color={Colors.slate400}
                />
              </View>
              <View style={styles.paymentTextCol}>
                <View style={styles.comingSoonRow}>
                  <Text style={styles.paymentTitleDisabled}>
                    Online Payment (UPI / QR)
                  </Text>
                  <Text style={styles.comingSoonBadge}>Jaldi aa raha hai</Text>
                </View>
                <Text style={styles.paymentSubtitle}>
                  Google Pay, PhonePe, Paytm, Amazon Pay (Stage 2 me uplabdh)
                </Text>
              </View>
            </View>
            <View style={styles.radioOuterDisabled} />
          </View>
        </View>

        {/* 7. Bill Details */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Bill Details</Text>

          {!hasValidLocation ? (
            <View style={styles.noLocationBillWrap}>
              <Text style={styles.noLocationBillText}>
                Select your delivery location to view bill details and delivery fees.
              </Text>
              <Pressable
                style={styles.selectLocationBillBtn}
                onPress={handleOpenAddressModal}
              >
                <Text style={styles.selectLocationBillBtnText}>
                  Select Delivery Location
                </Text>
              </Pressable>
            </View>
          ) : loadingBill ? (
            <View style={styles.billSkeleton}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.billLoadingText}>Calculating...</Text>
            </View>
          ) : checkoutError ? (
            <Text style={styles.billErrorText}>{checkoutError}</Text>
          ) : billDetails && billDetails.isDeliverable === true ? (
            <>
              {/* Free delivery nudge */}
              {isEligibleForFreeDeliveryNudge ? (
                <View style={styles.nudgeBox}>
                  <MaterialIcons name="local-shipping" size={18} color={Colors.emerald600} />
                  <View style={styles.nudgeTextCol}>
                    <Text style={styles.nudgeTitle}>
                      ₹{amountNeededForFreeDelivery.toFixed(0)} aur add karo, FREE delivery pao! 🚚
                    </Text>
                    <Text style={styles.nudgeSub}>
                      Bas ₹{amountNeededForFreeDelivery.toFixed(0)} ka samaan aur jodein
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Minimum order nudge */}
              {isBelowMinimum && activeMinOrderValue > 0 ? (
                <View style={styles.warningNudgeBox}>
                  <MaterialIcons name="warning" size={18} color="#D97706" />
                  <View style={styles.nudgeTextCol}>
                    <Text style={styles.warningNudgeTitle}>
                      Minimum order ke liye ₹{amountNeededForMinOrder.toFixed(0)} aur jodein
                    </Text>
                    <Text style={styles.warningNudgeSub}>
                      {cart.orderType === 'food' ? 'Food' : 'Grocery'} ke liye minimum order ₹
                      {activeMinOrderValue} hai
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Breakdown Rows */}
              <View style={styles.breakdownRows}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Item Total</Text>
                  <Text style={styles.billVal}>
                    ₹{(Number(billDetails?.itemTotal ?? itemTotal) || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Charge</Text>
                  <Text style={styles.billVal}>
                    {serverDeliveryFee !== null ? (
                      serverDeliveryFee === 0 ? (
                        <Text style={styles.freeGreen}>FREE</Text>
                      ) : (
                        `₹${serverDeliveryFee.toFixed(2)}`
                      )
                    ) : (
                      <Text style={styles.billCalculatingVal}>Calculating...</Text>
                    )}
                  </Text>
                </View>

                {billDetails && Number(billDetails.smallOrderFee) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: Colors.primary }]}>
                      Small Order Handling Fee
                    </Text>
                    <Text style={[styles.billVal, { color: Colors.primary }]}>
                      ₹{(Number(billDetails.smallOrderFee) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                {billDetails && Number(billDetails.platformFee) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Platform Fee</Text>
                    <Text style={styles.billVal}>
                      ₹{(Number(billDetails.platformFee) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                {billDetails && Number(billDetails.packagingCharge) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Packaging Charge</Text>
                    <Text style={styles.billVal}>
                      ₹{(Number(billDetails.packagingCharge) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                {billDetails && Number(billDetails.convenienceFee) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Convenience Fee</Text>
                    <Text style={styles.billVal}>
                      ₹{(Number(billDetails.convenienceFee) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                {billDetails && Number(billDetails.surgeCharge) > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { color: '#C2410C' }]}>
                      Surge Surcharge (Maang / Mausam)
                    </Text>
                    <Text style={[styles.billVal, { color: '#C2410C' }]}>
                      ₹{(Number(billDetails.surgeCharge) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Govt Tax (GST)</Text>
                  <Text style={styles.billVal}>
                    {serverGST !== null ? (
                      `₹${serverGST.toFixed(2)}`
                    ) : (
                      <Text style={styles.billCalculatingVal}>Calculating...</Text>
                    )}
                  </Text>
                </View>

                {billDetails &&
                  billDetails.discountAmount !== undefined &&
                  Number(billDetails.discountAmount) > 0 ? (
                  <View style={styles.discountRow}>
                    <Text style={styles.discountRowText}>
                      Coupon Discount ({appliedCouponCode})
                    </Text>
                    <Text style={styles.discountRowText}>
                      -₹{(Number(billDetails.discountAmount) || 0).toFixed(2)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.totalDivider} />

                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>Total To Pay</Text>
                    {billDetails?.zoneName ? (
                      <Text style={styles.zoneNotice}>
                        Calculated at {billDetails.zoneName}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.grandTotalValue}>
                    {serverGrandTotal !== null ? (
                      `₹${serverGrandTotal.toFixed(2)}`
                    ) : (
                      <Text style={styles.billCalculatingVal}>Calculating...</Text>
                    )}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* 8. Fixed Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={[
            styles.submitOrderBtn,
            (placingOrder ||
              loadingBill ||
              !hasValidLocation ||
              billDetails?.isDeliverable !== true ||
              !!checkoutError ||
              isCheckoutDisabled ||
              isBelowMinimum) &&
            styles.submitOrderBtnDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={
            placingOrder ||
            loadingBill ||
            !hasValidLocation ||
            billDetails?.isDeliverable !== true ||
            !!checkoutError ||
            isCheckoutDisabled ||
            isBelowMinimum
          }
        >
          {placingOrder ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.submitOrderText}>
              {isCheckoutDisabled
                ? 'Order abhi band hai'
                : !hasValidLocation
                  ? 'Select your delivery location'
                  : loadingBill
                    ? 'Calculating...'
                    : checkoutError
                      ? getReasonTitle(checkoutReason)
                      : isBelowMinimum
                        ? `Order ke liye ₹${amountNeededForMinOrder.toFixed(0)} aur jodein`
                        : 'Order Confirm Karein'}
            </Text>
          )}
          {!placingOrder &&
            !loadingBill &&
            hasValidLocation &&
            billDetails?.isDeliverable === true &&
            !checkoutError &&
            !isCheckoutDisabled &&
            !isBelowMinimum ? (
            <MaterialIcons name="arrow-forward" size={18} color={Colors.white} />
          ) : null}
        </Pressable>
        <Text style={styles.termsNotice}>
          By placing this order, you agree to our Terms & Conditions
        </Text>
      </View>

      {/* Location Selector Modal (opened only via Area/Locality Change button) */}
      <LocationSelectorModal
        visible={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* 2-Step Checkout Address Modal */}
      <CheckoutAddressModal
        visible={isAddressModalOpen && !isLocationModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        step={addressStep}
        setStep={setAddressStep}
        savedAddresses={savedAddresses}
        selectedAddressId={selectedAddressId}
        onSelectSavedAddress={handleSelectSavedAddress}
        addressLabel={addressLabel}
        setAddressLabel={setAddressLabel}
        houseNo={houseNo}
        setHouseNo={setHouseNo}
        floor={floor}
        setFloor={setFloor}
        street={street}
        setStreet={setStreet}
        mohalla={mohalla}
        setMohalla={setMohalla}
        village={village}
        setVillage={setVillage}
        editedPhone={editedPhone}
        setEditedPhone={setEditedPhone}
        instructions={instructions}
        setInstructions={setInstructions}
        showInstructions={showInstructions}
        setShowInstructions={setShowInstructions}
        editError={editError}
        validatingEdit={validatingEdit}
        onSaveAddress={handleSaveAddressEdit}
        onChangeLocation={() => setIsLocationModalOpen(true)}
        detectingGps={detectingGps}
        onDetectGPS={handleDetectGPS}
        userAddress={userAddress}
      />

      {/* Coupons Drawer Modal */}
      <Modal
        visible={isCouponDrawerOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setIsCouponDrawerOpen(false)}
      >
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (keyboardHeight > 0) {
                Keyboard.dismiss();
              } else {
                setIsCouponDrawerOpen(false);
              }
            }}
          />
          <View
            style={[
              styles.couponDrawerContent,
              {
                maxHeight: Math.max(
                  240,
                  windowHeight - keyboardHeight - insets.top - 16
                ),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Discounts aur Coupons</Text>
                <Text style={styles.modalSubtitle}>Bachat ke liye coupon lagayein</Text>
              </View>
              <Pressable
                onPress={() => setIsCouponDrawerOpen(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={Colors.slate600} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.couponScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Manual input */}
              <View style={styles.couponInputContainer}>
                <TextInput
                  style={styles.couponTextInput}
                  value={couponInputText}
                  onChangeText={(t) => setCouponInputText(t.toUpperCase())}
                  placeholder="Coupon code dalein"
                  placeholderTextColor={Colors.slate400}
                  autoCapitalize="characters"
                  numberOfLines={1}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (couponInputText.trim() && !applyingCoupon) {
                      handleApplyCoupon(couponInputText);
                    }
                  }}
                />
                <Pressable
                  style={[
                    styles.couponApplyBtn,
                    (!couponInputText.trim() || applyingCoupon) &&
                    styles.couponApplyBtnDisabled,
                  ]}
                  onPress={() => handleApplyCoupon(couponInputText)}
                  disabled={!couponInputText.trim() || applyingCoupon}
                >
                  <Text style={styles.couponApplyBtnText}>
                    {applyingCoupon ? 'Lag raha hai...' : 'Apply'}
                  </Text>
                </Pressable>
              </View>

              {couponError ? (
                <View style={styles.editErrorBanner}>
                  <MaterialIcons name="error" size={16} color={Colors.rose600} />
                  <Text style={styles.editErrorText}>{couponError}</Text>
                </View>
              ) : null}

              {/* Applicable Coupons */}
              {availableCoupons.length > 0 ? (
                <View style={styles.couponSectionBlock}>
                  <Text style={styles.couponSectionHeader}>
                    ✅ Aapke liye Uplabdh Coupons
                  </Text>
                  {availableCoupons.map((c) => (
                    <View key={c._id} style={styles.couponItemCard}>
                      <View style={styles.couponBadgeHeader}>
                        <View style={styles.dashedCodeBox}>
                          <Text style={styles.dashedCodeText}>{c.code}</Text>
                        </View>
                        <Text style={styles.discountPill}>
                          ₹{c.estimatedDiscount} BACHAT
                        </Text>
                      </View>
                      <Text style={styles.couponCardTitle}>{c.title}</Text>
                      <Text style={styles.couponCardDesc}>{c.description}</Text>
                      <View style={styles.couponCardFooter}>
                        <Text style={styles.couponValidText}>
                          Is order par lag sakta hai
                        </Text>
                        <Pressable
                          style={styles.applyCouponRowBtn}
                          onPress={() => handleApplyCoupon(c.code)}
                          disabled={applyingCoupon}
                        >
                          <Text style={styles.applyCouponRowBtnText}>Apply Karein</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Unapplicable Coupons */}
              {unapplicableCoupons.length > 0 ? (
                <View style={styles.couponSectionBlock}>
                  <Text style={styles.unapplicableSectionHeader}>
                    ⚠️ Anya Coupons (Jo abhi lag nahi sakte)
                  </Text>
                  {unapplicableCoupons.map((c) => (
                    <View key={c._id} style={styles.unapplicableCouponCard}>
                      <View style={styles.dashedCodeBoxMuted}>
                        <Text style={styles.dashedCodeTextMuted}>{c.code}</Text>
                      </View>
                      <Text style={styles.couponCardTitle}>{c.title}</Text>
                      <Text style={styles.couponCardDesc}>{c.description}</Text>
                      <Text style={styles.couponReasonText}>
                        {c.reason || 'Terms & conditions poori nahi hain'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Out of Zone Overlay Modal */}
      <Modal
        visible={showOutOfZoneOverlay}
        animationType="fade"
        transparent
        onRequestClose={() => setShowOutOfZoneOverlay(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.outOfZoneDialog}>
            <View style={styles.outOfZoneHeader}>
              <MaterialIcons name="location-off" size={40} color={Colors.white} />
              <Text style={styles.outOfZoneTitle}>
                {checkoutReason === 'outside_radius'
                  ? 'डिलीवरी रेडियस से बाहर'
                  : checkoutReason === 'restaurant_location_unverified'
                    ? 'लोकेशन अनवेरिफाइड'
                    : checkoutReason === 'invalid_location'
                      ? 'अमान्य लोकेशन'
                      : 'डिलीवरी उपलब्ध नहीं है'}
              </Text>
              <Text style={styles.outOfZoneSub}>
                {checkoutReason === 'outside_radius'
                  ? 'Outside Maximum Delivery Radius'
                  : checkoutReason === 'restaurant_location_unverified'
                    ? 'Restaurant Location Unverified'
                    : checkoutReason === 'invalid_location'
                      ? 'Invalid Delivery Coordinates'
                      : 'Delivery Not Available in this Area'}
              </Text>
            </View>
            <View style={styles.outOfZoneBody}>
              <Text style={styles.outOfZoneDesc}>
                {checkoutError ||
                  'Maaf karein, aapki current location hamare active delivery area se bahar hai. Hum filhal in chune hue areas mein deliver karte hain:'}
              </Text>
              {activeZones.length > 0 ? (
                <View style={styles.zoneChipsWrap}>
                  {activeZones.map((z, i) => (
                    <View key={i} style={styles.zoneChip}>
                      <Text style={styles.zoneChipText}>📍 {z}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.outOfZoneFooter}>
              <Pressable
                style={styles.changeAddrBtn}
                onPress={() => {
                  setShowOutOfZoneOverlay(false);
                  handleOpenAddressModal();
                }}
              >
                <MaterialIcons name="edit-location" size={18} color={Colors.white} />
                <Text style={styles.changeAddrBtnText}>Address Badlein</Text>
              </Pressable>
              <Pressable
                style={styles.dismissZoneBtn}
                onPress={() => setShowOutOfZoneOverlay(false)}
              >
                <Text style={styles.dismissZoneText}>Wapas Jayein</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reusable Notification Modal */}
      <NotificationModal card={notifCard} onClose={closeCard} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    height: 54,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.slate50,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.slate900,
    letterSpacing: -0.3,
  },
  headerBrand: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.2,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.cartBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.slate800,
    marginTop: Spacing.md,
  },
  emptyDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  browseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
  },
  browseBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  scrollContent: {
    backgroundColor: Colors.cartBg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: 16,
  },
  addressCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Shadows.sm,
  },
  addressCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  addressIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addressTextColumn: {
    flex: 1,
  },
  addressActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressActionText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  selectLocationPromptBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectLocationPromptLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectLocationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectLocationPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate900,
  },
  selectLocationPromptDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate600,
    marginTop: 2,
    lineHeight: 16,
  },
  selectLocationPromptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  selectLocationPromptBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  addressCardHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.slate900,
  },
  addressFullText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.slate700,
    marginTop: 3,
    lineHeight: 17,
  },
  addressPhoneText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate450,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  roseWarningBanner: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  roseIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bannerTextCol: {
    flex: 1,
  },
  roseBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.rose800,
  },
  roseBannerDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.rose600,
    marginTop: 2,
    lineHeight: 17,
  },
  etaCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  etaCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emeraldIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate800,
  },
  etaSub: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 2,
  },
  etaCardRight: {
    alignItems: 'flex-end',
  },
  etaMinutes: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.slate900,
  },
  etaFastBadge: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.emerald600,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  skeletonBanner: {
    height: 60,
    backgroundColor: Colors.slate100,
    borderRadius: BorderRadius.xl,
  },
  emeraldBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emeraldIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  emeraldBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.emerald700,
  },
  emeraldBannerDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.emerald600,
    marginTop: 2,
  },
  safeDeliveryBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  safeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  safeBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  safeBannerDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate600,
    marginTop: 2,
    lineHeight: 17,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.slate600,
    paddingHorizontal: 4,
  },
  itemsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.slate100,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate50,
  },
  itemImgWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.slate100,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImg: {
    width: '100%',
    height: '100%',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.slate900,
  },
  itemQty: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 2,
  },
  itemLineTotal: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.slate900,
  },
  appliedCouponBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appliedCouponIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedTagBadge: {
    backgroundColor: Colors.emerald600,
    color: Colors.white,
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  appliedTextSmall: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.emerald700,
  },
  appliedSavedText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.slate700,
    marginTop: 3,
  },
  removeCouponBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeCouponText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.rose600,
    textTransform: 'uppercase',
  },
  topCouponPromo: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  topCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  promoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoDashedCode: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  promoSaveHighlight: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.emerald700,
  },
  promoDescText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate600,
    marginTop: 3,
  },
  promoApplyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
  },
  promoApplyBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  couponDrawerTrigger: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  couponDrawerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  couponTagCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponTriggerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate800,
  },
  couponTriggerSub: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 2,
  },
  paymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  paymentCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  paymentCardDisabled: {
    opacity: 0.6,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconCircleActive: {
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
  },
  paymentTextCol: {
    flex: 1,
  },
  paymentTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate900,
  },
  paymentTitleDisabled: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate500,
  },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comingSoonBadge: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  paymentSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.slate500,
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterDisabled: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.slate200,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  billCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.slate100,
    ...Shadows.sm,
  },
  billHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.slate900,
    marginBottom: 12,
  },
  billSkeleton: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  noLocationBillWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  noLocationBillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: Colors.slate600,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  selectLocationBillBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  selectLocationBillBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  billCalculatingVal: {
    color: Colors.slate400,
    fontSize: 13,
  },
  billLoadingText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate500,
  },
  billErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate400,
    textAlign: 'center',
    paddingVertical: 14,
  },
  nudgeBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: BorderRadius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  warningNudgeBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  nudgeTextCol: {
    flex: 1,
  },
  nudgeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.emerald800,
  },
  nudgeSub: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.emerald600,
    marginTop: 2,
  },
  warningNudgeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#92400E',
  },
  warningNudgeSub: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#B45309',
    marginTop: 2,
  },
  breakdownRows: {
    gap: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.slate600,
  },
  billVal: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.slate900,
  },
  freeGreen: {
    color: Colors.emerald600,
    fontFamily: FontFamily.extraBold,
    fontWeight: '800',
  },
  discountRow: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.md,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountRowText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.emerald700,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.slate100,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.slate900,
  },
  zoneNotice: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.slate400,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  grandTotalValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    ...Shadows.md,
  },
  submitOrderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  submitOrderBtnDisabled: {
    backgroundColor: Colors.slate300,
  },
  submitOrderText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  termsNotice: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  couponDrawerContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.slate900,
  },
  modalSubtitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.primary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodyScroll: {
    padding: 20,
  },
  couponScrollContent: {
    paddingBottom: 20,
  },
  modalSectionLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptySavedBox: {
    backgroundColor: Colors.slate50,
    borderRadius: BorderRadius.xl,
    padding: 24,
    alignItems: 'center',
  },
  emptySavedText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate400,
  },
  savedAddressCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    ...Shadows.sm,
  },
  savedAddressCardSelected: {
    borderColor: Colors.primary,
  },
  savedCardLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  savedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedIconCircleActive: {
    backgroundColor: '#FFF0E6',
  },
  savedDetailsCol: {
    flex: 1,
  },
  savedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedLabelText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.slate800,
  },
  defaultPill: {
    backgroundColor: '#ECFDF5',
    color: Colors.emerald700,
    fontFamily: FontFamily.extraBold,
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  savedFullAddr: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 4,
    lineHeight: 16,
  },
  addNewAddressBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 92, 0, 0.10)',
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addNewAddressText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  editErrorBanner: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: BorderRadius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  editErrorText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.rose700,
    flex: 1,
  },
  detectGpsBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detectGpsText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  tagChipsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  tagChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tagChipActive: {
    backgroundColor: Colors.primary,
  },
  tagChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.slate600,
  },
  tagChipTextActive: {
    color: Colors.white,
  },
  modalInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.slate900,
    marginBottom: 10,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    marginBottom: 10,
  },
  phonePrefix: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.slate600,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.slate200,
  },
  phoneInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.slate900,
  },
  addInstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 16,
  },
  addInstText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.slate50,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBackBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.slate200,
    marginRight: 'auto',
  },
  modalBackText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.slate600,
    textTransform: 'uppercase',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.slate200,
  },
  modalCancelText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.slate600,
    textTransform: 'uppercase',
  },
  modalConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  modalConfirmBtnDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  couponInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    paddingRight: 6,
    marginBottom: 12,
  },
  couponTextInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.slate900,
  },
  couponApplyBtn: {
    backgroundColor: Colors.slate900,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  couponApplyBtnDisabled: {
    opacity: 0.4,
  },
  couponApplyBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  couponSectionBlock: {
    gap: 10,
    marginTop: 8,
  },
  couponSectionHeader: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.emerald700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unapplicableSectionHeader: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  couponItemCard: {
    backgroundColor: 'rgba(236, 253, 245, 0.4)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6EE7B7',
    borderRadius: BorderRadius.xl,
    padding: 14,
    gap: 8,
  },
  couponBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashedCodeBox: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.emerald600,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dashedCodeText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.emerald700,
  },
  discountPill: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: Colors.white,
    backgroundColor: Colors.emerald600,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  couponCardTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    color: Colors.slate800,
  },
  couponCardDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.slate500,
  },
  couponCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    paddingTop: 8,
  },
  couponValidText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.emerald700,
  },
  applyCouponRowBtn: {
    backgroundColor: Colors.emerald600,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  applyCouponRowBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  unapplicableCouponCard: {
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    padding: 14,
    gap: 6,
    opacity: 0.7,
  },
  dashedCodeBoxMuted: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.slate300,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dashedCodeTextMuted: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.slate500,
  },
  couponReasonText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.rose600,
    marginTop: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 15, 15, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  outOfZoneDialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  outOfZoneHeader: {
    backgroundColor: Colors.rose600,
    padding: 24,
    alignItems: 'center',
  },
  outOfZoneTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 10,
  },
  outOfZoneSub: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  outOfZoneBody: {
    padding: 20,
  },
  outOfZoneDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.slate700,
    textAlign: 'center',
    lineHeight: 19,
  },
  zoneChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  zoneChip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  zoneChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.emerald700,
  },
  outOfZoneFooter: {
    padding: 20,
    paddingTop: 0,
    gap: 8,
  },
  changeAddrBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changeAddrBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 13,
    color: Colors.white,
  },
  dismissZoneBtn: {
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissZoneText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.slate600,
  },
});
