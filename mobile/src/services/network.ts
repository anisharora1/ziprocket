import { useSyncExternalStore } from 'react';
import * as Network from 'expo-network';

type NetworkListener = (isOnline: boolean) => void;
type ReconnectCallback = () => void;

let isOnline = true;
let isInitialized = false;

const stateListeners = new Set<NetworkListener>();
const reconnectCallbacks = new Set<ReconnectCallback>();

const computeIsOnline = (state: { isConnected?: boolean; isInternetReachable?: boolean }): boolean => {
  return state.isConnected !== false && state.isInternetReachable !== false;
};

const notifyStateChange = (nextOnline: boolean) => {
  const previousOnline = isOnline;
  isOnline = nextOnline;

  // Notify listeners of the current online status
  stateListeners.forEach((listener) => {
    try {
      listener(nextOnline);
    } catch (e) {
      if (__DEV__) {
        console.warn('[network] State listener error:', e);
      }
    }
  });

  // Fire onReconnect callbacks when transitioning from offline to online
  if (!previousOnline && nextOnline) {
    reconnectCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        if (__DEV__) {
          console.warn('[network] Reconnect callback error:', e);
        }
      }
    });
  }
};

const updateState = (state: { isConnected?: boolean; isInternetReachable?: boolean }) => {
  const nextOnline = computeIsOnline(state);
  if (!isInitialized) {
    isInitialized = true;
    isOnline = nextOnline;
    stateListeners.forEach((listener) => {
      try {
        listener(nextOnline);
      } catch {}
    });
    return;
  }

  if (nextOnline !== isOnline) {
    notifyStateChange(nextOnline);
  }
};

// Retrieve initial connectivity state
Network.getNetworkStateAsync()
  .then((state) => {
    updateState(state);
  })
  .catch((e) => {
    if (__DEV__) {
      console.warn('[network] Failed to get initial network state:', e);
    }
  });

// Listen for network connectivity changes
Network.addNetworkStateListener((state) => {
  updateState(state);
});

/**
 * Returns the current online status synchronously.
 */
export const getIsOnline = (): boolean => isOnline;

/**
 * Subscribes to connectivity state changes.
 * Calls listener immediately with current state and returns an unsubscribe function.
 */
export const subscribeNetwork = (listener: NetworkListener): (() => void) => {
  stateListeners.add(listener);
  try {
    listener(isOnline);
  } catch {}
  return () => {
    stateListeners.delete(listener);
  };
};

/**
 * Registers a callback that fires when state transitions from offline to online.
 * Returns an unsubscribe function.
 */
export const onReconnect = (callback: ReconnectCallback): (() => void) => {
  reconnectCallbacks.add(callback);
  return () => {
    reconnectCallbacks.delete(callback);
  };
};

/**
 * React hook returning the current online status.
 */
export const useIsOnline = (): boolean => {
  return useSyncExternalStore(
    (onStoreChange) => {
      const listener: NetworkListener = () => onStoreChange();
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    getIsOnline,
    () => true
  );
};

/**
 * Actively checks network connectivity using expo-network and updates the store.
 */
export const checkConnectivity = async (): Promise<boolean> => {
  try {
    const state = await Network.getNetworkStateAsync();
    updateState(state);
    return computeIsOnline(state);
  } catch {
    return isOnline;
  }
};
