import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SavedAddress } from '../context/LocationContext';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

export interface CheckoutAddressModalProps {
  visible: boolean;
  onClose: () => void;
  step: 'select' | 'form';
  setStep: (step: 'select' | 'form') => void;
  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;
  onSelectSavedAddress: (addr: SavedAddress) => void;
  addressLabel: 'Home' | 'Work' | 'Other';
  setAddressLabel: (label: 'Home' | 'Work' | 'Other') => void;
  houseNo: string;
  setHouseNo: (val: string) => void;
  floor: string;
  setFloor: (val: string) => void;
  street: string;
  setStreet: (val: string) => void;
  mohalla: string;
  setMohalla: (val: string) => void;
  village: string;
  setVillage: (val: string) => void;
  editedPhone: string;
  setEditedPhone: (val: string) => void;
  instructions: string;
  setInstructions: (val: string) => void;
  showInstructions: boolean;
  setShowInstructions: (val: boolean) => void;
  editError: string | null;
  validatingEdit: boolean;
  onSaveAddress: () => void;
  onChangeLocation: () => void;
  detectingGps?: boolean;
  onDetectGPS?: () => void;
  userAddress?: string | null;
}

export default function CheckoutAddressModal({
  visible,
  onClose,
  step,
  setStep,
  savedAddresses,
  selectedAddressId,
  onSelectSavedAddress,
  addressLabel,
  setAddressLabel,
  houseNo,
  setHouseNo,
  floor,
  setFloor,
  street,
  setStreet,
  mohalla,
  setMohalla,
  village,
  setVillage,
  editedPhone,
  setEditedPhone,
  instructions,
  setInstructions,
  showInstructions,
  setShowInstructions,
  editError,
  validatingEdit,
  onSaveAddress,
  onChangeLocation,
  detectingGps = false,
  onDetectGPS,
  userAddress,
}: CheckoutAddressModalProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isSaveDisabled =
    validatingEdit ||
    !village.trim() ||
    !mohalla.trim() ||
    !editedPhone.trim() ||
    !houseNo.trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>
                  {step === 'select'
                    ? 'Delivery ka Pata Chunein'
                    : 'Pata ki Jankari'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  ZipRocket Fast Delivery
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={20} color={Colors.slate500} />
              </Pressable>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step === 'select' ? (
                /* Step 1: Select Saved Address */
                <View style={styles.stepContainer}>
                  <Text style={styles.sectionLabel}>
                    Select a Saved Address
                  </Text>

                  {savedAddresses.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>
                        No saved addresses found.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.addressList}>
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr._id;
                        let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
                        if (addr.label === 'Work') iconName = 'work';
                        if (addr.label === 'Other') iconName = 'location-on';

                        return (
                          <Pressable
                            key={addr._id}
                            onPress={() => onSelectSavedAddress(addr)}
                            style={[
                              styles.savedCard,
                              isSelected && styles.savedCardSelected,
                            ]}
                          >
                            <View style={styles.savedCardLeft}>
                              <View
                                style={[
                                  styles.cardIconWrap,
                                  isSelected
                                    ? styles.cardIconWrapSelected
                                    : styles.cardIconWrapUnselected,
                                ]}
                              >
                                <MaterialIcons
                                  name={iconName}
                                  size={18}
                                  color={
                                    isSelected ? Colors.primary : Colors.slate500
                                  }
                                />
                              </View>
                              <View style={styles.cardDetails}>
                                <View style={styles.cardLabelRow}>
                                  <Text style={styles.cardLabel}>
                                    {addr.label || 'Home'}
                                  </Text>
                                  {addr.isDefault && (
                                    <View style={styles.defaultChip}>
                                      <Text style={styles.defaultChipText}>
                                        Default
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text
                                  style={styles.cardAddressText}
                                  numberOfLines={2}
                                >
                                  {addr.fullAddress}
                                </Text>
                              </View>
                            </View>

                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && (
                                <View style={styles.radioInnerDot} />
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  <Pressable
                    style={styles.addNewBtn}
                    onPress={() => setStep('form')}
                  >
                    <MaterialIcons
                      name="add"
                      size={20}
                      color={Colors.primary}
                    />
                    <Text style={styles.addNewBtnText}>
                      Add New Delivery Address
                    </Text>
                  </Pressable>
                </View>
              ) : (
                /* Step 2: Address Form */
                <View style={styles.stepContainer}>
                  {editError ? (
                    <View style={styles.errorBox}>
                      <MaterialIcons
                        name="error-outline"
                        size={18}
                        color={Colors.error}
                      />
                      <Text style={styles.errorText}>{editError}</Text>
                    </View>
                  ) : null}

                  {/* Segmented Tag Control */}
                  <View style={styles.segmentedControl}>
                    {(
                      [
                        { id: 'Home', label: 'House', icon: 'home' },
                        { id: 'Work', label: 'Office', icon: 'work' },
                        { id: 'Other', label: 'Other', icon: 'my-location' },
                      ] as const
                    ).map((tag) => {
                      const isActive =
                        (tag.id === 'Home' &&
                          (addressLabel === 'Home' ||
                            (addressLabel as string) === 'House')) ||
                        (tag.id === 'Work' &&
                          (addressLabel === 'Work' ||
                            (addressLabel as string) === 'Office')) ||
                        (tag.id === 'Other' &&
                          addressLabel !== 'Home' &&
                          (addressLabel as string) !== 'House' &&
                          addressLabel !== 'Work' &&
                          (addressLabel as string) !== 'Office');

                      return (
                        <Pressable
                          key={tag.id}
                          onPress={() => setAddressLabel(tag.id)}
                          style={[
                            styles.segmentBtn,
                            isActive && styles.segmentBtnActive,
                          ]}
                        >
                          <MaterialIcons
                            name={tag.icon}
                            size={16}
                            color={isActive ? Colors.white : Colors.slate600}
                          />
                          <Text
                            style={[
                              styles.segmentBtnText,
                              isActive && styles.segmentBtnTextActive,
                            ]}
                          >
                            {tag.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Makaan No. / Building / Floor */}
                  <TextInput
                    value={houseNo}
                    onChangeText={setHouseNo}
                    placeholder="Ward No. / Building / Your name *"
                    placeholderTextColor={Colors.textMuted}
                    onFocus={() => setFocusedField('houseNo')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      styles.input,
                      focusedField === 'houseNo' && styles.inputFocused,
                    ]}
                  />

                  {/* Gali / Mohalla / Rasta */}
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Gali / Mohalla / Rasta (Zaroori)"
                    placeholderTextColor={Colors.textMuted}
                    onFocus={() => setFocusedField('street')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      styles.input,
                      focusedField === 'street' && styles.inputFocused,
                    ]}
                  />

                  {/* Area / Locality Tile with Change Map Button */}
                  <View style={styles.localityContainer}>
                    <Text style={styles.localityFloatingLabel}>
                      Area / Locality
                    </Text>
                    <Text style={styles.localityText} numberOfLines={3}>
                      {mohalla || userAddress || 'Koi location select nahi hai'}
                    </Text>

                    {/* Mini Map Tile */}
                    <Pressable
                      onPress={onChangeLocation}
                      style={styles.mapTile}
                    >
                      <View style={styles.mapRoadH} />
                      <View style={styles.mapRoadV1} />
                      <View style={styles.mapRoadV2} />
                      <MaterialIcons
                        name="location-on"
                        size={24}
                        color={Colors.primary}
                        style={styles.mapPin}
                      />
                      <View style={styles.changeTag}>
                        <Text style={styles.changeTagText}>Change</Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* Address ka Naam */}
                  <TextInput
                    value={
                      addressLabel === 'Home'
                        ? 'Home'
                        : addressLabel === 'Work'
                          ? 'Work'
                          : addressLabel
                    }
                    onChangeText={(val) =>
                      setAddressLabel(
                        val === 'Work' || val === 'Office'
                          ? 'Work'
                          : val === 'Home' || val === 'House'
                            ? 'Home'
                            : 'Other'
                      )
                    }
                    placeholder="Address ka Naam (Ghar, Dukan, Office) *"
                    placeholderTextColor={Colors.textMuted}
                    onFocus={() => setFocusedField('label')}
                    onBlur={() => setFocusedField(null)}
                    style={[
                      styles.input,
                      focusedField === 'label' && styles.inputFocused,
                    ]}
                  />

                  {/* Phone Number Input with +91 Prefix */}
                  <View
                    style={[
                      styles.phoneInputRow,
                      focusedField === 'phone' && styles.phoneInputRowFocused,
                    ]}
                  >
                    <View style={styles.phonePrefixBox}>
                      <Text style={styles.phonePrefixText}>+91</Text>
                    </View>
                    <TextInput
                      value={editedPhone}
                      onChangeText={(val) =>
                        setEditedPhone(val.replace(/\D/g, ''))
                      }
                      maxLength={10}
                      keyboardType="phone-pad"
                      placeholder="Mobile Number (10 digit) *"
                      placeholderTextColor={Colors.textMuted}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      style={styles.phoneInput}
                    />
                  </View>

                  {/* GPS Detection Action */}
                  {onDetectGPS && (
                    <Pressable
                      onPress={onDetectGPS}
                      disabled={detectingGps}
                      style={styles.gpsActionBtn}
                    >
                      {detectingGps ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.primary}
                        />
                      ) : (
                        <MaterialIcons
                          name="my-location"
                          size={16}
                          color={Colors.primary}
                        />
                      )}
                      <Text style={styles.gpsActionText}>
                        {detectingGps
                          ? 'GPS detect ho raha hai...'
                          : 'Use Current GPS Location'}
                      </Text>
                    </Pressable>
                  )}

                  {/* Collapsible Delivery Instructions */}
                  <View style={styles.instructionsContainer}>
                    {!showInstructions ? (
                      <Pressable
                        onPress={() => setShowInstructions(true)}
                        style={styles.instructionsToggle}
                      >
                        <MaterialIcons
                          name="description"
                          size={15}
                          color={Colors.primary}
                        />
                        <Text style={styles.instructionsToggleText}>
                          Add Delivery Instructions (Optional)
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.instructionsBox}>
                        <Text style={styles.instructionsLabel}>
                          DELIVERY INSTRUCTIONS
                        </Text>
                        <TextInput
                          value={instructions}
                          onChangeText={setInstructions}
                          placeholder="e.g. Keep at gate / Call before arrival"
                          placeholderTextColor={Colors.textMuted}
                          multiline
                          numberOfLines={2}
                          style={styles.instructionsInput}
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <View>
                {step === 'form' && savedAddresses.length > 0 && (
                  <Pressable
                    onPress={() => setStep('select')}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.footerActions}>
                <Pressable
                  onPress={onClose}
                  disabled={validatingEdit}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>

                {step === 'form' && (
                  <Pressable
                    onPress={onSaveAddress}
                    disabled={isSaveDisabled}
                    style={[
                      styles.confirmBtn,
                      isSaveDisabled && styles.confirmBtnDisabled,
                    ]}
                  >
                    {validatingEdit ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color={Colors.white}
                        />
                        <Text style={styles.confirmBtnText}>
                          Address save ho raha hai...
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons
                          name="save"
                          size={16}
                          color={Colors.white}
                        />
                        <Text style={styles.confirmBtnText}>
                          Pata Confirm Karein
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    maxHeight: '92%',
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  stepContainer: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  emptyBox: {
    backgroundColor: Colors.slate50,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.slate100,
  },
  emptyText: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  addressList: {
    gap: 10,
  },
  savedCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  savedCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFAF5',
  },
  savedCardLeft: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapSelected: {
    backgroundColor: Colors.primaryLight,
  },
  cardIconWrapUnselected: {
    backgroundColor: Colors.slate100,
  },
  cardDetails: {
    flex: 1,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardLabel: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  defaultChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultChipText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 8,
    color: Colors.emerald700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardAddressText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  addNewBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  addNewBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.lg,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    flex: 1,
  },
  segmentedControl: {
    backgroundColor: Colors.slate100,
    borderRadius: BorderRadius.full,
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  segmentBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.slate600,
  },
  segmentBtnTextActive: {
    color: Colors.white,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  localityContainer: {
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  localityFloatingLabel: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 6,
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  localityText: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  mapTile: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.slate200,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRoadH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.slate300,
    opacity: 0.5,
  },
  mapRoadV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '35%',
    width: 3,
    backgroundColor: Colors.slate300,
    opacity: 0.5,
  },
  mapRoadV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '30%',
    width: 3,
    backgroundColor: Colors.slate300,
    opacity: 0.5,
  },
  mapPin: {
    zIndex: 2,
    marginBottom: 10,
  },
  changeTag: {
    position: 'absolute',
    bottom: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: Colors.slate200,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 3,
  },
  changeTagText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 8,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  phoneInputRowFocused: {
    borderColor: Colors.primary,
  },
  phonePrefixBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.slate200,
    backgroundColor: Colors.slate50,
  },
  phonePrefixText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.slate600,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  gpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  gpsActionText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  instructionsContainer: {
    paddingTop: 2,
  },
  instructionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  instructionsToggleText: {
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  instructionsBox: {
    gap: 4,
  },
  instructionsLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  instructionsInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.slate200,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.slate50,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.slate200,
    backgroundColor: Colors.white,
  },
  backBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.slate200,
    backgroundColor: Colors.white,
  },
  cancelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
