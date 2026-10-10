import * as Location from 'expo-location';

export interface GPSFixOptions {
  timeoutMs?: number;
  desiredAccuracyMeters?: number;
  maxWaitTimeMs?: number;
  accuracyThresholdMeters?: number;
}

export interface GPSFixResult {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
  isStable: boolean;
}

export interface GPSError extends Error {
  canAskAgain?: boolean;
  isServicesDisabled?: boolean;
}

/**
 * Requests high accuracy GPS coordinates on device, waits for a stable signal,
 * and filters out inaccurate fixes.
 * Ports web getHighAccuracyGPSFix algorithm 1:1 with expo-location.
 */
export const getHighAccuracyGPSFix = async (
  options: GPSFixOptions = {}
): Promise<GPSFixResult> => {
  const {
    timeoutMs = 15000,
    desiredAccuracyMeters = 20, // Stop early if we achieve <= 20 meters accuracy
    maxWaitTimeMs = 5000,       // Allow up to 5 seconds for GPS hardware to settle
    accuracyThresholdMeters = 150, // Coarse threshold for stable indicator
  } = options;

  // 1. Check if device location services are enabled
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      const err: GPSError = new Error('Phone ka GPS/Location ON karein');
      err.isServicesDisabled = true;
      throw err;
    }
  } catch (err: any) {
    if (err.isServicesDisabled) throw err;
    // Non-fatal if hasServicesEnabledAsync fails on certain platforms, continue to permissions
  }

  // 2. Check and request location permissions
  const permResponse = await Location.requestForegroundPermissionsAsync();
  if (permResponse.status !== Location.PermissionStatus.GRANTED) {
    const err: GPSError = new Error(
      'Could not fetch GPS coordinates. Please check your location permissions or move to an open space. / जीपीएस स्थान प्राप्त नहीं हो सका। कृपया अनुमति जांचें।'
    );
    err.canAskAgain = permResponse.canAskAgain;
    throw err;
  }

  return new Promise(async (resolve, reject) => {
    let bestFix: Location.LocationObject | null = null;
    let subscription: Location.LocationSubscription | null = null;
    let watchTimerId: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;

    const cleanupWatch = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      if (watchTimerId) {
        clearTimeout(watchTimerId);
        watchTimerId = null;
      }
    };

    const resolveWithFix = (position: Location.LocationObject) => {
      cleanupWatch();
      const accuracy = position.coords.accuracy ?? 100;
      resolve({
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
        },
        timestamp: position.timestamp,
        isStable: accuracy <= desiredAccuracyMeters,
      });
    };

    // Coarse fallback: query fresh position if watch did not achieve desired accuracy
    const getCoarseFallback = async (): Promise<Location.LocationObject | null> => {
      try {
        return await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (e) {
        return null;
      }
    };

    // Step 1: Start watch session with BestForNavigation / High accuracy
    const startWatchSession = () => {
      return new Promise<void>(async (resolveWatch) => {
        try {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 1000,
              distanceInterval: 0,
            },
            (position) => {
              const accuracy = position.coords.accuracy ?? 999;

              if (!bestFix || accuracy < (bestFix.coords.accuracy ?? 999)) {
                bestFix = position;
              }

              // Stop early if we achieve <= desiredAccuracyMeters
              if (accuracy <= desiredAccuracyMeters) {
                cleanupWatch();
                resolveWithFix(position);
                resolveWatch();
              }
            }
          );
        } catch (watchErr) {
          cleanupWatch();
          resolveWatch();
          return;
        }

        // Wait up to maxWaitTimeMs for GPS to warm up and calibrate
        watchTimerId = setTimeout(() => {
          cleanupWatch();
          resolveWatch();
        }, maxWaitTimeMs);
      });
    };

    try {
      await startWatchSession();

      // If already resolved by early exit, finish
      const initialFix = bestFix as Location.LocationObject | null;
      if (isCleanedUp && initialFix && (initialFix.coords.accuracy ?? 999) <= desiredAccuracyMeters) {
        return;
      }

      // Step 2: Fallback to coarse coordinates if watch did not find highly accurate fix
      const currentFix = bestFix as Location.LocationObject | null;
      if (!currentFix || (currentFix.coords.accuracy ?? 999) > desiredAccuracyMeters) {
        const coarseFix = await getCoarseFallback();
        if (coarseFix) {
          const latestFix = bestFix as Location.LocationObject | null;
          if (!latestFix || (coarseFix.coords.accuracy ?? 999) < (latestFix.coords.accuracy ?? 999)) {
            bestFix = coarseFix;
          }
        }
      }

      // Step 3: Final coordinate resolution
      if (bestFix) {
        resolveWithFix(bestFix);
      } else {
        cleanupWatch();
        const err: GPSError = new Error(
          'Could not fetch GPS coordinates. Please check your location permissions or move to an open space. / जीपीएस स्थान प्राप्त नहीं हो सका। कृपया अनुमति जांचें।'
        );
        reject(err);
      }
    } catch (err: any) {
      cleanupWatch();
      reject(err);
    }
  });
};
