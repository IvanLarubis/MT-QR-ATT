import React, { useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  useWindowDimensions, 
  ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';

export default function HomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions(); 
  const isSmallDevice = height < 700;

  // Background animations
  const bgOpacity = useSharedValue(0);
  const bgScale = useSharedValue(0.8);
  const bg2Opacity = useSharedValue(0);
  const bg2Scale = useSharedValue(0.8);

  useEffect(() => {
    bgOpacity.value = withDelay(100, withTiming(1, { duration: 800 }));
    bgScale.value = withDelay(100, withTiming(1, { duration: 800 }));
    
    bg2Opacity.value = withDelay(300, withTiming(0.05, { duration: 1000 }));
    bg2Scale.value = withDelay(300, withTiming(1, { duration: 1000 }));
  }, []);

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgScale.value }],
  }));

  const animatedBg2Style = useAnimatedStyle(() => ({
    opacity: bg2Opacity.value,
    transform: [{ scale: bg2Scale.value }],
  }));

  // Dynamic Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* Decorative Background Elements */}
      <Animated.View style={[styles.bgCircle1, animatedBgStyle]} />
      <Animated.View style={[styles.bgCircle2, animatedBg2Style]} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.headerSection}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.content}>
          {/* Animated Badge */}
          <Animated.View 
            entering={FadeInUp.delay(200)} 
            style={styles.badgeContainer}
          >
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.badgeText}>{greeting}</Text>
          </Animated.View>

          {/* Animated Titles */}
          <Animated.Text 
            entering={FadeInUp.delay(300)} 
            style={[
              styles.mainTitle, 
              { fontSize: isSmallDevice ? 28 : 34, lineHeight: isSmallDevice ? 36 : 44 }
            ]}
          >
            School Event{'\n'}Attendance
          </Animated.Text>
          
          <Animated.Text 
            entering={FadeInUp.delay(400)} 
            style={styles.subtitle}
          >
            Scan event QR codes to record your attendance instantly.
          </Animated.Text>
        </View>

        {/* Spacer to push buttons to bottom */}
        <View style={{ flex: 1, minHeight: 40 }} />

        <View style={styles.buttonStack}>
          {/* Primary Action - Elevated with a soft shadow */}
          <Animated.View 
            entering={FadeInDown.delay(500)} 
            style={styles.primaryButtonWrapper}
          >
            <AppButton
              theme="primary"
              title="Scan QR Code"
              icon="qr-code-outline"
              onPress={() => router.push('/scan')}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600)}>
            <AppButton
              title="Attendance History"
              icon="time-outline"
              onPress={() => router.push('/history')}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700)}>
            <AppButton
              title="Profile"
              icon="person-outline"
              onPress={() => router.push('/profile')}
            />
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1, 
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  
  // --- Decorative Backgrounds ---
  bgCircle1: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.primary,
    opacity: 0.15, // Slightly more visible
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
  },

  // --- Header & Content ---
  headerSection: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  content: {
    marginBottom: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)', // Soft primary color (adjust RGB if needed)
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 20,
    gap: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -1, // Tighter letter spacing looks more modern
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSecondary,
    paddingRight: 24, 
    fontWeight: '400',
  },

  // --- Buttons ---
  buttonStack: {
    gap: 16, // Slightly more breathing room between buttons
  },
  primaryButtonWrapper: {
    // Adds a soft glow/shadow to the primary scan button
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8, 
    zIndex: 1,
  }
});