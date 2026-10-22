import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { PermissionsAndroid, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { apiClient } from '../services/api';
import { messaging, RemoteMessage } from '../services/firebase';
import InAppNotificationBanner, {
  InAppNotificationData,
} from '../components/InAppNotificationBanner';
import NotificationPermissionPromptModal from '../components/NotificationPermissionPromptModal';

// Background message handler: Must be registered at the top-level
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage: RemoteMessage) => {
    if (__DEV__) {
      console.log('[FCM] Background message received');
    }
  });
} catch (e) {
  if (__DEV__) {
    console.warn('[FCM Background Handler Setup Warning]', e);
  }
}

// Storage keys
const STORAGE_DECLINED_AT_KEY = '@ziprocket_notif_declined_at';
const STORAGE_PROMPTED_LOGIN_KEY = '@ziprocket_notif_prompted_login';
const STORAGE_PROMPTED_ORDER_KEY = '@ziprocket_notif_prompted_order';
const STORAGE_MARKETING_OPT_IN_KEY = '@ziprocket_marketing_opt_in';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export interface NotificationContextType {
  fcmToken: string | null;
  marketingOptIn: boolean;
  setMarketingOptIn: (value: boolean) => Promise<void>;
  promptPermission: (trigger: 'login' | 'order_placed') => Promise<void>;
  checkPermissionStatus: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Validates deep link routes against known app routes:
 * /(tabs)/home, /(tabs)/orders, /(tabs)/search, /(tabs)/profile,
 * /restaurants/[id], /grocery, /grocery/category/[categoryName], /cart, /checkout, /addresses.
 * Unknown routes fallback safely to /(tabs)/home.
 */
export function validateNotificationRoute(rawRoute?: string | null): string {
  if (!rawRoute || typeof rawRoute !== 'string') {
    return '/(tabs)/home';
  }

  const trimmed = rawRoute.trim();

  // 1. Static tabs and direct screens
  const validStaticRoutes = [
    '/(tabs)/home',
    '/(tabs)/orders',
    '/(tabs)/search',
    '/(tabs)/profile',
    '/grocery',
    '/cart',
    '/checkout',
    '/addresses',
  ];

  if (validStaticRoutes.includes(trimmed)) {
    return trimmed;
  }

  // 2. Dynamic restaurant route: /restaurants/[id]
  if (/^\/restaurants\/[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  // 3. Dynamic grocery category route: /grocery/category/[categoryName]
  if (/^\/grocery\/category\/[^/]+$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback
  return '/(tabs)/home';
}

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { zoneId, coords } = useLocation();

  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [activeBanner, setActiveBanner] = useState<InAppNotificationData | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);
  const [marketingOptIn, setMarketingOptInState] = useState(true);

  const prevUserRef = useRef(user);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRouteRef = useRef<string | null>(null);
  const pendingCampaignIdRef = useRef<string | null>(null);
  const isNavReadyRef = useRef(false);

  // 1. Track notification opened (fire-and-forget)
  const trackNotificationOpened = useCallback((campaignId?: string | null) => {
    if (!campaignId) return;
    apiClient
      .post('/notifications/opened', { campaignId })
      .catch((err) => {
        if (__DEV__) {
          console.warn('[Notification API] /notifications/opened failed silently:', err.message);
        }
      });
  }, []);

  // 2. Safely perform deep-link navigation once auth is ready
  const performNavigation = useCallback(
    (targetRoute: string, campaignId?: string | null) => {
      const safeRoute = validateNotificationRoute(targetRoute);

      if (authLoading || !isNavReadyRef.current) {
        // Queue it until auth bootstrap finishes
        pendingRouteRef.current = safeRoute;
        pendingCampaignIdRef.current = campaignId || null;
        return;
      }

      try {
        router.push(safeRoute as any);
        if (campaignId) {
          trackNotificationOpened(campaignId);
        }
      } catch (err: any) {
        if (__DEV__) {
          console.warn('[Notification] Navigation error:', err.message);
        }
        router.push('/(tabs)/home');
      }
    },
    [authLoading, router, trackNotificationOpened]
  );

  // Process queued notification navigation after auth is loaded
  useEffect(() => {
    // Small delay to ensure router layout is completely mounted
    const timer = setTimeout(() => {
      isNavReadyRef.current = true;
      if (!authLoading && pendingRouteRef.current) {
        const route = pendingRouteRef.current;
        const campaign = pendingCampaignIdRef.current;
        pendingRouteRef.current = null;
        pendingCampaignIdRef.current = null;
        performNavigation(route, campaign);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [authLoading, performNavigation]);

  // 3. Permission checks
  const checkPermissionStatus = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version < 33) {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return granted;
    } catch {
      return false;
    }
  }, []);

  // 4. Retrieve FCM Token & listen for token refresh
  useEffect(() => {
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const initFcm = async () => {
      try {
        // Request token directly from Firebase Messaging
        const tokenVal = await messaging().getToken();
        if (tokenVal) {
          setFcmToken(tokenVal);
          if (__DEV__) {
            console.log('[FCM] Token retrieved successfully');
          }
        }
      } catch (err: any) {
        if (__DEV__) {
          console.warn('[FCM] getToken error:', err.message);
        }
      }

      try {
        unsubscribeTokenRefresh = messaging().onTokenRefresh((newToken: string) => {
          if (newToken) {
            setFcmToken(newToken);
            if (__DEV__) {
              console.log('[FCM] Token refreshed');
            }
          }
        });
      } catch (err: any) {
        if (__DEV__) {
          console.warn('[FCM] onTokenRefresh listener error:', err.message);
        }
      }
    };

    initFcm();

    return () => {
      if (unsubscribeTokenRefresh) {
        unsubscribeTokenRefresh();
      }
    };
  }, []);

  // 5. Register device with backend whenever:
  // - token changes
  // - user logs in / out
  // - zoneId or coords change
  // Debounced by 2 seconds. All /notifications/* calls fail silently in Stage 1.
  useEffect(() => {
    if (!fcmToken) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const payload: Record<string, any> = {
          token: fcmToken,
          platform: 'android',
          appVersion: Constants.expoConfig?.version || '1.0.0',
        };

        if (zoneId) {
          payload.zoneId = zoneId;
        }

        if (coords?.lat && coords?.lng) {
          payload.lastLocation = { lat: coords.lat, lng: coords.lng };
        }

        await apiClient.post('/notifications/register-device', payload);
        if (__DEV__) {
          console.log('[Notification API] Registered device token successfully');
        }
      } catch (err: any) {
        if (__DEV__) {
          console.warn(
            '[Notification API] /notifications/register-device failed silently:',
            err.message
          );
        }
      }
    }, 2000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fcmToken, user, token, zoneId, coords?.lat, coords?.lng]);

  // 6. On user logout: call POST /notifications/unlink-user { token }
  useEffect(() => {
    if (prevUserRef.current && !user && fcmToken) {
      apiClient
        .post('/notifications/unlink-user', { token: fcmToken })
        .then(() => {
          if (__DEV__) {
            console.log('[Notification API] Unlinked device token on logout');
          }
        })
        .catch((err: any) => {
          if (__DEV__) {
            console.warn(
              '[Notification API] /notifications/unlink-user failed silently:',
              err.message
            );
          }
        });
    }
    prevUserRef.current = user;
  }, [user, fcmToken]);

  // 7. Load and sync marketing preferences from AsyncStorage
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_MARKETING_OPT_IN_KEY);
        if (saved !== null) {
          setMarketingOptInState(saved === 'true');
        }
      } catch {
        // default true
      }
    };
    loadPreference();
  }, []);

  const setMarketingOptIn = useCallback(async (value: boolean) => {
    setMarketingOptInState(value);
    try {
      await AsyncStorage.setItem(STORAGE_MARKETING_OPT_IN_KEY, String(value));
      await apiClient.put('/notifications/preferences', { marketingOptIn: value });
      if (__DEV__) {
        console.log('[Notification API] Synced marketing opt-in preference');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.warn(
          '[Notification API] /notifications/preferences failed silently:',
          err.message
        );
      }
    }
  }, []);

  // 8. Foreground push notifications: show In-App Banner
  useEffect(() => {
    let unsubscribeMessage: (() => void) | undefined;

    try {
      unsubscribeMessage = messaging().onMessage(async (remoteMessage: RemoteMessage) => {
        if (__DEV__) {
          console.log('[FCM] Foreground message received');
        }

        const title =
          remoteMessage.notification?.title ||
          (remoteMessage.data?.title as string) ||
          'ZipRocket';
        const body =
          remoteMessage.notification?.body ||
          (remoteMessage.data?.body as string) ||
          'New notification received';
        const imageUrl =
          remoteMessage.notification?.android?.imageUrl ||
          (remoteMessage.notification as any)?.imageUrl ||
          (remoteMessage.data?.imageUrl as string) ||
          null;
        const route = (remoteMessage.data?.route as string) || null;
        const campaignId = (remoteMessage.data?.campaignId as string) || null;

        setActiveBanner({
          title,
          body,
          imageUrl,
          route,
          campaignId,
        });
      });
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[FCM] onMessage listener error:', err.message);
      }
    }

    return () => {
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
    };
  }, []);

  // 9. Notification Taps when app is opened from background or killed state
  useEffect(() => {
    // Case A: App in background and tapped
    let unsubscribeOpenedApp: (() => void) | undefined;
    try {
      unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage: RemoteMessage) => {
        if (__DEV__) {
          console.log('[FCM] Notification opened from background');
        }
        const route = (remoteMessage.data?.route as string) || null;
        const campaignId = (remoteMessage.data?.campaignId as string) || null;
        performNavigation(route || '/(tabs)/home', campaignId);
      });
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[FCM] onNotificationOpenedApp error:', err.message);
      }
    }

    // Case B: App killed/closed and opened via notification tap (cold start)
    messaging()
      .getInitialNotification()
      .then((remoteMessage: RemoteMessage | null) => {
        if (remoteMessage) {
          if (__DEV__) {
            console.log('[FCM] Initial notification (cold start) opened');
          }
          const route = (remoteMessage.data?.route as string) || null;
          const campaignId = (remoteMessage.data?.campaignId as string) || null;
          performNavigation(route || '/(tabs)/home', campaignId);
        }
      })
      .catch((err: any) => {
        if (__DEV__) {
          console.warn('[FCM] getInitialNotification error:', err.message);
        }
      });

    return () => {
      if (unsubscribeOpenedApp) {
        unsubscribeOpenedApp();
      }
    };
  }, [performNavigation]);

  // 10. Prompting Permission at friendly moments (Login / First Order)
  const promptPermission = useCallback(
    async (trigger: 'login' | 'order_placed') => {
      if (Platform.OS !== 'android') return;
      if (Platform.Version < 33) return; // Notifications granted by default on Android < 13

      // Check if already granted
      const alreadyGranted = await checkPermissionStatus();
      if (alreadyGranted) return;

      // Check 14-day snooze
      try {
        const declinedAtStr = await AsyncStorage.getItem(STORAGE_DECLINED_AT_KEY);
        if (declinedAtStr) {
          const declinedAt = parseInt(declinedAtStr, 10);
          if (Date.now() - declinedAt < FOURTEEN_DAYS_MS) {
            // Snoozed
            return;
          }
        }

        // Check if prompted for this specific trigger event
        const triggerStorageKey =
          trigger === 'login' ? STORAGE_PROMPTED_LOGIN_KEY : STORAGE_PROMPTED_ORDER_KEY;
        const alreadyPrompted = await AsyncStorage.getItem(triggerStorageKey);
        if (alreadyPrompted === 'true') {
          return;
        }

        // Mark this trigger as handled
        await AsyncStorage.setItem(triggerStorageKey, 'true');

        // Check if permanently denied
        setIsPermanentlyDenied(false);
        setShowPermissionPrompt(true);
      } catch (e) {
        if (__DEV__) {
          console.warn('[Notification] Prompt check error:', e);
        }
      }
    },
    [checkPermissionStatus]
  );

  const handleAllowPermission = async () => {
    if (Platform.OS !== 'android') {
      setShowPermissionPrompt(false);
      return;
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setShowPermissionPrompt(false);
        // Refresh token now that permission is allowed
        const tokenVal = await messaging().getToken();
        if (tokenVal) {
          setFcmToken(tokenVal);
          if (__DEV__) {
            console.log('[FCM] Token retrieved successfully');
          }
        }
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        // Permanently denied
        setIsPermanentlyDenied(true);
      } else {
        // User clicked Deny
        await AsyncStorage.setItem(STORAGE_DECLINED_AT_KEY, Date.now().toString());
        setShowPermissionPrompt(false);
      }
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[Notification] Permission request error:', err.message);
      }
      setShowPermissionPrompt(false);
    }
  };

  const handleDeclinePermission = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_DECLINED_AT_KEY, Date.now().toString());
    } catch {
      // Ignored
    }
    setShowPermissionPrompt(false);
  };

  const handleOpenSettings = () => {
    setShowPermissionPrompt(false);
    Linking.openSettings().catch(() => {});
  };

  const handleBannerPress = (notif: InAppNotificationData) => {
    performNavigation(notif.route || '/(tabs)/home', notif.campaignId);
  };

  const handleBannerDismiss = () => {
    setActiveBanner(null);
  };

  const contextValue = useMemo(
    () => ({
      fcmToken,
      marketingOptIn,
      setMarketingOptIn,
      promptPermission,
      checkPermissionStatus,
    }),
    [fcmToken, marketingOptIn, setMarketingOptIn, promptPermission, checkPermissionStatus]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Foreground in-app notification banner */}
      <InAppNotificationBanner
        notification={activeBanner}
        onPress={handleBannerPress}
        onDismiss={handleBannerDismiss}
      />

      {/* Friendly Hinglish permission pre-prompt modal */}
      <NotificationPermissionPromptModal
        visible={showPermissionPrompt}
        isPermanentlyDenied={isPermanentlyDenied}
        onAllow={handleAllowPermission}
        onDecline={handleDeclinePermission}
        onOpenSettings={handleOpenSettings}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
