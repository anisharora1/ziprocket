import {
  getAuth,
  signInWithPhoneNumber as fbSignInWithPhoneNumber,
  signOut as fbSignOut,
  ConfirmationResult,
  User,
} from '@react-native-firebase/auth';
import {
  getMessaging,
  getToken as fbGetToken,
  onMessage as fbOnMessage,
  onNotificationOpenedApp as fbOnNotificationOpenedApp,
  onTokenRefresh as fbOnTokenRefresh,
  getInitialNotification as fbGetInitialNotification,
  setBackgroundMessageHandler as fbSetBackgroundMessageHandler,
  deleteToken as fbDeleteToken,
  RemoteMessage,
  Messaging,
} from '@react-native-firebase/messaging';

/**
 * React Native Firebase Auth wrapper providing standard auth() helper
 * compatible with modular v26+ and user-specified API.
 */
export const auth = () => {
  const authInstance = getAuth();
  return {
    get currentUser(): User | null {
      return authInstance.currentUser;
    },
    signInWithPhoneNumber: (phoneNumber: string) =>
      fbSignInWithPhoneNumber(authInstance, phoneNumber),
    signOut: () => fbSignOut(authInstance),
  };
};

/**
 * React Native Firebase Messaging wrapper providing standard messaging() helper
 * compatible with modular v26+ and user-specified API.
 */
export const messaging = () => {
  const instance = getMessaging();
  return {
    getToken: () => fbGetToken(instance),
    onTokenRefresh: (listener: (token: string) => any) => fbOnTokenRefresh(instance, listener),
    onMessage: (listener: (message: RemoteMessage) => any) => fbOnMessage(instance, listener),
    onNotificationOpenedApp: (listener: (message: RemoteMessage) => any) =>
      fbOnNotificationOpenedApp(instance, listener),
    getInitialNotification: () => fbGetInitialNotification(instance),
    setBackgroundMessageHandler: (handler: (message: RemoteMessage) => Promise<any>) =>
      fbSetBackgroundMessageHandler(instance, handler),
    deleteToken: () => fbDeleteToken(instance),
  };
};

messaging.setBackgroundMessageHandler = (handler: (message: RemoteMessage) => Promise<any>) => {
  const instance = getMessaging();
  return fbSetBackgroundMessageHandler(instance, handler);
};

export default auth;
export type { ConfirmationResult, User, RemoteMessage, Messaging };
