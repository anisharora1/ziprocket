import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, ConfirmationResult } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useNotification } from '../../src/context/NotificationContext';
import { apiClient, isNetworkError } from '../../src/services/api';
import { getIsOnline } from '../../src/services/network';
import { getFriendlyErrorMessage } from '../../src/utils/errorHandler';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { promptPermission } = useNotification();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const otpInputRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);

  // Resend OTP countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleRequestOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setError('Kripya sahi 10-digit mobile number enter karein.');
      return;
    }

    if (!getIsOnline()) {
      setError('No internet connection. Please check your connection and try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const confirmation = await auth().signInWithPhoneNumber('+91' + cleanPhone);
      setConfirmationResult(confirmation);
      setStep(2);
      setTimer(30);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      if (
        isNetworkError(err) ||
        err?.code === 'auth/network-request-failed' ||
        err?.message?.includes('network')
      ) {
        setError('No internet connection. Please check your connection and try again.');
      } else {
        setError(getFriendlyErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Kripya 6-digit verification code enter karein.');
      return;
    }

    if (!confirmationResult) {
      setError('Session expire ho chuka hai. Kripya OTP dobara mangwayein.');
      return;
    }

    if (!getIsOnline()) {
      setError('No internet connection. Please check your connection and try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Confirm OTP with Firebase
      const userCredential = await confirmationResult.confirm(otpString);
      const currentUser = auth().currentUser;
      const idToken = currentUser
        ? await currentUser.getIdToken()
        : await userCredential.user.getIdToken();

      if (!idToken) {
        throw new Error('Authentication token prapt nahi ho saka. Kripya dobara try karein.');
      }

      // 2. Call backend /auth/verify-otp with Firebase ID token
      const res = await apiClient.post('/auth/verify-otp', {
        token: idToken,
        role: 'customer',
        name: 'User',
        isPwa: false,
        clientType: 'mobile',
      });

      if (res.data?.success && res.data?.token && res.data?.user) {
        const verifiedUser = res.data.user;

        // Role check: Only customers are permitted in this mobile customer app
        if (verifiedUser.role && verifiedUser.role !== 'customer') {
          await auth().signOut();
          setError('This app is for customers only.');
          return;
        }

        await login(res.data.token, verifiedUser);
        promptPermission('login');
        router.replace('/(tabs)/home');
      } else {
        setError(res.data?.message || 'Verification fail ho gaya. Kripya dobara try karein.');
      }
    } catch (err: any) {
      if (
        isNetworkError(err) ||
        err?.code === 'auth/network-request-failed' ||
        err?.message?.includes('network')
      ) {
        setError('No internet connection. Please check your connection and try again.');
      } else {
        setError(getFriendlyErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const newOtp = [...otp];

    if (cleanValue.length > 1) {
      // Handle paste or SMS autofill of 6 digits
      const digits = cleanValue.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // Auto-advance to next box
    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <MaterialIcons name="bolt" size={36} color={Colors.white} />
            </View>
            <Text style={styles.brandTitle}>ZipRocket</Text>
            <Text style={styles.brandSubtitle}>India&#39;s Fastest Delivery</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorAlert}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <Text style={styles.errorAlertText}>{error}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              // Step 1: Mobile number entry
              <View>
                <Text style={styles.cardTitle}>Log in or sign up</Text>

                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBox}>
                    <MaterialIcons name="flag" size={18} color={Colors.textSecondary} />
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneTextInput}
                    placeholder="Enter mobile number"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val.replace(/\D/g, '').slice(0, 10));
                      if (error) setError('');
                    }}
                  />
                </View>

                <Pressable
                  style={[
                    styles.primaryButton,
                    (loading || phone.length < 10) && styles.disabledButton,
                  ]}
                  disabled={loading || phone.length < 10}
                  onPress={handleRequestOtp}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </Pressable>

                <View style={styles.smsNoticeRow}>
                  <View style={styles.smsIconCircle}>
                    <MaterialIcons name="sms" size={14} color={Colors.primary} />
                  </View>
                  <Text style={styles.smsNoticeText}>OTP will be sent via SMS</Text>
                </View>

                <Pressable
                  style={styles.guestButton}
                  onPress={() => router.replace('/(tabs)/home')}
                >
                  <Text style={styles.guestButtonText}>Skip & Explore as Guest</Text>
                </Pressable>
              </View>
            ) : (
              // Step 2: 6-digit OTP entry
              <View>
                <View style={styles.verifyHeaderRow}>
                  <Text style={styles.cardTitle}>Verify Details</Text>
                  <View style={styles.phoneBadgeRow}>
                    <Text style={styles.phoneBadgeText}>+91 {phone}</Text>
                    <Pressable
                      style={styles.editPhoneButton}
                      onPress={() => {
                        setStep(1);
                        setError('');
                      }}
                    >
                      <MaterialIcons name="edit" size={16} color={Colors.primary} />
                    </Pressable>
                  </View>
                </View>

                {/* 6 Digit OTP input boxes */}
                <View style={styles.otpBoxesRow}>
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => {
                        otpInputRefs.current[idx] = ref;
                      }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                      ]}
                      keyboardType="number-pad"
                      maxLength={idx === 0 ? 6 : 1}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      value={digit}
                      onChangeText={(val) => handleOtpChange(idx, val)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(idx, nativeEvent.key)}
                      autoFocus={idx === 0}
                    />
                  ))}
                </View>

                {/* Timer / Resend Button */}
                <View style={styles.timerContainer}>
                  {timer > 0 ? (
                    <View style={styles.timerRow}>
                      <MaterialIcons name="schedule" size={16} color={Colors.textSecondary} />
                      <Text style={styles.timerText}>
                        Resend OTP in{' '}
                        <Text style={styles.timerHighlight}>
                          00:{timer.toString().padStart(2, '0')}
                        </Text>
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.resendButton}
                      onPress={handleRequestOtp}
                      disabled={loading}
                    >
                      <MaterialIcons name="refresh" size={16} color={Colors.primary} />
                      <Text style={styles.resendButtonText}>Resend OTP now</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  style={[
                    styles.primaryButton,
                    (loading || otp.join('').length !== 6) && styles.disabledButton,
                  ]}
                  disabled={loading || otp.join('').length !== 6}
                  onPress={handleVerifyOtp}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Proceed</Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.guestButton}
                  onPress={() => router.replace('/(tabs)/home')}
                >
                  <Text style={styles.guestButtonText}>Skip & Explore as Guest</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.xxl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.lg,
  },
  brandTitle: {
    fontSize: Typography.fontSize.display,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  cardTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  errorAlertText: {
    flex: 1,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.error,
    fontWeight: Typography.fontWeight.bold,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    gap: 4,
  },
  countryCodeText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  smsNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  smsIconCircle: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsNoticeText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  guestButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  guestButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  verifyHeaderRow: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  phoneBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  phoneBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  editPhoneButton: {
    padding: 2,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    textAlign: 'center',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
  },
  timerContainer: {
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timerText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  timerHighlight: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resendButtonText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
});
