import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    setProfile(p);
    setDraftName(p?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      await loadProfile();
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  const isTeacher = profile?.role === 'teacher';
  const initial = profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Avatar */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: isTeacher ? 'rgba(139, 92, 246, 0.15)' : 'rgba(6, 182, 212, 0.15)' }]}>
            <Text style={[styles.avatarText, { color: isTeacher ? COLORS.primary : COLORS.accent }]}>
              {initial}
            </Text>
          </View>
          <Text style={styles.title}>My Profile</Text>
          
          <View style={[styles.roleBadge, isTeacher ? styles.roleTeacher : styles.roleStudent]}>
            <Ionicons 
              name={isTeacher ? "briefcase" : "school"} 
              size={12} 
              color={isTeacher ? COLORS.primary : COLORS.accent} 
            />
            <Text style={[styles.roleBadgeText, { color: isTeacher ? COLORS.primary : COLORS.accent }]}>
              {isTeacher ? 'Teacher' : 'Student'}
            </Text>
          </View>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.infoCard}>
          
          {/* Name Row */}
          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.label}>Name</Text>
              {editing ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.muted}
                    editable={!saving}
                    autoFocus
                  />
                  <Pressable
                    style={styles.saveButton}
                    onPress={handleSaveName}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                    ) : (
                      <Ionicons name="checkmark" size={20} color={COLORS.textOnPrimary} />
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setEditing(true)} style={styles.nameRow}>
                  <Text style={styles.value}>
                    {profile?.full_name || 'Tap to add your name'}
                  </Text>
                  <Ionicons name="pencil" size={14} color={COLORS.accent} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Email Row */}
          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email ?? profile?.email ?? 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ID Row */}
          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="finger-print-outline" size={18} color={COLORS.textSecondary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.label}>User ID</Text>
              <Text style={styles.valueSmall} numberOfLines={1}>{user?.id || 'N/A'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Sign Out Button */}
        <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: 'auto' }}>
          <AppButton
            title={signingOut ? "Signing Out..." : "Sign Out"}
            icon="log-out-outline"
            onPress={handleSignOut}
            disabled={signingOut || saving}
          />
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: 24,
    paddingBottom: 32,
  },
  
  // --- Header & Avatar ---
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  roleTeacher: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)', // Soft primary
  },
  roleStudent: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)', // Soft accent
  },
  roleBadgeText: {
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // --- Info Card ---
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', // Very subtle border
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  valueSmall: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Makes ID look cleaner
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 16,
  },

  // --- Edit Mode ---
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameEditRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});