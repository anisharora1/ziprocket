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

/**
 * Requests high accuracy GPS coordinates on device, waits for a stable signal,
 * and filters out inaccurate fixes.
 */
export const getHighAccuracyGPSFix = async (
  options: GPSFixOptions = {}
): Promise<GPSFixResult> => {
  const {
    desiredAccuracyMeters = 20,
    maxWaitTimeMs = 6000,
    accuracyThresholdMeters = 150,
  } = options;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Kripya phone settings me location permission on karein.');
  }

  return new Promise(async (resolve, reject) => {
    let bestFix: Location.LocationObject | null = null;
    let subscription: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const resolveWithFix = (pos: Location.LocationObject) => {
      cleanup();
      resolve({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 100,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        timestamp: pos.timestamp,
        isStable: (pos.coords.accuracy ?? 100) <= desiredAccuracyMeters,
      });
    };

    try {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 500,
          distanceInterval: 1,
        },
        (pos) => {
          const acc = pos.coords.accuracy ?? 999;
          if (!bestFix || acc < (bestFix.coords.accuracy ?? 999)) {
            bestFix = pos;
          }
          if (acc <= desiredAccuracyMeters) {
            resolveWithFix(pos);
          }
        }
      );

      timer = setTimeout(async () => {
        if (bestFix && (bestFix.coords.accuracy ?? 999) <= accuracyThresholdMeters) {
          resolveWithFix(bestFix);
        } else {
          try {
            const singleFix = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            resolveWithFix(singleFix);
          } catch (e) {
            if (bestFix) {
              resolveWithFix(bestFix);
            } else {
              cleanup();
              reject(new Error('GPS location nahi mil saka. Kripya phone ki location permission on karein ya open area me jayein.'));
            }
          }
        }
      }, maxWaitTimeMs);
    } catch (err: any) {
      cleanup();
      try {
        const fallbackFix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        resolveWithFix(fallbackFix);
      } catch {
        reject(err);
      }
    }
  });
};
