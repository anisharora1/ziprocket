import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  FontFamily,
} from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<'terms' | 'privacy' | 'refund'>('terms');

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Kya aap sach me logout karna chahte hain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(tabs)/home');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleWhatsAppSupport = () => {
    Linking.openURL(
      'https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20need%20help%20and%20support'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {token && user ? (
          <>
            {/* User Profile Card */}
            <View style={styles.profileCard}>
              <Text style={styles.cardSectionLabel}>LOGGED IN AS</Text>
              <View style={styles.userRow}>
                <View style={styles.avatar}>
                  <MaterialIcons name="person" size={32} color={Colors.white} />
                </View>
                <View style={styles.userInfoCol}>
                  <Text style={styles.userName}>{user.name || 'ZipRocket Customer'}</Text>
                  <View style={styles.phoneRow}>
                    <MaterialIcons name="call" size={16} color={Colors.primary} />
                    <Text style={styles.userPhone}>+91 {user.phone}</Text>
                  </View>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user.role || 'customer'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Menu Options */}
            <View style={styles.menuCard}>
              {/* My Orders */}
              <Pressable
                style={styles.menuItem}
                onPress={() => router.push('/(tabs)/orders')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name="receipt-long" size={20} color={Colors.primary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>My Orders</Text>
                  <Text style={styles.menuItemSubtitle}>Track live orders and view history</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>

              <View style={styles.divider} />

              {/* Saved Addresses */}
              <Pressable
                style={styles.menuItem}
                onPress={() => router.push('/addresses' as any)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name="home-work" size={20} color={Colors.primary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Saved Addresses</Text>
                  <Text style={styles.menuItemSubtitle}>Manage delivery addresses for faster checkout</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>

              <View style={styles.divider} />

              {/* Help & Support (WhatsApp) */}
              <Pressable style={styles.menuItem} onPress={handleWhatsAppSupport}>
                <View style={[styles.menuIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialIcons name="chat" size={20} color="#059669" />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Help & Support</Text>
                  <Text style={[styles.menuItemSubtitle, { color: '#059669' }]}>
                    Chat on WhatsApp (+91 91176 62441)
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>

              <View style={styles.divider} />

              {/* Legal & Policies */}
              <Pressable
                style={styles.menuItem}
                onPress={() => setLegalModalVisible(true)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.surfaceSecondary }]}>
                  <MaterialIcons name="gavel" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Legal & Policies</Text>
                  <Text style={styles.menuItemSubtitle}>Terms, Privacy & Refund policies</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Partner Opportunities */}
            <View style={styles.menuCard}>
              <Pressable
                style={styles.menuItem}
                onPress={() =>
                  Linking.openURL('https://wa.me/919117662441?text=Hi%2C%20I%20want%20to%20partner%20my%20restaurant%20with%20ZipRocket')
                }
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.surfaceSecondary }]}>
                  <MaterialIcons name="storefront" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Become Restaurant Partner</Text>
                  <Text style={styles.menuItemSubtitle}>Grow your food business with ZipRocket</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.menuItem}
                onPress={() =>
                  Linking.openURL('https://wa.me/919117662441?text=Hi%2C%20I%20want%20to%20join%20ZipRocket%20as%20a%20delivery%20partner')
                }
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.surfaceSecondary }]}>
                  <MaterialIcons name="two-wheeler" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Become Delivery Boy</Text>
                  <Text style={styles.menuItemSubtitle}>Earn daily by delivering orders in your town</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Log Out Button */}
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={Colors.error} />
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </>
        ) : (
          /* Guest State */
          <View style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <MaterialIcons name="account-circle" size={56} color={Colors.primary} />
            </View>
            <Text style={styles.guestTitle}>Access Your Account</Text>
            <Text style={styles.guestSubtitle}>
              Sign in with your mobile number to view past orders, save your delivery addresses, and enjoy seamless one-tap checkout.
            </Text>

            <Pressable
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>LOG IN</Text>
            </Pressable>

            <View style={styles.guestHelpContainer}>
              <Pressable
                style={styles.guestHelpRow}
                onPress={handleWhatsAppSupport}
              >
                <MaterialIcons name="chat" size={18} color="#059669" />
                <Text style={styles.guestHelpText}>Need help? Chat with WhatsApp Support</Text>
              </Pressable>

              <Pressable
                style={[styles.guestHelpRow, { marginTop: Spacing.sm }]}
                onPress={() => setLegalModalVisible(true)}
              >
                <MaterialIcons name="gavel" size={18} color={Colors.textMuted} />
                <Text style={styles.guestLegalText}>View Terms & Privacy Policy</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Legal & Policies Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Legal & Policies</Text>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setLegalModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Doc Tabs */}
          <View style={styles.tabRow}>
            {(['terms', 'privacy', 'refund'] as const).map((tab) => (
              <Pressable
                key={tab}
                style={[
                  styles.tabButton,
                  selectedLegalDoc === tab && styles.tabButtonActive,
                ]}
                onPress={() => setSelectedLegalDoc(tab)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selectedLegalDoc === tab && styles.tabButtonTextActive,
                  ]}
                >
                  {tab === 'terms' ? 'Terms' : tab === 'privacy' ? 'Privacy' : 'Refunds'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {selectedLegalDoc === 'terms' && (
              <View>
                <Text style={styles.policyHeading}>Terms & Conditions</Text>
                <Text style={styles.policyParagraph}>
                  Welcome to ZipRocket! By placing an order through our application or website, you agree to comply with and be bound by these terms.
                </Text>
                <Text style={styles.policySubheading}>1. Eligibility & Accounts</Text>
                <Text style={styles.policyParagraph}>
                  You must be at least 18 years old or possess legal parental consent. Phone number verification via OTP is required to register customer orders.
                </Text>
                <Text style={styles.policySubheading}>2. Hyperlocal Delivery</Text>
                <Text style={styles.policyParagraph}>
                  ZipRocket delivers within designated service zones in Tier-3/Tier-4 towns. Delivery times are estimated based on restaurant preparation and road conditions.
                </Text>
              </View>
            )}

            {selectedLegalDoc === 'privacy' && (
              <View>
                <Text style={styles.policyHeading}>Privacy Policy</Text>
                <Text style={styles.policyParagraph}>
                  ZipRocket values your privacy. We collect your mobile number, delivery addresses, and geolocation solely to process and deliver your orders accurately.
                </Text>
                <Text style={styles.policySubheading}>1. Data Protection</Text>
                <Text style={styles.policyParagraph}>
                  We never sell or rent your personal information to third parties. Customer data is encrypted and transmitted securely via HTTPS.
                </Text>
                <Text style={styles.policySubheading}>2. Location Data</Text>
                <Text style={styles.policyParagraph}>
                  Location access is used solely when determining nearby restaurants and guiding the delivery partner to your doorstep.
                </Text>
              </View>
            )}

            {selectedLegalDoc === 'refund' && (
              <View>
                <Text style={styles.policyHeading}>Refund & Cancellation Policy</Text>
                <Text style={styles.policyParagraph}>
                  Orders can be cancelled before they are accepted or prepared by the merchant. Once an order is being prepared, cancellations may not be eligible for full refund.
                </Text>
                <Text style={styles.policySubheading}>1. Damaged or Missing Items</Text>
                <Text style={styles.policyParagraph}>
                  If any item is missing or damaged, please contact support via WhatsApp within 2 hours of delivery for immediate resolution and refund.
                </Text>
                <Text style={styles.policySubheading}>2. Online Payment Refunds</Text>
                <Text style={styles.policyParagraph}>
                  Prepaid refunds are credited back to the original payment source within 3-5 business days.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardSectionLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoCol: {
    flex: 1,
  },
  userName: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userPhone: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  roleText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuItemTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  menuItemSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xs,
    ...Shadows.sm,
  },
  logoutText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },
  guestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  guestTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  guestSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    width: '100%',
    alignItems: 'center',
    ...Shadows.sm,
  },
  loginButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    letterSpacing: 1,
  },
  guestHelpContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  guestHelpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  guestHelpText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: '#059669',
  },
  guestLegalText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    padding: Spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Colors.white,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: Spacing.lg,
  },
  policyHeading: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  policySubheading: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  policyParagraph: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
});
