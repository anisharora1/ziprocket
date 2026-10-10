import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, FontFamily } from '../../src/constants/theme';
import FloatingCartButton from '../../src/components/FloatingCartButton';
import { useIsSearchFocused } from '../../src/services/searchFocusStore';

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isSearchFocused = useIsSearchFocused();
  const bottomInset = Math.max(insets.bottom, 10);
  const tabHeight = 56 + bottomInset;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.borderLight,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: FontFamily.semibold,
            fontSize: Typography.fontSize.sm,
            fontWeight: Typography.fontWeight.semibold,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarAccessibilityLabel: isSearchFocused ? 'Home tab' : 'Home, active tab',
            tabBarIcon: ({ size, focused }) => {
              const active = focused && !isSearchFocused;
              return (
                <MaterialIcons
                  name="home"
                  size={size || 24}
                  color={active ? Colors.primary : Colors.textSecondary}
                />
              );
            },
            tabBarLabel: ({ focused }) => {
              const active = focused && !isSearchFocused;
              return (
                <Text
                  style={[
                    styles.tabBarLabel,
                    { color: active ? Colors.primary : Colors.textSecondary },
                  ]}
                >
                  Home
                </Text>
              );
            },
          }}
        />
        <Tabs.Screen
          name="search"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate({
                pathname: '/(tabs)/home',
                params: { focusSearch: String(Date.now()) },
              });
            },
          }}
          options={{
            title: 'Search',
            tabBarAccessibilityLabel: isSearchFocused ? 'Search, active tab' : 'Search tab',
            tabBarIcon: ({ size }) => (
              <MaterialIcons
                name="search"
                size={size || 24}
                color={isSearchFocused ? Colors.primary : Colors.textSecondary}
              />
            ),
            tabBarLabel: () => (
              <Text
                style={[
                  styles.tabBarLabel,
                  { color: isSearchFocused ? Colors.primary : Colors.textSecondary },
                ]}
              >
                Search
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="receipt-long" size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size || 24} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Floating Cart Button placed directly above safe bottom tab bar */}
      <FloatingCartButton bottomOffset={tabHeight + 12} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
});
