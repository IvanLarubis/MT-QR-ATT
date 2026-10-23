
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

type EventRow = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  event_id: string;
  student_id: string;
  scanned_at: string;
};

type Attendee = AttendanceRow & {
  student_name: string | null;
};

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [names, setNames] = useState<Record<string, string | null>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkRole() {
      setChecking(true);

      if (!user) {
        if (active) {
          setAuthorized(false);
          setChecking(false);
        }
        return;
      }

      try {
        const profile = await getProfile(user.id);
        if (active) {
          setAuthorized(profile?.role === 'admin');
        }
      } catch {
        if (active) setAuthorized(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    checkRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const loadData = useCallback(async (refresh = false) => {
    if (!authorized) return;

    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, event_code, title, start_time, end_time, created_at')
        .order('created_at', { ascending: false });

      if (eventError) throw eventError;

      const { data: attendanceData, error: attendanceError } =
        await supabase
          .from('attendance')
          .select('id, event_id, student_id, scanned_at')
          .order('scanned_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const rows = (attendanceData ?? []) as AttendanceRow[];

      const studentIds = [...new Set(rows.map((row) => row.student_id))];

      const nameMap: Record<string, string | null> = {};

      if (studentIds.length > 0) {
        // Fetch profiles separately because attendance has no
        // direct PostgREST relationship with profiles.
        for (let i = 0; i < studentIds.length; i += 100) {
          const batch = studentIds.slice(i, i + 100);

          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', batch);

          if (profileError) throw profileError;

          (profiles ?? []).forEach((profile) => {
            nameMap[profile.id] = profile.full_name ?? null;
          });
        }
      }

      setEvents((eventData ?? []) as EventRow[]);
      setAttendance(rows);
      setNames(nameMap);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load attendance records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authorized]);

  useEffect(() => {
    if (authorized) loadData();
  }, [authorized, loadData]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};

    attendance.forEach((row) => {
      result[row.event_id] = (result[row.event_id] ?? 0) + 1;
    });

    return result;
  }, [attendance]);

  const filteredEvents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return events.filter((event) =>
      event.title.toLowerCase().includes(keyword) ||
      event.event_code.toLowerCase().includes(keyword)
    );
  }, [events, search]);

  const currentEvent = events.find((event) => event.id === selectedEvent);

  const attendees: Attendee[] = useMemo(() => {
    if (!selectedEvent) return [];

    return attendance
      .filter((row) => row.event_id === selectedEvent)
      .map((row) => ({
        ...row,
        student_name: names[row.student_id] ?? null,
      }));
  }, [attendance, names, selectedEvent]);

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled';

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Invalid date';

    return parsed.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />
        <Text style={styles.heading}>Access Denied</Text>
        <Text style={styles.muted}>Administrators only.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/admin')}
        >
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Overall Attendance',
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.heading}>Overall Attendance</Text>
        <Text style={styles.muted}>
          Monitor attendance across all school events.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{events.length}</Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{attendance.length}</Text>
            <Text style={styles.statLabel}>Attendance Records</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 36 }}
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadData()}>
              <Text style={styles.linkText}>Try Again</Text>
            </Pressable>
          </View>
        ) : selectedEvent ? (
          <>
            <Pressable
              style={styles.backButton}
              onPress={() => setSelectedEvent(null)}
            >
              <Ionicons name="arrow-back" size={19} color={COLORS.primary} />
              <Text style={styles.linkText}>All Events</Text>
            </Pressable>

            <View style={styles.eventCard}>
              <Text style={styles.eventTitle}>
                {currentEvent?.title ?? 'Event'}
              </Text>
              <Text style={styles.eventCode}>
                {currentEvent?.event_code}
              </Text>
              <Text style={styles.eventMeta}>
                {attendees.length} registered attendee(s)
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Student Attendance</Text>

            {attendees.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="people-outline"
                  size={32}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.muted}>
                  No attendance records for this event.
                </Text>
              </View>
            ) : (
              attendees.map((attendee) => (
                <View key={attendee.id} style={styles.attendeeCard}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={20} color={COLORS.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendeeName}>
                      {attendee.student_name || 'Unnamed Student'}
                    </Text>
                    <Text style={styles.attendeeMeta}>
                      ID: {attendee.student_id.slice(0, 8)}...
                    </Text>
                    <Text style={styles.attendeeMeta}>
                      Scanned: {formatDate(attendee.scanned_at)}
                    </Text>
                  </View>

                  <Ionicons
                    name="checkmark-circle"
                    size={23}
                    color="#22C55E"
                  />
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>School Events</Text>

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search event title or code"
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
              />
            </View>

            {filteredEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.muted}>No events found.</Text>
              </View>
            ) : (
              filteredEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => setSelectedEvent(event.id)}
                >
                  <View style={styles.eventHeader}>
                    <View style={styles.eventIcon}>
                      <Ionicons
                        name="calendar"
                        size={23}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventCode}>{event.event_code}</Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.eventMeta}>
                      {formatDate(event.start_time)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.eventMeta}>
                      {counts[event.id] ?? 0} attendee(s)
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  content: {
    padding: 20,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  muted: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 26,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 17,
    gap: 7,
  },
  statNumber: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 52,
    gap: 10,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 13,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  eventIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#8B5CF622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  eventMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  attendeeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#8B5CF622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeeMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
});
