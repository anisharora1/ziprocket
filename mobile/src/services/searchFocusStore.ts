import { useSyncExternalStore } from 'react';

type Listener = () => void;
let isSearchFocused = false;
const listeners = new Set<Listener>();

export const searchFocusStore = {
  getIsFocused: () => isSearchFocused,
  setIsFocused: (focused: boolean) => {
    if (isSearchFocused !== focused) {
      isSearchFocused = focused;
      listeners.forEach((listener) => listener());
    }
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useIsSearchFocused(): boolean {
  return useSyncExternalStore(
    searchFocusStore.subscribe,
    searchFocusStore.getIsFocused,
    searchFocusStore.getIsFocused
  );
}
