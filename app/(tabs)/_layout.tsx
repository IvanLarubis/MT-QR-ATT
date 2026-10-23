
import { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, Role } from '@/lib/profiles';

export default function TabLayout() {
  const { session, loading } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRole() {
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
        console.error('Failed to load user role:', error);

        if (active) {
          setRole(null);
        }
      } finally {
        if (active) {
          setCheckingRole(false);
        }
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (loading || checkingRole) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: '#100C1D',
          borderTopColor: '#8B5CF644',
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isAdmin ? 'Admin' : 'Home',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="qr-code-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="time-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: isTeacher ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="clipboard-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="shield-checkmark-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
