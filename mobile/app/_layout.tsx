import React, { useState } from 'react';
import { View, AppState, type AppStateStatus, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SocketProvider } from '../src/context/SocketContext';
import { LocationProvider, useLocation } from '../src/context/LocationContext';
import { PlatformProvider } from '../src/context/PlatformContext';
import { CartProvider } from '../src/context/CartContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import LocationPromptModal from '../src/components/LocationPromptModal';
import LocationSelectorModal from '../src/components/LocationSelectorModal';
import AnimatedSplash from '../src/components/AnimatedSplash';
import OfflineBanner from '../src/components/OfflineBanner';
import { subscribeNetwork } from '../src/services/network';
import {
  queryClient,
  asyncStoragePersister,
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  shouldDehydrateQuery,
} from '../src/services/cache';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Wire React Query onlineManager to the network connectivity store
onlineManager.setEventListener((setOnline) => {
  return subscribeNetwork((isOnline) => {
    setOnline(isOnline);
  });
});

// Wire React Query focusManager to AppState for refetch on foreground
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      handleFocus(status === 'active');
    }
  });

  return () => {
    subscription.remove();
  };
});

function LocationModals() {
  const { isPickerOpen, closePicker } = useLocation();
  return (
    <>
      <LocationPromptModal />
      <LocationSelectorModal visible={isPickerOpen} onClose={closePicker} />
    </>
  );
}

function SplashGate({
  fontsLoaded,
  showSplash,
  onFinish,
}: {
  fontsLoaded: boolean;
  showSplash: boolean;
  onFinish: () => void;
}) {
  const { isLoading: authLoading } = useAuth();

  if (!showSplash) return null;

  return (
    <AnimatedSplash
      ready={fontsLoaded && !authLoading}
      onFinish={onFinish}
      onLayout={() => {
        SplashScreen.hideAsync().catch(() => {});
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [showSplash, setShowSplash] = useState(true);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: CACHE_MAX_AGE,
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery,
          },
        }}
      >
        <AuthProvider>
          <SocketProvider>
            <LocationProvider>
              <NotificationProvider>
                <LocationModals />
                <PlatformProvider>
                  <CartProvider>
                    <StatusBar style="dark" />
                    <OfflineBanner />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" options={{ headerShown: false }} />
                      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="restaurants/[id]" options={{ headerShown: false }} />
                      <Stack.Screen name="grocery/index" options={{ headerShown: false }} />
                      <Stack.Screen name="grocery/category/[categoryName]" options={{ headerShown: false }} />
                      <Stack.Screen name="cart/index" options={{ headerShown: false }} />
                      <Stack.Screen name="checkout/index" options={{ headerShown: false }} />
                      <Stack.Screen name="addresses/index" options={{ headerShown: false }} />
                    </Stack>
                    <SplashGate
                      fontsLoaded={fontsLoaded}
                      showSplash={showSplash}
                      onFinish={() => setShowSplash(false)}
                    />
                  </CartProvider>
                </PlatformProvider>
              </NotificationProvider>
            </LocationProvider>
          </SocketProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
