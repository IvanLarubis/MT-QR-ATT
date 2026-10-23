import { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  LayoutAnimation, // 🔥 For smooth expand/collapse
  Platform,
  UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function shortId(id: string) {
  return id ? `ID: …${id.slice(-6).toUpperCase()}` : 'Unknown ID';
}

// 🔥 Separate Component for Teacher Event Card (para organized)
const TeacherEventCard = ({ item, index }: { item: TeacherEventAttendance; index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    // Smooth animation sa pag-open/close
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).springify()} style={styles.card}>
      {/* Header - Clickable to expand */}
      <Pressable onPress={toggleExpand} style={styles.cardHeaderPressable}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="ticket-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.meta}>{item.eventCode}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.attendeeCount}</Text>
            </View>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={COLORS.textSecondary} 
              style={{ marginLeft: 8 }}
            />
          </View>
        </View>
      </Pressable>

      {/* Date Info (Always visible) */}
      {item.startTime && (
        <View style={[styles.metaRow, { marginTop: 4 }]}>
          <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.meta}>{formatDate(item.startTime)}</Text>
        </View>
      )}

      {/* Expandable Attendee List */}
      {isExpanded && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.expandedContent}>
          <View style={styles.divider} />
          
          <Text style={styles.expandedTitle}>Attendees ({item.attendeeCount})</Text>
          
          {item.attendees.length === 0 ? (
            <Text style={[styles.muted, { textAlign: 'left', fontStyle: 'italic', marginTop: 8 }]}>
              No scans yet.
            </Text>
          ) : (
            item.attendees.map((a) => (
              <View key={a.studentId} style={styles.attendeeRow}>
                <View style={styles.attendeeAvatar}>
                  <Text style={styles.avatarInitial}>
                    {a.studentName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName}>
                    {a.studentName ?? shortId(a.studentId)}
                  </Text>
                  <Text style={styles.attendeeTime}>
                    {formatDate(a.scannedAt)}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success || '#22c55e'} />
              </View>
            ))
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); // 🔥 Search state

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';
    setRole(currentRole);

    if (currentRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);
      // Sort by date (newest first)
      const sortedEvents = events.sort((a, b) => 
        new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
      );
      setTeacherEvents(sortedEvents);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 🔥 Filter events based on search
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return teacherEvents;
    return teacherEvents.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.eventCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teacherEvents, searchQuery]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Fetching records...</Text>
      </View>
    );
  }

  const EmptyState = ({ title, message, icon }: { title: string, message: string, icon: any }) => (
    <View style={styles.centered}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name={icon} size={48} color={COLORS.primary} style={{ opacity: 0.8 }} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );

  // --- TEACHER VIEW ---
  if (role === 'teacher') {
    if (teacherEvents.length === 0) {
      return (
        <EmptyState 
          icon="calendar-outline"
          title="No events yet" 
          message="Create an event in the Teacher tab to see attendance here." 
        />
      );
    }
    
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events or codes..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={filteredEvents}
          keyExtractor={(item) => item.eventId}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.muted, { marginTop: 20 }]}>No events match your search.</Text>
          }
          renderItem={({ item, index }) => (
            <TeacherEventCard item={item} index={index} />
          )}
        />
      </View>
    );
  }

  // --- STUDENT VIEW (Unchanged) ---
  if (studentRecords.length === 0) {
    return (
      <EmptyState 
        icon="document-text-outline"
        title="No records yet" 
        message="Scan an event QR code to record your attendance." 
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={studentRecords}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInUp.delay(index * 100).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>{item.eventTitle}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="barcode-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.meta}>{shortId(item.eventId)}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success || '#22c55e'} />
            <Text style={styles.meta}>Scanned: {formatDate(item.scannedAt)}</Text>
          </View>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  
  // 🔥 Search Bar
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  // Card Styles
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderPressable: {
    paddingBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 13,
  },

  // Metadata
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },

  // Expanded Content
  expandedContent: {
    marginTop: 4,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Attendees
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  attendeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  attendeeTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Generic Text
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  muted: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});