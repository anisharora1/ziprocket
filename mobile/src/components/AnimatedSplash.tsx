import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
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

  // Pulse width for phase 2: about 35% of track width
  const pulseWidth = Math.round(wordmarkWidth * 0.35);

  // Animation shared values
  const revealWidth = useSharedValue(0);
  const barOpacity = useSharedValue(1);
  const trackOpacity = useSharedValue(0);
  const pulseTranslateX = useSharedValue(-pulseWidth);
  const splashOpacity = useSharedValue(1);

  // State to track timing conditions
  const [phase1Done, setPhase1Done] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const isFinishedRef = useRef(false);

  // Animated styles
  const revealAnimatedStyle = useAnimatedStyle(() => ({
    width: revealWidth.value,
  }));

  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: revealWidth.value - 28 }],
    opacity: barOpacity.value,
  }));

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: trackOpacity.value,
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pulseTranslateX.value }],
  }));

  const splashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  // Handle completion of Phase 1
  const handlePhase1Complete = useCallback(() => {
    setPhase1Done(true);

    // Start Phase 2: Fade in track and loop orange gradient pulse left to right
    trackOpacity.value = withTiming(1, { duration: 250 });
    pulseTranslateX.value = -pulseWidth;
    pulseTranslateX.value = withRepeat(
      withTiming(wordmarkWidth, {
        duration: 1100,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [pulseWidth, wordmarkWidth, trackOpacity, pulseTranslateX]);

  // Phase 1 start & minimum 2200ms timer
  useEffect(() => {
    // Reveal wordmark left to right in ~1400ms with Easing.out cubic
    revealWidth.value = withTiming(
      wordmarkWidth,
      {
        duration: 1400,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          // Hide leading edge bar when phase 1 ends
          barOpacity.value = withTiming(0, { duration: 150 });
          runOnJS(handlePhase1Complete)();
        }
      }
    );

    // Minimum display duration: 2200ms since mount
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2200);

    return () => {
      clearTimeout(timer);
      cancelAnimation(revealWidth);
      cancelAnimation(barOpacity);
      cancelAnimation(trackOpacity);
      cancelAnimation(pulseTranslateX);
      cancelAnimation(splashOpacity);
    };
  }, [wordmarkWidth, revealWidth, barOpacity, trackOpacity, pulseTranslateX, splashOpacity, handlePhase1Complete]);

  // Finish: when phase 1 is done AND ready === true AND at least 2200ms have passed since mount
  useEffect(() => {
    if (phase1Done && minTimePassed && ready && !isFinishedRef.current) {
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
  }, [phase1Done, minTimePassed, ready, onFinish, splashOpacity]);

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
      {/* Centered Wordmark with reveal effect & glowing current bar */}
      <View style={{ width: wordmarkWidth, height: wordmarkHeight, position: 'relative' }}>
        {/* Overflow-hidden reveal container */}
        <Animated.View style={[{ height: wordmarkHeight, overflow: 'hidden' }, revealAnimatedStyle]}>
          <Image
            source={require('../../assets/images/splash-wordmark.png')}
            style={{ width: wordmarkWidth, height: wordmarkHeight }}
            contentFit="contain"
          />
        </Animated.View>

        {/* Leading edge glowing current bar (56px wide) with centered 2px orange line */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.currentBar,
            barAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255, 92, 0, 0)',
              'rgba(255, 92, 0, 0.9)',
              '#FFFFFF',
              'rgba(255, 92, 0, 0.9)',
              'rgba(255, 92, 0, 0)',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.currentBarCenterLine} />
        </Animated.View>
      </View>

      {/* PHASE 2: Thin loading line under wordmark (3px high rounded track) */}
      <Animated.View
        style={[
          styles.track,
          { width: wordmarkWidth },
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
  currentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBarCenterLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#FF5C00',
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFE3D2',
    overflow: 'hidden',
    marginTop: 24,
  },
  pulse: {
    height: 3,
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
