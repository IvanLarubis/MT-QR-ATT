
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signIn(
        email.trim(),
        password
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      // Get authenticated user from Supabase
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Unable to verify your account.');
        return;
      }

      // Get actual role from database
      const profile = await getProfile(user.id);

      if (!profile) {
        setError(
          'Unable to load your profile. Please try again.'
        );
        return;
      }

      // Role-based navigation
      if (profile.role === 'admin') {
        router.replace('/(tabs)/admin');
      } else if (
        profile.role === 'teacher' ||
        profile.role === 'student'
      ) {
        router.replace('/(tabs)');
      } else {
        setError('Your account has an invalid role.');
      }
    } catch (err: any) {
      console.error('Login error:', err);

      setError(
        err?.message ||
          'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Animated.View
            entering={FadeInUp.delay(100)}
          >
            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text style={styles.subtitle}>
              Sign in to record your attendance
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(200)}
            style={styles.form}
          >
            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email
              </Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={COLORS.textSecondary}
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Password
              </Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.textSecondary}
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoComplete="password"
                />

                <Pressable
                  onPress={() =>
                    setShowPassword(!showPassword)
                  }
                  style={styles.eyeIcon}
                  disabled={loading}
                >
                  <Ionicons
                    name={
                      showPassword
                        ? 'eye-off-outline'
                        : 'eye-outline'
                    }
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Error */}
            {error && (
              <Animated.View
                entering={FadeInUp}
                style={styles.errorContainer}
              >
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={
                    COLORS.danger || '#ef4444'
                  }
                />

                <Text style={styles.error}>
                  {error}
                </Text>
              </Animated.View>
            )}

            {/* Sign In */}
            <View style={styles.buttonContainer}>
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.loader}
                />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={styles.footer}
          >
            <Link href="/register" asChild>
              <Pressable>
                <Text style={styles.linkText}>
                  Don&apos;t have an account?{' '}
                  <Text style={styles.linkHighlight}>
                    Sign Up
                  </Text>
                </Text>
              </Pressable>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger || '#ef4444',
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loader: {
    marginVertical: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  linkText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  linkHighlight: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});
