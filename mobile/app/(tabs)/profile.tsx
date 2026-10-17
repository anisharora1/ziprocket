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
  Switch,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useNotification } from '../../src/context/NotificationContext';
import { apiClient } from '../../src/services/api';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  FontFamily,
} from '../../src/constants/theme';

type LegalDocType = 'about' | 'contact' | 'terms' | 'privacy' | 'refund' | 'shipping';

const LEGAL_TABS: { id: LegalDocType; label: string }[] = [
  { id: 'about', label: 'About Us' },
  { id: 'contact', label: 'Contact Us' },
  { id: 'terms', label: 'Terms & Conditions' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'refund', label: 'Refund Policy' },
  { id: 'shipping', label: 'Shipping Policy' },
];

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const { marketingOptIn, setMarketingOptIn, fcmToken } = useNotification();
  const router = useRouter();

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>('about');

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (isDeleting || deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete('/auth/account', {
        data: { confirm: 'DELETE' },
      });

      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      setDeleteError(null);

      if (fcmToken) {
        try {
          await apiClient.post('/notifications/unlink-user', { token: fcmToken });
        } catch {
          // Best-effort cleanup
        }
      }

      await logout();
      router.replace('/(auth)/login');
      Alert.alert('Account Deleted', 'Your account has been deleted.');
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;

      if ((status === 409 || status === 403) && serverMsg) {
        setDeleteError(serverMsg);
      } else {
        setDeleteError('Could not delete account. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

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
                    Chat on WhatsApp
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

              <View style={styles.divider} />

              {/* Offers & Promotions Switch */}
              <View style={styles.menuItem}>
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name="local-offer" size={20} color={Colors.primary} />
                </View>
                <View style={styles.menuTextCol}>
                  <Text style={styles.menuItemTitle}>Offers & Promotions</Text>
                  <Text style={styles.menuItemSubtitle}>Deals and promotional updates</Text>
                </View>
                <Switch
                  value={marketingOptIn}
                  onValueChange={(val) => setMarketingOptIn(val)}
                  trackColor={{ false: Colors.slate300, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
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

            {/* Delete Account Button */}
            <Pressable
              style={styles.deleteAccountButton}
              onPress={() => {
                setDeleteConfirmText('');
                setDeleteError(null);
                setDeleteModalVisible(true);
              }}
            >
              <MaterialIcons name="delete-forever" size={20} color={Colors.error} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
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
          <View style={styles.tabScrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
            >
              {LEGAL_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  style={[
                    styles.tabButton,
                    selectedLegalDoc === tab.id && styles.tabButtonActive,
                  ]}
                  onPress={() => setSelectedLegalDoc(tab.id)}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      selectedLegalDoc === tab.id && styles.tabButtonTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* 1. About Us */}
            {selectedLegalDoc === 'about' && (
              <View>
                <Text style={styles.policyHeading}>About Us</Text>
                <Text style={styles.policyTagline}>Hyperlocal Delivery for Bharat</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policySubheading}>Our Mission</Text>
                <Text style={styles.policyParagraph}>
                  ZipRocket is a hyperlocal food and grocery delivery platform built for Tier-3 and Tier-4 towns in India — starting with Phagwara, Punjab. We connect local restaurants and grocery stores with customers in their own neighborhood, delivered by local delivery partners, usually within minutes rather than hours.
                </Text>
                <Text style={styles.policyParagraph}>
                  ZipRocket is currently operated by Anish Arora, as an individual proprietor, based in Madhubani, Bihar.
                </Text>

                <View style={styles.highlightBox}>
                  <Text style={styles.highlightTitle}>Key Highlights</Text>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>Hyperlocal Focus: </Text>
                      Tailored specifically for the needs and dynamics of Tier-3 & Tier-4 towns.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>Empowering Local Sellers: </Text>
                      Connecting neighborhood restaurants and grocery shops directly to local consumers.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>Fast & Reliable: </Text>
                      Neighborhood deliveries powered by local delivery partners.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 2. Contact Us */}
            {selectedLegalDoc === 'contact' && (
              <View>
                <Text style={styles.policyHeading}>Contact Us</Text>
                <Text style={styles.policyTagline}>We're here to help you</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policySubheading}>Support Details</Text>

                <Pressable
                  style={styles.contactCard}
                  onPress={() => Linking.openURL('mailto:ziprocket.support@gmail.com')}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: Colors.primaryLight }]}>
                    <MaterialIcons name="email" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.contactTextCol}>
                    <Text style={styles.contactLabel}>EMAIL</Text>
                    <Text style={styles.contactValue}>ziprocket.support@gmail.com</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.contactCard}
                  onPress={() =>
                    Linking.openURL('https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20need%20support')
                  }
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <MaterialIcons name="chat" size={20} color="#16A34A" />
                  </View>
                  <View style={styles.contactTextCol}>
                    <Text style={styles.contactLabel}>WHATSAPP SUPPORT</Text>
                    <Text style={[styles.contactValue, { color: '#16A34A' }]}>+91 9117662441</Text>
                  </View>
                </Pressable>

                <View style={styles.contactCard}>
                  <View style={[styles.contactIconCircle, { backgroundColor: Colors.slate200 }]}>
                    <MaterialIcons name="location-on" size={20} color={Colors.slate600} />
                  </View>
                  <View style={styles.contactTextCol}>
                    <Text style={styles.contactLabel}>OPERATING ADDRESS</Text>
                    <Text style={styles.contactValue}>Madhubani, Bihar</Text>
                  </View>
                </View>

                <View style={styles.contactCard}>
                  <View style={[styles.contactIconCircle, { backgroundColor: Colors.slate200 }]}>
                    <MaterialIcons name="access-time" size={20} color={Colors.slate600} />
                  </View>
                  <View style={styles.contactTextCol}>
                    <Text style={styles.contactLabel}>SUPPORT HOURS</Text>
                    <Text style={styles.contactValue}>9:00 AM – 9:00 PM, all days</Text>
                  </View>
                </View>

                <Text style={styles.policySubheading}>How to Reach Us</Text>
                <Text style={styles.policyParagraph}>
                  For order issues, refunds, or partnership queries (restaurant/grocery/delivery partner onboarding), please reach out via WhatsApp for the fastest response, or email us and we'll get back within 24 hours.
                </Text>
              </View>
            )}

            {/* 3. Terms & Conditions */}
            {selectedLegalDoc === 'terms' && (
              <View>
                <Text style={styles.policyHeading}>Terms and Conditions</Text>
                <Text style={styles.policyTagline}>User Agreement & Operating Policies</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policyLead}>
                  By using ZipRocket (ziprocket.in and its mobile app), you agree to the following terms.
                </Text>

                <Text style={styles.policySubheading}>General Terms</Text>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Platform Role: </Text>
                    ZipRocket is a platform connecting customers with independent restaurants, grocery stores, and delivery partners. We are not the manufacturer or preparer of food/grocery items sold through the platform.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Order Acceptance: </Text>
                    Orders are subject to acceptance by the restaurant/store. An order is not confirmed until the seller has accepted it.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Payment Modes: </Text>
                    Payment can be made via UPI (processed securely through Razorpay) or Cash on Delivery, depending on availability in your area.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Delivery Estimates: </Text>
                    Delivery times shown are estimates based on distance and preparation time, and may vary due to traffic, weather, or high demand.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>User Responsibilities: </Text>
                    Users must provide accurate delivery addresses and contact details. ZipRocket is not responsible for delivery failures due to incorrect information provided by the customer.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Platform Misuse: </Text>
                    Misuse of the platform, including placing fraudulent orders, abusive behavior toward delivery partners or restaurant staff, or providing false information during registration (as a customer, restaurant, or delivery partner), may result in account suspension.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Modifications: </Text>
                    ZipRocket reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Governing Law & Jurisdiction: </Text>
                    These terms are governed by the laws of India, with courts in Madhubani Bihar having jurisdiction.
                  </Text>
                </View>
              </View>
            )}

            {/* 4. Privacy Policy */}
            {selectedLegalDoc === 'privacy' && (
              <View>
                <Text style={styles.policyHeading}>Privacy Policy</Text>
                <Text style={styles.policyTagline}>How we handle and protect your personal information</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policySubheading}>Information We Collect</Text>
                <Text style={styles.policyParagraph}>
                  We collect the following information to operate ZipRocket: your name, phone number (verified via OTP), delivery address, and precise location (GPS) when you use the app, in order to show you nearby restaurants/stores and calculate accurate delivery times and fees.
                </Text>

                <Text style={styles.policySubheading}>Payment Information</Text>
                <Text style={styles.policyParagraph}>
                  ZipRocket does not store your card, UPI, or banking details. All payments are processed directly and securely by Razorpay, our payment partner, in compliance with RBI and PCI-DSS standards.
                </Text>

                <Text style={styles.policySubheading}>How We Use Your Data</Text>
                <Text style={styles.policyParagraph}>
                  To process and deliver your orders, communicate order updates, provide customer support, and improve our service. We do not sell your personal data to third parties.
                </Text>

                <Text style={styles.policySubheading}>Data Sharing</Text>
                <Text style={styles.policyParagraph}>
                  Your name, phone number, and delivery address are shared only with the restaurant/store fulfilling your order and the delivery partner assigned to it, solely for order fulfillment.
                </Text>

                <Text style={styles.policySubheading}>Your Rights</Text>
                <Text style={styles.policyParagraph}>
                  You can request access to, correction of, or deletion of your personal data by contacting{' '}
                  <Text
                    style={styles.linkText}
                    onPress={() => Linking.openURL('mailto:ziprocket.support@gmail.com')}
                  >
                    ziprocket.support@gmail.com
                  </Text>.
                </Text>

                <View style={styles.slateBox}>
                  <Text style={styles.slateBoxTitle}>Grievance Officer</Text>
                  <Text style={styles.slateBoxText}>
                    <Text style={styles.boldText}>Anish Arora</Text>, reachable at{' '}
                    <Text
                      style={styles.linkText}
                      onPress={() => Linking.openURL('mailto:ziprocket.support@gmail.com')}
                    >
                      ziprocket.support@gmail.com
                    </Text>
                    , for any privacy-related concerns or complaints under applicable Indian data protection law.
                  </Text>
                </View>
              </View>
            )}

            {/* 5. Refund Policy */}
            {selectedLegalDoc === 'refund' && (
              <View>
                <Text style={styles.policyHeading}>Refund Policy</Text>
                <Text style={styles.policyTagline}>Cancellations, returns, and refund processing terms</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policySubheading}>Cancellation & Refund Guidelines</Text>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Cancellation Before Acceptance: </Text>
                    If an order is cancelled before the restaurant/store accepts it, a full refund is processed automatically for online payments.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Post-Acceptance Policy: </Text>
                    Once a restaurant/store has accepted an order, it generally cannot be cancelled, since preparation begins immediately.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Damaged or Incorrect Items: </Text>
                    If you receive a missing, incorrect, or damaged item, please contact us via WhatsApp (
                    <Text
                      style={[styles.linkText, { color: '#16A34A' }]}
                      onPress={() =>
                        Linking.openURL(
                          'https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20have%20an%20issue%20with%20my%20order'
                        )
                      }
                    >
                      +91 9117662441
                    </Text>
                    ) within 30 minutes of delivery with details/photos, and we will investigate and issue a refund or replacement where applicable.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Refund Timelines: </Text>
                    Approved refunds for online (UPI) payments are processed back to your original payment method within 24-48 hours. Actual credit to your account may take a few additional business days depending on your bank/UPI provider.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Cash on Delivery: </Text>
                    Cash on Delivery orders that are cancelled or undelivered do not require a refund, since no payment was collected upfront.
                  </Text>
                </View>
              </View>
            )}

            {/* 6. Shipping & Delivery Policy */}
            {selectedLegalDoc === 'shipping' && (
              <View>
                <Text style={styles.policyHeading}>Shipping & Delivery Policy</Text>
                <Text style={styles.policyTagline}>Hyperlocal fulfillment and delivery information</Text>
                <View style={styles.policyDivider} />

                <Text style={styles.policyLead}>
                  ZipRocket delivers food and grocery orders within defined hyperlocal delivery zones, currently centered around Benipatti, Madhubani, Bihar. Delivery availability, distance limits, and fees are shown at checkout before you place an order, and vary based on your exact location.
                </Text>

                <Text style={styles.policySubheading}>Delivery Terms</Text>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Delivery Estimates: </Text>
                    Estimated delivery time is shown at checkout and includes both preparation time and travel time.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Delivery Charges: </Text>
                    Delivery fees are calculated based on distance from the restaurant/store to your address, and may include a small platform and packaging fee, shown transparently in your bill before payment.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Free Delivery: </Text>
                    Orders above a certain value (shown at checkout, varies by zone) qualify for free delivery.
                  </Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    <Text style={styles.boldText}>Service Zones: </Text>
                    We currently only deliver within our active service zones; addresses outside these zones cannot be served, and this will be indicated at checkout.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setDeleteModalVisible(false);
            setDeleteConfirmText('');
            setDeleteError(null);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <View style={styles.confirmModalIconCircle}>
                <MaterialIcons name="warning" size={28} color={Colors.error} />
              </View>
              <Text style={styles.confirmModalTitle}>Delete Account?</Text>
            </View>

            <View style={styles.warningList}>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet}>•</Text>
                <Text style={styles.warningText}>
                  Your profile, saved addresses and notification settings will be permanently deleted.
                </Text>
              </View>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet}>•</Text>
                <Text style={styles.warningText}>
                  Past order records may be kept for accounting and legal reasons.
                </Text>
              </View>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet}>•</Text>
                <Text style={[styles.warningText, styles.warningBold]}>
                  This cannot be undone.
                </Text>
              </View>
            </View>

            <Text style={styles.inputPrompt}>
              To confirm, type <Text style={styles.boldDelete}>DELETE</Text> below:
            </Text>

            <TextInput
              style={styles.confirmInput}
              value={deleteConfirmText}
              onChangeText={(text) => {
                setDeleteConfirmText(text);
                if (deleteError) setDeleteError(null);
              }}
              placeholder="Type DELETE"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
            />

            {deleteError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  if (!isDeleting) {
                    setDeleteModalVisible(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmDeleteButton,
                  deleteConfirmText !== 'DELETE' || isDeleting
                    ? styles.confirmDeleteButtonDisabled
                    : null,
                ]}
                onPress={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Delete my account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  tabScrollWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: Spacing.xxl * 2,
  },
  policyHeading: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  policyTagline: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: 4,
  },
  policyDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  policyLead: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  policySubheading: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  policyParagraph: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  highlightBox: {
    backgroundColor: Colors.orange50,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  highlightTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  bulletDot: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  boldText: {
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  linkText: {
    fontFamily: FontFamily.bold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  contactIconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTextCol: {
    flex: 1,
  },
  contactLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  contactValue: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
  },
  slateBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  slateBoxTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  slateBoxText: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.errorLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  deleteAccountText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.md,
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  confirmModalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  confirmModalTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  warningList: {
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  warningBullet: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    marginRight: 6,
    lineHeight: 18,
  },
  warningText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  warningBold: {
    fontFamily: FontFamily.bold,
    color: Colors.error,
  },
  inputPrompt: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  boldDelete: {
    fontFamily: FontFamily.extraBold,
    color: Colors.error,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
  },
  confirmDeleteButton: {
    flex: 1.4,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteButtonDisabled: {
    backgroundColor: Colors.slate300,
    opacity: 0.6,
  },
  confirmDeleteButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.white,
  },
});
