import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

SplashScreen.preventAutoHideAsync().catch(() => {});

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

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 1000 * 60 * 2, // 2 minutes
          },
        },
      })
  );

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <LocationProvider>
              <NotificationProvider>
                <LocationModals />
                <PlatformProvider>
                  <CartProvider>
                    <StatusBar style="dark" />
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
