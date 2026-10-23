
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
  created_at: string;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type AuditRow = {
  id: string;
  attendance_id: string | null;
  student_id: string;
  event_id: string;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  old_scanned_at: string | null;
  new_scanned_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type EventReport = EventRow & {
  attendeeCount: number;
};

const formatDate = (value: string | null) => {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const actionColor = (action: string) => {
  switch (action) {
    case 'INSERT':
      return '#22C55E';
    case 'UPDATE':
      return '#F59E0B';
    case 'DELETE':
      return '#EF4444';
    default:
      return COLORS.primary;
  }
};

const actionIcon = (
  action: string
): React.ComponentProps<typeof Ionicons>['name'] => {
  switch (action) {
    case 'INSERT':
      return 'add-circle-outline';
    case 'UPDATE':
      return 'create-outline';
    case 'DELETE':
      return 'trash-outline';
    default:
      return 'document-text-outline';
  }
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'reports' | 'logs'>(
    'reports'
  );

  const [search, setSearch] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  useEffect(() => {
    let active = true;

    async function checkAccess() {
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

    checkAccess();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const loadData = useCallback(
    async (refresh = false) => {
      if (!authorized) return;

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const [
          eventResult,
          attendanceResult,
          auditResult,
          profileResult,
        ] = await Promise.all([
          supabase
            .from('events')
            .select(
              'id, event_code, title, start_time, created_at'
            )
            .order('created_at', { ascending: false }),

          supabase
            .from('attendance')
            .select('id, student_id, event_id, scanned_at')
            .order('scanned_at', { ascending: false }),

          supabase
            .from('attendance_audit_logs')
            .select(
              'id, attendance_id, student_id, event_id, action, reason, changed_by, changed_at, old_scanned_at, new_scanned_at'
            )
            .order('changed_at', { ascending: false })
            .limit(500),

          supabase
            .from('profiles')
            .select('id, full_name, email'),
        ]);

        if (eventResult.error) throw eventResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (auditResult.error) throw auditResult.error;
        if (profileResult.error) throw profileResult.error;

        setEvents((eventResult.data ?? []) as EventRow[]);
        setAttendance(
          (attendanceResult.data ?? []) as AttendanceRow[]
        );
        setAuditLogs((auditResult.data ?? []) as AuditRow[]);
        setProfiles((profileResult.data ?? []) as ProfileRow[]);
      } catch (err: any) {
        setError(
          err?.message ?? 'Unable to load reports and audit logs.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authorized]
  );

  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized, loadData]);

  const eventReports = useMemo<EventReport[]>(() => {
    const countMap: Record<string, number> = {};

    attendance.forEach((row) => {
      countMap[row.event_id] =
        (countMap[row.event_id] ?? 0) + 1;
    });

    return events.map((event) => ({
      ...event,
      attendeeCount: countMap[event.id] ?? 0,
    }));
  }, [events, attendance]);

  const profileMap = useMemo(() => {
    return new Map(
      profiles.map((profile) => [profile.id, profile])
    );
  }, [profiles]);

  const eventMap = useMemo(() => {
    return new Map(
      events.map((event) => [event.id, event])
    );
  }, [events]);

  const uniqueStudents = useMemo(() => {
    return new Set(
      attendance.map((row) => row.student_id)
    ).size;
  }, [attendance]);

  const topEvent = useMemo(() => {
    if (eventReports.length === 0) return null;

    return [...eventReports].sort(
      (a, b) => b.attendeeCount - a.attendeeCount
    )[0];
  }, [eventReports]);

  const filteredEvents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return eventReports.filter(
      (event) =>
        event.title.toLowerCase().includes(keyword) ||
        event.event_code.toLowerCase().includes(keyword)
    );
  }, [eventReports, search]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const student = profileMap.get(log.student_id);
      const admin = log.changed_by
        ? profileMap.get(log.changed_by)
        : null;
      const event = eventMap.get(log.event_id);

      const matchesAction =
        logFilter === 'ALL' || log.action === logFilter;

      const searchableText = [
        student?.full_name,
        student?.email,
        admin?.full_name,
        admin?.email,
        event?.title,
        event?.event_code,
        log.action,
        log.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesAction && searchableText.includes(keyword);
    });
  }, [auditLogs, search, logFilter, profileMap, eventMap]);

  const renderStatCard = (
    title: string,
    value: number,
    icon: React.ComponentProps<typeof Ionicons>['name']
  ) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.muted}>
          Checking admin access...
        </Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed"
          size={42}
          color={COLORS.primary}
        />

        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.muted}>
          Administrators only.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/admin')}
        >
          <Text style={styles.backButtonText}>
            Back to Dashboard
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reports & Logs',
          headerStyle: {
            backgroundColor: COLORS.background,
          },
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
        <Text style={styles.title}>Reports & Logs</Text>

        <Text style={styles.muted}>
          Event statistics and attendance activity history.
        </Text>

        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'reports' && styles.activeTab,
            ]}
            onPress={() => {
              setActiveTab('reports');
              setSearch('');
            }}
          >
            <Ionicons
              name="bar-chart-outline"
              size={18}
              color={
                activeTab === 'reports'
                  ? COLORS.primary
                  : COLORS.textSecondary
              }
            />

            <Text
              style={[
                styles.tabText,
                activeTab === 'reports' &&
                  styles.activeTabText,
              ]}
            >
              Reports
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              activeTab === 'logs' && styles.activeTab,
            ]}
            onPress={() => {
              setActiveTab('logs');
              setSearch('');
            }}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={
                activeTab === 'logs'
                  ? COLORS.primary
                  : COLORS.textSecondary
              }
            />

            <Text
              style={[
                styles.tabText,
                activeTab === 'logs' &&
                  styles.activeTabText,
              ]}
            >
              Audit Logs
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 40 }}
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable onPress={() => loadData()}>
              <Text style={styles.linkText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {activeTab === 'reports' && (
              <>
                <View style={styles.statsGrid}>
                  {renderStatCard(
                    'Total Events',
                    events.length,
                    'calendar-outline'
                  )}

                  {renderStatCard(
                    'Attendance Records',
                    attendance.length,
                    'checkmark-circle-outline'
                  )}

                  {renderStatCard(
                    'Unique Students',
                    uniqueStudents,
                    'people-outline'
                  )}

                  {renderStatCard(
                    'Audit Entries',
                    auditLogs.length,
                    'document-text-outline'
                  )}
                </View>

                {topEvent && (
                  <View style={styles.highlightCard}>
                    <Ionicons
                      name="trophy-outline"
                      size={25}
                      color={COLORS.primary}
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightLabel}>
                        Highest Attendance
                      </Text>

                      <Text style={styles.highlightTitle}>
                        {topEvent.title}
                      </Text>

                      <Text style={styles.muted}>
                        {topEvent.attendeeCount} attendees
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.sectionTitle}>
                  Event Attendance Report
                </Text>
              </>
            )}

            {activeTab === 'logs' && (
              <>
                <View style={styles.summaryCard}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={24}
                    color={COLORS.primary}
                  />

                  <View>
                    <Text style={styles.summaryValue}>
                      {auditLogs.length}
                    </Text>

                    <Text style={styles.muted}>
                      Recent Audit Entries
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>
                  Attendance Activity
                </Text>
              </>
            )}

            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={19}
                color={COLORS.muted}
              />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  activeTab === 'reports'
                    ? 'Search event name or code'
                    : 'Search student, event, admin, or reason'
                }
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
              />
            </View>

            {activeTab === 'reports' ? (
              filteredEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={34}
                    color={COLORS.textSecondary}
                  />

                  <Text style={styles.muted}>
                    No events found.
                  </Text>
                </View>
              ) : (
                filteredEvents.map((event) => {
                  const percentage =
                    attendance.length > 0
                      ? (event.attendeeCount /
                          attendance.length) *
                        100
                      : 0;

                  return (
                    <View
                      key={event.id}
                      style={styles.reportCard}
                    >
                      <View style={styles.reportHeader}>
                        <View style={styles.eventIcon}>
                          <Ionicons
                            name="calendar-outline"
                            size={21}
                            color={COLORS.primary}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventTitle}>
                            {event.title}
                          </Text>

                          <Text style={styles.eventCode}>
                            {event.event_code}
                          </Text>
                        </View>

                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>
                            {event.attendeeCount}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.eventDate}>
                        {formatDate(
                          event.start_time || event.created_at
                        )}
                      </Text>

                      <View style={styles.progressBackground}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                percentage,
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.reportFooter}>
                        <Text style={styles.muted}>
                          {event.attendeeCount} attendance
                          records
                        </Text>

                        <Text style={styles.percentageText}>
                          {percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {['ALL', 'INSERT', 'UPDATE', 'DELETE'].map(
                    (action) => (
                      <Pressable
                        key={action}
                        style={[
                          styles.filterChip,
                          logFilter === action &&
                            styles.activeFilterChip,
                        ]}
                        onPress={() => setLogFilter(action)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            logFilter === action &&
                              styles.activeFilterChipText,
                          ]}
                        >
                          {action === 'ALL'
                            ? 'All'
                            : action === 'INSERT'
                            ? 'Added'
                            : action === 'UPDATE'
                            ? 'Updated'
                            : 'Deleted'}
                        </Text>
                      </Pressable>
                    )
                  )}
                </ScrollView>

                {filteredLogs.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="document-outline"
                      size={34}
                      color={COLORS.textSecondary}
                    />

                    <Text style={styles.muted}>
                      No audit logs found.
                    </Text>
                  </View>
                ) : (
                  filteredLogs.map((log) => {
                    const student = profileMap.get(
                      log.student_id
                    );

                    const admin = log.changed_by
                      ? profileMap.get(log.changed_by)
                      : null;

                    const event = eventMap.get(log.event_id);

                    const color = actionColor(log.action);

                    return (
                      <View
                        key={log.id}
                        style={styles.logCard}
                      >
                        <View style={styles.logHeader}>
                          <View
                            style={[
                              styles.logIcon,
                              {
                                backgroundColor:
                                  `${color}20`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={actionIcon(log.action)}
                              size={21}
                              color={color}
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.logTitle}>
                              {log.action === 'INSERT'
                                ? 'Attendance Added'
                                : log.action === 'UPDATE'
                                ? 'Attendance Updated'
                                : log.action === 'DELETE'
                                ? 'Attendance Removed'
                                : log.action}
                            </Text>

                            <Text style={styles.logDate}>
                              {formatDate(log.changed_at)}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.actionBadge,
                              {
                                backgroundColor:
                                  `${color}20`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionBadgeText,
                                { color },
                              ]}
                            >
                              {log.action}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.logDetails}>
                          <Text style={styles.detailText}>
                            Student: {student?.full_name ||
                              student?.email ||
                              log.student_id}
                          </Text>

                          <Text style={styles.detailText}>
                            Event: {event?.title ||
                              log.event_id}
                          </Text>

                          <Text style={styles.detailText}>
                            Changed By:{' '}
                            {admin?.full_name ||
                              admin?.email ||
                              (log.changed_by
                                ? log.changed_by
                                : 'System / Unknown')}
                          </Text>

                          {log.reason && (
                            <Text style={styles.reasonText}>
                              Reason: {log.reason}
                            </Text>
                          )}

                          {log.action === 'UPDATE' && (
                            <>
                              <Text style={styles.detailText}>
                                Previous:{' '}
                                {formatDate(
                                  log.old_scanned_at
                                )}
                              </Text>

                              <Text style={styles.detailText}>
                                Updated:{' '}
                                {formatDate(
                                  log.new_scanned_at
                                )}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}

                {auditLogs.length >= 500 && (
                  <Text style={styles.limitNote}>
                    Showing the latest 500 audit entries.
                  </Text>
                )}
              </>
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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  muted: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 5,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 5,
    marginTop: 22,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
  },
  activeTab: {
    backgroundColor: '#8B5CF622',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 17,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#8B5CF622',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  highlightCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 19,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  highlightLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  highlightTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 25,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  reportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 13,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#8B5CF622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: '#8B5CF622',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  countText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  eventDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 13,
    marginBottom: 14,
  },
  progressBackground: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  percentageText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryValue: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  filterRow: {
    gap: 9,
    paddingBottom: 16,
  },
  filterChip: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  activeFilterChip: {
    backgroundColor: '#8B5CF622',
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  activeFilterChipText: {
    color: COLORS.primary,
  },
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 17,
    marginBottom: 13,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  logDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  actionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logDetails: {
    marginTop: 15,
    gap: 8,
  },
  detailText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  reasonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  backButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '800',
  },
  limitNote: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 10,
  },
});
