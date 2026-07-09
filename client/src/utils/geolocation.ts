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
 * Requests high accuracy GPS coordinates, waits for a stable signal,
 * and filters out inaccurate fixes.
 */
export const getHighAccuracyGPSFix = (
  options: GPSFixOptions = {}
): Promise<GPSFixResult> => {
  const {
    timeoutMs = 15000,
    desiredAccuracyMeters = 20, // Stop early if we achieve <= 20 meters accuracy
    maxWaitTimeMs = 5000,       // Wait up to 5 seconds for GPS to calibrate and settle
    accuracyThresholdMeters = 150 // Coarse threshold for stable indicator
  } = options;

  return new Promise(async (resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser / आपके ब्राउज़र में जीपीएस काम नहीं कर रहा है।"));
      return;
    }

    let bestFix: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let watchTimerId: NodeJS.Timeout | null = null;

    const cleanupWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (watchTimerId !== null) {
        clearTimeout(watchTimerId);
        watchTimerId = null;
      }
    };

    // Fallback: Query coarse network coordinates if high-accuracy watch is coarse or fails
    const getCoarseFallback = (): Promise<GeolocationPosition | null> => {
      return new Promise((res) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => res(pos),
          () => res(null),
          {
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 15000 // Allow up to 15s cached coordinates
          }
        );
      });
    };

    const resolveWithFix = (position: GeolocationPosition) => {
      resolve({
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
        },
        timestamp: position.timestamp,
        isStable: position.coords.accuracy <= desiredAccuracyMeters
      });
    };

    // Step 1: Start watch session with enableHighAccuracy: true
    const startWatchSession = () => {
      return new Promise<void>((resolveWatch) => {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const accuracy = position.coords.accuracy;

            if (!bestFix || accuracy < bestFix.coords.accuracy) {
              bestFix = position;
            }

            // Stop early if we achieve very high accuracy
            if (accuracy <= desiredAccuracyMeters) {
              cleanupWatch();
              resolveWithFix(position);
            }
          },
          (err) => {
            cleanupWatch();
            resolveWatch();
          },
          {
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: 0
          }
        );

        // Wait up to maxWaitTimeMs for GPS to warm up and calibrate
        watchTimerId = setTimeout(() => {
          cleanupWatch();
          resolveWatch();
        }, maxWaitTimeMs);
      });
    };

    // Run the fine-grained watch session
    await startWatchSession();

    // Step 2: Fallback to coarse coordinates if watch did not find highly accurate fix
    const currentFix = bestFix as GeolocationPosition | null;
    if (!currentFix || currentFix.coords.accuracy > desiredAccuracyMeters) {
      const coarseFix = await getCoarseFallback();

      if (coarseFix) {
        const latestFix = bestFix as GeolocationPosition | null;
        if (!latestFix || coarseFix.coords.accuracy < latestFix.coords.accuracy) {
          bestFix = coarseFix;
        }
      }
    }

    // Step 3: Final coordinate resolution
    if (bestFix) {
      resolveWithFix(bestFix);
    } else {
      reject(new Error("Could not fetch GPS coordinates. Please check your location permissions or move to an open space. / जीपीएस स्थान प्राप्त नहीं हो सका। कृपया अनुमति जांचें।"));
    }
  });
};
