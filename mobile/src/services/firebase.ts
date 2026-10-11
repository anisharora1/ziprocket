import {
  getAuth,
  signInWithPhoneNumber as fbSignInWithPhoneNumber,
  signOut as fbSignOut,
  ConfirmationResult,
  User,
} from '@react-native-firebase/auth';

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

export default auth;
export type { ConfirmationResult, User };
