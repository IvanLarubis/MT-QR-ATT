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
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    // Basic Validation
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        role,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true); // Show email verification screen
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Success Screen ---
  if (success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <Animated.View entering={FadeInUp.springify()} style={styles.successWrapper}>
          <View style={styles.successIconContainer}>
            <Ionicons name="mail-unread-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.successTitle}>Check your email!</Text>
          <Text style={styles.successText}>
            We sent a confirmation link to <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{email}</Text>. 
            Click the link to verify your account, then come back and sign in.
          </Text>
          
          <Link href="/login" asChild>
            <Pressable style={styles.backToLoginButton}>
              <Text style={styles.backToLoginText}>Back to Sign In</Text>
            </Pressable>
          </Link>
        </Animated.View>
      </View>
    );
  }

  // --- Registration Form ---
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" // 🔥 Fixes the touch bug
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Animated.View entering={FadeInUp.delay(100)}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Register to start recording attendance
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200)} style={styles.form}>
            
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor={COLORS.muted}
                  editable={!loading}
                  autoComplete="name"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Role Selector */}
            <Text style={styles.label}>I am a...</Text>
            <View style={styles.roleRow}>
              <Pressable
                style={[styles.roleChip, role === 'student' && styles.roleChipActive]}
                onPress={() => setRole('student')}
                disabled={loading}
              >
                <Ionicons 
                  name="school-outline" 
                  size={18} 
                  color={role === 'student' ? COLORS.accent : COLORS.textSecondary} 
                />
                <Text style={[styles.roleChipText, role === 'student' && styles.roleChipTextActive]}>
                  Student
                </Text>
                {role === 'student' && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>

              <Pressable
                style={[styles.roleChip, role === 'teacher' && styles.roleChipActive]}
                onPress={() => setRole('teacher')}
                disabled={loading}
              >
                <Ionicons 
                  name="briefcase-outline" 
                  size={18} 
                  color={role === 'teacher' ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[styles.roleChipText, role === 'teacher' && styles.roleChipTextActive]}>
                  Teacher
                </Text>
                {role === 'teacher' && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View entering={FadeInUp} style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={COLORS.danger || '#ef4444'} />
                <Text style={styles.error}>{error}</Text>
              </Animated.View>
            )}

            {/* Submit Button */}
            <View style={styles.buttonWrapper}>
              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign Up"
                  icon="person-add-outline"
                  onPress={handleRegister}
                />
              )}
            </View>
          </Animated.View>

          {/* Footer Link */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.footer}>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.linkHighlight}>Sign In</Text>
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

  // --- Inputs ---
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    height: 54,
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

  // --- Role Selector ---
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.08)', // Soft glow
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // --- Error ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger || '#ef4444',
    fontWeight: '500',
    flex: 1,
  },

  // --- Buttons & Footer ---
  buttonWrapper: {
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
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

  // --- Success Screen ---
  successWrapper: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  backToLoginButton: {
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  backToLoginText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
});