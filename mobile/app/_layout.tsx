import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { AuthProvider } from '../src/context/AuthContext';
import { SocketProvider } from '../src/context/SocketContext';
import { LocationProvider, useLocation } from '../src/context/LocationContext';
import { PlatformProvider } from '../src/context/PlatformContext';
import { CartProvider } from '../src/context/CartContext';
import { Colors } from '../src/constants/theme';
import LocationPromptModal from '../src/components/LocationPromptModal';
import LocationSelectorModal from '../src/components/LocationSelectorModal';

function LocationModals() {
  const { isPickerOpen, closePicker } = useLocation();
  return (
    <>
      <LocationPromptModal />
      <LocationSelectorModal visible={isPickerOpen} onClose={closePicker} />
    </>
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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <LocationProvider>
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
                </CartProvider>
              </PlatformProvider>
            </LocationProvider>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
