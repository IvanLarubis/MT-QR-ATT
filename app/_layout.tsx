
import { useEffect, useState } from 'react';
import {
  Stack,
  useRouter,
  useSegments,
} from 'expo-router';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, Role } from '@/lib/profiles';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRole = async () => {
      if (!session?.user?.id) {
        if (active) {
          setRole(null);
          setCheckingRole(false);
        }
        return;
      }

      setCheckingRole(true);

      try {
        const profile = await getProfile(session.user.id);

        if (active) {
          setRole(profile?.role ?? null);
        }
      } catch (error) {
        console.error('Role loading error:', error);

        if (active) {
          setRole(null);
        }
      } finally {
        if (active) {
          setCheckingRole(false);
        }
      }
    };

    loadRole();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading || checkingRole) return;

    const path = segments[0];
    const currentTab = segments[1];

    const inAuthGroup =
      path === 'login' ||
      path === 'register';

    const inTabsGroup = path === '(tabs)';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/login');
      }
      return;
    }

    if (!role) {
      return;
    }

    if (role === 'admin') {
  // Allow Admin Dashboard, Profile, and Admin subpages
  if (path === 'admin') {
    return;
  }

  if (
    !inTabsGroup ||
    (currentTab !== 'admin' &&
      currentTab !== 'profile')
  ) {
    router.replace('/(tabs)/admin');
  }

  return;
}

    if (role === 'student' || role === 'teacher') {
      if (inAuthGroup || !inTabsGroup) {
        router.replace('/(tabs)');
      }

      if (currentTab === 'admin') {
        router.replace('/(tabs)');
      }
    }
  }, [
    session,
    loading,
    checkingRole,
    role,
    segments,
    router,
  ]);

  if (loading || checkingRole) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.accent}
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false }}
      initialRouteName="login"
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
