import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation, SavedAddress, LocationCoords } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { apiClient, isNetworkError } from '../services/api';
import { getIsOnline, onReconnect } from '../services/network';
import { getHighAccuracyGPSFix, GPSError } from '../utils/geolocation';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

import { useKeyboardHeight } from '../hooks';

interface LocationSelectorModalProps {
  visible?: boolean;
  isOpen?: boolean; // Web compatibility alias
  onClose: () => void;
}

export default function LocationSelectorModal({
  visible,
  isOpen,
  onClose,
}: LocationSelectorModalProps) {
  const isModalVisible = visible ?? isOpen ?? false;
  const keyboardHeight = useKeyboardHeight();

  const {
    location,
    address,
    savedAddresses,
    selectedAddressId,
    setSelectedAddress,
    loadSavedAddresses,
    setCustomLocation,
  } = useLocation();

  const { token, user } = useAuth();

  const [step, setStep] = useState<'select' | 'form'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [errorCanAskAgain, setErrorCanAskAgain] = useState<boolean | undefined>(undefined);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Form Fields
  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [village, setVillage] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

  // Debounced Places Autocomplete Query (400ms debounce, starts at 3+ chars)
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await apiClient.get(
          `/locations/autocomplete?input=${encodeURIComponent(searchQuery)}`
        );
        if (res.data?.success) {
          setSuggestions(res.data.suggestions || []);
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          console.warn('Autocomplete search failed:', err);
        }
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load saved addresses when modal opens
  useEffect(() => {
    if (isModalVisible && token) {
      loadSavedAddresses();
    }
    if (isModalVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep('select');
      setSearchQuery('');
      setSuggestions([]);
      setAddressError(null);
      setErrorCanAskAgain(undefined);
    }
  }, [isModalVisible, token, loadSavedAddresses]);

  // Re-fetch saved addresses when connection returns
  useEffect(() => {
    const unsub = onReconnect(() => {
      if (isModalVisible && token) {
        loadSavedAddresses();
      }
    });
    return unsub;
  }, [isModalVisible, token, loadSavedAddresses]);

  // Handle GPS Auto-Detect signal check
  const handleDetectGPS = async () => {
    setGpsLoading(true);
    setAddressError(null);
    setErrorCanAskAgain(undefined);

    try {
      const fix = await getHighAccuracyGPSFix({
        desiredAccuracyMeters: 20,
        maxWaitTimeMs: 5000,
        accuracyThresholdMeters: 150,
      });

      const latitude = fix.coords.latitude;
      const longitude = fix.coords.longitude;
      let prefillPincode = '';
      let city = 'Unknown';
      let state = 'Bihar';
      let country = 'India';
      let fullAddress = 'Address unavailable';

      try {
        const geocodeRes = await apiClient.get(
          `/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`
        );
        if (geocodeRes.data?.success && geocodeRes.data?.details) {
          const details = geocodeRes.data.details;
          prefillPincode = details.pincode || '';
          city = details.city || 'Unknown';
          state = details.state || 'Bihar';
          country = details.country || 'India';
          fullAddress = details.fullAddress || 'Address unavailable';
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          console.warn('Reverse geocode failed:', err);
        }
      }

      await setCustomLocation(
        { lat: latitude, lng: longitude },
        fullAddress,
        prefillPincode || null,
        city || null,
        state || null,
        country || null
      );
      onClose();
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.error('GPS detection failed:', err);
      }
      const msg = isNetworkError(err)
        ? "You're offline. Connect to the internet to detect your location."
        : err.message || 'Failed to detect stable GPS signal.';
      setAddressError(msg);
      if (err.canAskAgain === false) {
        setErrorCanAskAgain(false);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  // Handle autocomplete suggestion select and resolve details
  const handleSelectSuggestion = async (placeId: string) => {
    try {
      setSearching(true);
      setAddressError(null);
      const res = await apiClient.get(`/locations/place-details?placeId=${placeId}`);

      if (res.data?.success && res.data?.details) {
        const { fullAddress, lat, lng, pincode: pin, city: c, state: s, country: co } =
          res.data.details;

        await setCustomLocation(
          { lat, lng },
          fullAddress,
          pin || null,
          c || null,
          s || null,
          co || null
        );
        onClose();
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.error('Failed to select place suggestion:', err);
      }
      setAddressError(
        isNetworkError(err)
          ? "You're offline. Connect to the internet to load address details."
          : 'Unable to load details for the selected address.'
      );
    } finally {
      setSearching(false);
    }
  };

  // Select a saved address
  const handleSelectSavedAddress = async (addr: SavedAddress) => {
    await setSelectedAddress(addr);
    onClose();
  };

  // Save manual address form (lines 176-255 of web modal)
  const handleSaveAddressForm = async () => {
    if (!getIsOnline()) {
      setAddressError("You're offline. Connect to the internet to save your address.");
      return;
    }

    if (!houseNumber.trim()) {
      setAddressError('House Number / Name is required');
      return;
    }
    if (!locality.trim()) {
      setAddressError('Area / Locality is required');
      return;
    }
    if (!village.trim()) {
      setAddressError('Village / City is required');
      return;
    }
    if (!landmark.trim()) {
      setAddressError('Nearby Landmark is required');
      return;
    }

    const fullAddrString = [
      houseNumber.trim() ? `House/Flat No: ${houseNumber.trim()}` : '',
      street.trim() ? `Road: ${street.trim()}` : '',
      locality.trim() ? locality.trim() : '',
      village.trim() ? `Village: ${village.trim()}` : '',
      landmark.trim() ? `Near: ${landmark.trim()}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const targetCoords: LocationCoords = location || { lat: 26.443352, lng: 85.902705 };

    const payload = {
      label: addressLabel,
      location: targetCoords,
      locationSource: 'manual',
      deliveryAddress: {
        houseNumber: houseNumber.trim(),
        street: street.trim(),
        locality: locality.trim(),
        village: village.trim(),
        landmark: landmark.trim(),
        pincode: pincode.trim(),
        instructions: instructions.trim(),
      },
      isDefault: false,
    };

    if (token) {
      try {
        setSavingForm(true);
        const res = await apiClient.post('/addresses', payload);
        if (res.data?.success) {
          await loadSavedAddresses();
          if (res.data.address) {
            await setSelectedAddress(res.data.address);
          }
          onClose();
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          console.error('Failed to save address:', err);
        }
        setAddressError(
          isNetworkError(err)
            ? "You're offline. Connect to the internet to save your address."
            : err.response?.data?.message || 'Failed to save address details.'
        );
      } finally {
        setSavingForm(false);
      }
    } else {
      // Guest flow
      const formattedAddress: SavedAddress = {
        _id: 'guest-manual-coords',
        label: addressLabel,
        location: targetCoords,
        locationSource: 'manual',
        deliveryAddress: payload.deliveryAddress,
        fullAddress: fullAddrString,
        pincode: pincode.trim() || '000000',
        city: village.trim() || 'Unknown',
        state: 'Bihar',
        deliveryZone: undefined,
        isDefault: false,
      };
      await setSelectedAddress(formattedAddress);
      onClose();
    }
  };

  return (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={[
            styles.keyboardContainer,
            Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>
                {step === 'select' ? 'Choose delivery location' : 'Enter Delivery Details'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 'select'
                  ? 'Select a saved address or search manually'
                  : 'Provide manual details for accurate delivery'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Modal Body */}
          {step === 'select' ? (
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Autocomplete Input Search */}
              <View style={styles.searchSection}>
                <Text style={styles.fieldSectionLabel}>SEARCH ADDRESS</Text>
                <View style={styles.searchInputRow}>
                  <MaterialIcons
                    name="search"
                    size={20}
                    color={Colors.textMuted}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Type your area, building name or town..."
                    placeholderTextColor={Colors.textMuted}
                    style={styles.searchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searchQuery ? (
                    <Pressable
                      onPress={() => setSearchQuery('')}
                      style={styles.clearSearchBtn}
                      hitSlop={8}
                    >
                      <MaterialIcons name="cancel" size={18} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Inline Error Alerts */}
                {addressError ? (
                  <View style={styles.errorAlert}>
                    <MaterialIcons
                      name="warning"
                      size={18}
                      color={Colors.rose600}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.errorAlertText}>{addressError}</Text>
                    {errorCanAskAgain === false ? (
                      <Pressable
                        onPress={() => Linking.openSettings()}
                        style={styles.openSettingsBtn}
                      >
                        <Text style={styles.openSettingsText}>Settings</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Autocomplete Searching Spinner */}
                {searching ? (
                  <View style={styles.predictionLoadingCard}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.predictionLoadingText}>Loading predictions...</Text>
                  </View>
                ) : null}

                {/* Suggestions List */}
                {!searching && suggestions.length > 0 ? (
                  <View style={styles.suggestionsCard}>
                    {suggestions.map((s, idx) => (
                      <Pressable
                        key={s.place_id || idx}
                        onPress={() => handleSelectSuggestion(s.place_id)}
                        style={[
                          styles.suggestionItem,
                          idx < suggestions.length - 1 && styles.suggestionBorder,
                        ]}
                      >
                        <MaterialIcons
                          name="location-on"
                          size={18}
                          color={Colors.textMuted}
                          style={styles.suggestionPin}
                        />
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {s.description || s.text || ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* GPS Auto-Detect Button */}
              <Pressable
                onPress={handleDetectGPS}
                disabled={gpsLoading}
                style={[styles.gpsButton, gpsLoading && styles.gpsButtonDisabled]}
              >
                {gpsLoading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={Colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.gpsButtonText}>ACQUIRING GPS SIGNAL...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons
                      name="my-location"
                      size={18}
                      color={Colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.gpsButtonText}>USE CURRENT GPS LOCATION</Text>
                  </>
                )}
              </Pressable>

              {/* Saved Addresses Section */}
              <View style={styles.savedAddressesSection}>
                <View style={styles.savedAddressesHeaderRow}>
                  <Text style={styles.fieldSectionLabel}>SAVED ADDRESSES</Text>
                  {token ? (
                    <Pressable
                      onPress={() => {
                        setStep('form');
                        setAddressError(null);
                      }}
                      style={styles.addNewAddressBtn}
                    >
                      <MaterialIcons name="add" size={16} color={Colors.primary} />
                      <Text style={styles.addNewAddressText}>Add New</Text>
                    </Pressable>
                  ) : null}
                </View>

                {savedAddresses.length === 0 ? (
                  <View style={styles.emptySavedBox}>
                    <Text style={styles.emptySavedText}>
                      No saved address books found. Add one in the Saved Addresses page to speed up
                      checkout.
                    </Text>
                    {token ? (
                      <Pressable
                        onPress={() => {
                          setStep('form');
                          setAddressError(null);
                        }}
                        style={styles.addFirstAddressBtn}
                      >
                        <MaterialIcons name="add-location" size={18} color={Colors.primary} />
                        <Text style={styles.addFirstAddressText}>Add Address Now</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.addressListGrid}>
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr._id;
                      let iconName: 'home' | 'work' | 'business' = 'home';
                      if (addr.label === 'Work') iconName = 'work';
                      if (addr.label === 'Other') iconName = 'business';

                      return (
                        <Pressable
                          key={addr._id}
                          onPress={() => handleSelectSavedAddress(addr)}
                          style={[
                            styles.addressItemCard,
                            isSelected && styles.addressItemCardSelected,
                          ]}
                        >
                          <View style={styles.addressItemLeft}>
                            <View
                              style={[
                                styles.addressItemIconCircle,
                                isSelected && styles.addressItemIconCircleSelected,
                              ]}
                            >
                              <MaterialIcons
                                name={iconName}
                                size={18}
                                color={isSelected ? Colors.primary : Colors.textSecondary}
                              />
                            </View>
                            <View style={styles.addressItemTextCol}>
                              <View style={styles.addressLabelRow}>
                                <Text style={styles.addressLabelTitle}>{addr.label}</Text>
                                {addr.isDefault ? (
                                  <View style={styles.defaultBadge}>
                                    <Text style={styles.defaultBadgeText}>Default</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.addressFullText} numberOfLines={2}>
                                {addr.fullAddress}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.radioOuter,
                              isSelected && styles.radioOuterSelected,
                            ]}
                          >
                            {isSelected ? <View style={styles.radioInner} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            /* Step 2: "Add new address" form */
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {addressError ? (
                <View style={styles.errorAlert}>
                  <MaterialIcons
                    name="warning"
                    size={18}
                    color={Colors.rose600}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.errorAlertText}>{addressError}</Text>
                </View>
              ) : null}

              {/* House / Flat No */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>HOUSE NUMBER / HOUSE NAME *</Text>
                <TextInput
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                  placeholder="e.g. House No. 152 / Ground Floor"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              {/* Street / Gali (Optional) */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>STREET / GALI (OPTIONAL)</Text>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="e.g. Gali No. 3 / Main Chowk Road"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              {/* Locality */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>AREA / LOCALITY *</Text>
                <TextInput
                  value={locality}
                  onChangeText={setLocality}
                  placeholder="e.g. Main Market / Sector 4"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              {/* Village / City */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>VILLAGE / CITY *</Text>
                <TextInput
                  value={village}
                  onChangeText={setVillage}
                  placeholder="e.g. Rampur Village / Benipatti"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              {/* Landmark */}
              <View style={styles.formFieldGroup}>
                <Text style={[styles.formFieldLabel, { color: Colors.primary }]}>
                  NEARBY LANDMARK *
                </Text>
                <TextInput
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="e.g. Near Government School / Beside Hanuman Temple"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.formInput, styles.formInputLandmark]}
                />
              </View>

              {/* Pincode (Optional) */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>PINCODE (OPTIONAL)</Text>
                <TextInput
                  value={pincode}
                  onChangeText={(val) => setPincode(val.replace(/\D/g, ''))}
                  placeholder="e.g. 847223"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={6}
                  style={styles.formInput}
                />
              </View>

              {/* Delivery Instructions (Optional) */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>DELIVERY INSTRUCTIONS (OPTIONAL)</Text>
                <TextInput
                  value={instructions}
                  onChangeText={setInstructions}
                  placeholder="e.g. Ring bell / Leave at gate / Call when outside"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={2}
                  style={[styles.formInput, styles.formTextarea]}
                />
              </View>

              {/* Address Tag Selection */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.formFieldLabel}>SAVE ADDRESS AS</Text>
                <View style={styles.chipsRow}>
                  {(['Home', 'Work', 'Other'] as const).map((label) => (
                    <Pressable
                      key={label}
                      onPress={() => setAddressLabel(label)}
                      style={[
                        styles.chipBtn,
                        addressLabel === label && styles.chipBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          addressLabel === label && styles.chipBtnTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Actions */}
              <View style={styles.formActionsRow}>
                <Pressable
                  onPress={() => {
                    setStep('select');
                    setAddressError(null);
                  }}
                  style={styles.formBackBtn}
                >
                  <Text style={styles.formBackBtnText}>BACK</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveAddressForm}
                  disabled={
                    savingForm ||
                    !houseNumber.trim() ||
                    !locality.trim() ||
                    !village.trim() ||
                    !landmark.trim()
                  }
                  style={[
                    styles.formConfirmBtn,
                    (savingForm ||
                      !houseNumber.trim() ||
                      !locality.trim() ||
                      !village.trim() ||
                      !landmark.trim()) &&
                      styles.buttonDisabled,
                  ]}
                >
                  {savingForm ? (
                    <ActivityIndicator size="small" color={Colors.surface} />
                  ) : (
                    <Text style={styles.formConfirmBtnText}>CONFIRM ADDRESS</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Footer (when step === 'select' and address exists) */}
          {step === 'select' && address ? (
            <View style={styles.footer}>
              <Text style={styles.footerLabel}>ACTIVE COURIER BOUNDS</Text>
              <Text style={styles.footerAddressText} numberOfLines={1}>
                {address}
              </Text>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  searchSection: {
    gap: Spacing.xs + 2,
  },
  fieldSectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  searchInputRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  clearSearchBtn: {
    padding: Spacing.xs,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  errorAlertText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.rose600,
  },
  openSettingsBtn: {
    backgroundColor: Colors.rose600,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.xs,
  },
  openSettingsText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.surface,
  },
  predictionLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  predictionLoadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  suggestionsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    ...Shadows.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionPin: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryAlpha10,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
  },
  gpsButtonDisabled: {
    opacity: 0.6,
  },
  gpsButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  savedAddressesSection: {
    gap: Spacing.sm,
  },
  savedAddressesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addNewAddressText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  emptySavedBox: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptySavedText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  addFirstAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addFirstAddressText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  addressListGrid: {
    gap: Spacing.sm,
  },
  addressItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  addressItemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFBF8',
  },
  addressItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  addressItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  addressItemIconCircleSelected: {
    backgroundColor: Colors.primaryAlpha10,
  },
  addressItemTextCol: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addressLabelTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  defaultBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.emerald700,
    textTransform: 'uppercase',
  },
  addressFullText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  formFieldGroup: {
    gap: 6,
  },
  formFieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
  },
  formInputLandmark: {
    borderColor: Colors.primaryAlpha20,
    fontFamily: FontFamily.bold,
  },
  formTextarea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chipBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  chipBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  chipBtnTextActive: {
    color: Colors.surface,
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  formBackBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBackBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    fontWeight: '900',
  },
  formConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  formConfirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.surface,
    fontWeight: '900',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerAddressText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
