import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

export interface AnimatedSplashProps {
  ready: boolean;
  onFinish: () => void;
  onLayout?: () => void;
}

export default function AnimatedSplash({ ready, onFinish, onLayout }: AnimatedSplashProps) {
  const { width: screenWidth } = useWindowDimensions();

  // Wordmark size: width = min(screenWidth * 0.78, 360); height = width / 3.6036
  const wordmarkWidth = Math.min(screenWidth * 0.78, 360);
  const wordmarkHeight = wordmarkWidth / 3.6036;

  // Pulse width for thin loading line: about 35% of track width
  const pulseWidth = Math.round(wordmarkWidth * 0.35);

  // Sweep band configuration
  const BAND_WIDTH = 70;
  const BAND_OFFSET = 100; // Extra offset to account for skewX -20deg

  // Animation shared values
  const zMarkOpacity = useSharedValue(1);
  const wordmarkOpacity = useSharedValue(0);
  const trackOpacity = useSharedValue(0);
  const sweepTranslateX = useSharedValue(-BAND_OFFSET);
  const pulseTranslateX = useSharedValue(-pulseWidth);
  const splashOpacity = useSharedValue(1);

  // Timing states
  const [minTimePassed, setMinTimePassed] = useState(false);
  const isFinishedRef = useRef(false);

  // Animated styles
  const zMarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: zMarkOpacity.value,
  }));

  const wordmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
  }));

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: trackOpacity.value,
  }));

  const sweepAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sweepTranslateX.value },
      { skewX: '-20deg' },
    ],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pulseTranslateX.value }],
  }));

  const splashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  // Start the sweep overlay & track pulse animations after crossfade
  const startLoops = useCallback(() => {
    // Sweep overlay: translates from -BAND_OFFSET to wordmarkWidth + BAND_OFFSET with 400ms pause
    sweepTranslateX.value = -BAND_OFFSET;
    sweepTranslateX.value = withRepeat(
      withSequence(
        withTiming(wordmarkWidth + BAND_OFFSET, {
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
        }),
        withDelay(
          400,
          withTiming(-BAND_OFFSET, {
            duration: 0,
          })
        )
      ),
      -1,
      false
    );

    // Thin loading line pulse: runs left to right repeatedly (1100ms, linear, no reverse)
    pulseTranslateX.value = -pulseWidth;
    pulseTranslateX.value = withRepeat(
      withTiming(wordmarkWidth, {
        duration: 1100,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [wordmarkWidth, pulseWidth, sweepTranslateX, pulseTranslateX]);

  useEffect(() => {
    // Crossfade (300ms): Z mark fades out while wordmark and loading track fade in
    zMarkOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.inOut(Easing.quad),
    });

    wordmarkOpacity.value = withTiming(
      1,
      {
        duration: 300,
        easing: Easing.inOut(Easing.quad),
      },
      (finished) => {
        if (finished) {
          runOnJS(startLoops)();
        }
      }
    );

    trackOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.inOut(Easing.quad),
    });

    // Minimum display duration: 2400ms since mount
    const minTimer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2400);

    return () => {
      clearTimeout(minTimer);
      cancelAnimation(zMarkOpacity);
      cancelAnimation(wordmarkOpacity);
      cancelAnimation(trackOpacity);
      cancelAnimation(sweepTranslateX);
      cancelAnimation(pulseTranslateX);
      cancelAnimation(splashOpacity);
    };
  }, [zMarkOpacity, wordmarkOpacity, trackOpacity, sweepTranslateX, pulseTranslateX, splashOpacity, startLoops]);

  // Finish: when ready === true and at least 2400ms have passed since mount
  useEffect(() => {
    if (minTimePassed && ready && !isFinishedRef.current) {
      isFinishedRef.current = true;
      splashOpacity.value = withTiming(
        0,
        {
          duration: 350,
          easing: Easing.out(Easing.ease),
        },
        (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        }
      );
    }
  }, [minTimePassed, ready, onFinish, splashOpacity]);

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        splashAnimatedStyle,
      ]}
    >
      {/* Centered content box matching wordmark dimensions */}
      <View style={{ width: wordmarkWidth, height: wordmarkHeight, position: 'relative' }}>
        {/* Full Wordmark (Fixed size, plain white background) */}
        <Animated.View
          style={[
            {
              width: wordmarkWidth,
              height: wordmarkHeight,
              position: 'relative',
            },
            wordmarkAnimatedStyle,
          ]}
        >
          <Image
            source={require('../../assets/images/splash-wordmark.png')}
            style={{ width: wordmarkWidth, height: wordmarkHeight }}
            contentFit="contain"
          />

          {/* Running current sweep overlay across the wordmark */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { overflow: 'hidden' },
            ]}
          >
            <Animated.View
              style={[
                styles.sweepBand,
                {
                  width: BAND_WIDTH,
                  height: wordmarkHeight + 40,
                  top: -20,
                },
                sweepAnimatedStyle,
              ]}
            >
              <LinearGradient
                colors={[
                  'rgba(255, 255, 255, 0)',
                  'rgba(255, 255, 255, 0)',
                  'rgba(255, 255, 255, 0.85)',
                  'rgba(255, 150, 40, 0.35)',
                  'rgba(255, 255, 255, 0)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Thin loading line under wordmark (3px high rounded track) */}
        <Animated.View
          style={[
            styles.track,
            {
              width: wordmarkWidth,
              top: wordmarkHeight + 24,
            },
            trackAnimatedStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.pulse,
              { width: pulseWidth },
              pulseAnimatedStyle,
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 92, 0, 0)', '#FF5C00', 'rgba(255, 92, 0, 0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        {/* Initial Z Mark (150dp wide, centered exactly where native splash is) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.zMarkContainer,
            {
              left: (wordmarkWidth - 150) / 2,
              top: (wordmarkHeight - 150) / 2,
            },
            zMarkAnimatedStyle,
          ]}
        >
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={{ width: 150, height: 150 }}
            contentFit="contain"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zMarkContainer: {
    position: 'absolute',
    width: 150,
    height: 150,
  },
  sweepBand: {
    position: 'absolute',
    left: 0,
  },
  track: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFE3D2',
    overflow: 'hidden',
  },
  pulse: {
    height: 3,
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
