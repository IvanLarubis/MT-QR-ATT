
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';

type IconName = React.ComponentProps<
  typeof Ionicons
>['name'];

type MenuItem = {
  title: string;
  description: string;
  icon: IconName;
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Manage Users',
    description: 'View and manage student and teacher accounts',
    icon: 'people-outline',
    route: 'users',
  },
  {
    title: 'Manage Events',
    description: 'Create, edit, and manage school events',
    icon: 'calendar-outline',
    route: 'events',
  },
  {
    title: 'Overall Attendance',
    description: 'Monitor student attendance across all events',
    icon: 'stats-chart-outline',
    route: 'attendance',
  },
  {
    title: 'Attendance Records',
    description: 'Review and correct attendance records',
    icon: 'checkmark-done-outline',
    route: 'records',
  },
  {
    title: 'Reports & Logs',
    description: 'View system reports and activity logs',
    icon: 'document-text-outline',
    route: 'reports',
  },
];

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleNavigation = (item: MenuItem) => {
    if (item.route === 'users') {
      router.push('/admin/users');
      return;
    }

    if (item.route === 'events') {
      router.push('/admin/events');
      return;
    }

    if (item.route === 'attendance') {
      router.push('/admin/attendance');
      return;
    }

    if (item.route === 'records') {
      router.push('/admin/records');
      return;
    }

    if (item.route === 'reports') {
      router.push('/admin/reports');
      return;
    }

    Alert.alert(
      item.title,
      'This module will be implemented in the next development phase.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="shield-checkmark"
              size={28}
              color={COLORS.accent}
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Admin Dashboard
            </Text>
            <Text style={styles.subtitle}>
              QR Attendance Management
            </Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>
            ADMINISTRATOR PORTAL
          </Text>

          <Text style={styles.welcomeTitle}>
            System Management
          </Text>

          <Text style={styles.welcomeDescription}>
            Manage users, events, attendance records,
            and reports from one place.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Management Modules
          </Text>
          <Text style={styles.sectionSubtitle}>
            Select a module to continue
          </Text>
        </View>

        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => handleNavigation(item)}
            style={({ pressed }) => [
              styles.menuCard,
              pressed && styles.menuPressed,
            ]}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name={item.icon}
                size={24}
                color={COLORS.accent}
              />
            </View>

            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                {item.title}
              </Text>

              <Text style={styles.menuDescription}>
                {item.description}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.muted}
            />
          </Pressable>
        ))}

        <View style={styles.footer}>
          <Ionicons
            name="lock-closed-outline"
            size={15}
            color={COLORS.muted}
          />
          <Text style={styles.footerText}>
            Administrator Access Only
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#8B5CF622',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  welcomeCard: {
    backgroundColor: '#211538',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#8B5CF644',
    marginBottom: 30,
  },
  welcomeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#C4B5D8',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8B5CF622',
  },
  menuPressed: {
    opacity: 0.7,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#8B5CF619',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  menuDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 25,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.muted,
  },
});
