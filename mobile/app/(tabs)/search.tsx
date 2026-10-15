import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SearchScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace({
      pathname: '/(tabs)/home',
      params: { focusSearch: String(Date.now()) },
    });
  }, [router]);

  return null;
}
