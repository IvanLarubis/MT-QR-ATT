
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

type EventRow = {
  id: string;
  event_code: string;
  title: string;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type DisplayRecord = AttendanceRow & {
  studentName: string;
  studentEmail: string;
  eventTitle: string;
  eventCode: string;
};

const formatDate = (value: string) => {
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

export default function AdminRecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [editRecord, setEditRecord] = useState<DisplayRecord | null>(null);
  const [editDate, setEditDate] = useState(new Date());
  const [editReason, setEditReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [addVisible, setAddVisible] = useState(false);
  const [addEventId, setAddEventId] = useState('');
  const [addStudentId, setAddStudentId] = useState('');
  const [addDate, setAddDate] = useState(new Date());
  const [addReason, setAddReason] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const [deleteRecordData, setDeleteRecordData] =
    useState<DisplayRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [picker, setPicker] = useState<'edit' | 'add' | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

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
        if (active) {
          setAuthorized(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
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
        const [eventResult, attendanceResult, profileResult] =
          await Promise.all([
            supabase
              .from('events')
              .select('id, event_code, title')
              .order('title', { ascending: true }),

            supabase
              .from('attendance')
              .select('id, student_id, event_id, scanned_at')
              .order('scanned_at', { ascending: false }),

            supabase
              .from('profiles')
              .select('id, full_name, email, role')
              .eq('role', 'student')
              .order('full_name', { ascending: true }),
          ]);

        if (eventResult.error) throw eventResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (profileResult.error) throw profileResult.error;

        setEvents((eventResult.data ?? []) as EventRow[]);
        setRecords((attendanceResult.data ?? []) as AttendanceRow[]);
        setStudents((profileResult.data ?? []) as StudentRow[]);
      } catch (err: any) {
        setError(err?.message ?? 'Could not load attendance records.');
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

  const displayRecords = useMemo<DisplayRecord[]>(() => {
    const eventMap = new Map(
      events.map((event) => [event.id, event])
    );

    const studentMap = new Map(
      students.map((student) => [student.id, student])
    );

    return records.map((record) => {
      const event = eventMap.get(record.event_id);
      const student = studentMap.get(record.student_id);

      return {
        ...record,
        studentName: student?.full_name || 'Unnamed Student',
        studentEmail: student?.email || '',
        eventTitle: event?.title || 'Unknown Event',
        eventCode: event?.event_code || '',
      };
    });
  }, [records, events, students]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return displayRecords.filter((record) => {
      const matchesEvent =
        eventFilter === 'all' ||
        record.event_id === eventFilter;

      const matchesSearch =
        record.studentName.toLowerCase().includes(keyword) ||
        record.studentEmail.toLowerCase().includes(keyword) ||
        record.eventTitle.toLowerCase().includes(keyword) ||
        record.eventCode.toLowerCase().includes(keyword);

      return matchesEvent && matchesSearch;
    });
  }, [displayRecords, search, eventFilter]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();

    return students.filter(
      (student) =>
        (student.full_name ?? '').toLowerCase().includes(keyword) ||
        (student.email ?? '').toLowerCase().includes(keyword)
    );
  }, [students, studentSearch]);

  const openEdit = (record: DisplayRecord) => {
    setEditRecord(record);
    setEditDate(new Date(record.scanned_at));
    setEditReason('');
  };

  const openAdd = () => {
    setAddEventId('');
    setAddStudentId('');
    setAddDate(new Date());
    setAddReason('');
    setStudentSearch('');
    setAddVisible(true);
  };

  const openDelete = (record: DisplayRecord) => {
    setDeleteRecordData(record);
    setDeleteReason('');
  };

  const openPicker = (target: 'edit' | 'add') => {
    setPicker(target);
    setPickerMode('date');
  };

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (event.type === 'dismissed') {
      setPicker(null);
      setPickerMode('date');
      return;
    }

    if (selected) {
      if (picker === 'edit') {
        setEditDate((previous) => {
          if (Platform.OS === 'android') {
            const next = new Date(previous);

            if (pickerMode === 'date') {
              next.setFullYear(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
              );
            } else {
              next.setHours(
                selected.getHours(),
                selected.getMinutes(),
                0,
                0
              );
            }

            return next;
          }

          return selected;
        });
      }

      if (picker === 'add') {
        setAddDate((previous) => {
          if (Platform.OS === 'android') {
            const next = new Date(previous);

            if (pickerMode === 'date') {
              next.setFullYear(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
              );
            } else {
              next.setHours(
                selected.getHours(),
                selected.getMinutes(),
                0,
                0
              );
            }

            return next;
          }

          return selected;
        });
      }
    }

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setPickerMode('time');
      } else {
        setPicker(null);
        setPickerMode('date');
      }
    }
  };

  const validateReason = (reason: string) => {
    if (!reason.trim()) {
      Alert.alert(
        'Reason Required',
        'Please provide a reason for this attendance correction.'
      );
      return false;
    }

    if (reason.trim().length > 500) {
      Alert.alert(
        'Invalid Reason',
        'Reason must not exceed 500 characters.'
      );
      return false;
    }

    return true;
  };

  const saveCorrection = async () => {
    if (!editRecord || editSaving) return;

    const reason = editReason.trim();

    if (!validateReason(reason)) return;

    if (Number.isNaN(editDate.getTime())) {
      Alert.alert('Invalid Date', 'Please select a valid date and time.');
      return;
    }

    if (
      new Date(editRecord.scanned_at).getTime() ===
      editDate.getTime()
    ) {
      Alert.alert(
        'No Changes',
        'Please select a different attendance date or time.'
      );
      return;
    }

    setEditSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_correct_attendance',
        {
          p_action: 'UPDATE',
          p_reason: reason,
          p_attendance_id: editRecord.id,
          p_scanned_at: editDate.toISOString(),
        }
      );

      if (rpcError) throw rpcError;

      setEditRecord(null);
      await loadData();

      Alert.alert(
        'Success',
        'Attendance corrected successfully. The reason was recorded in the audit log.'
      );
    } catch (err: any) {
      Alert.alert(
        'Update Failed',
        err?.message ?? 'Unable to correct attendance.'
      );
    } finally {
      setEditSaving(false);
    }
  };

  const saveManualAttendance = async () => {
    if (addSaving) return;

    if (!addEventId || !addStudentId) {
      Alert.alert(
        'Missing Information',
        'Please select an event and a student.'
      );
      return;
    }

    const reason = addReason.trim();

    if (!validateReason(reason)) return;

    if (Number.isNaN(addDate.getTime())) {
      Alert.alert('Invalid Date', 'Please select a valid date and time.');
      return;
    }

    setAddSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_correct_attendance',
        {
          p_action: 'INSERT',
          p_reason: reason,
          p_student_id: addStudentId,
          p_event_id: addEventId,
          p_scanned_at: addDate.toISOString(),
        }
      );

      if (rpcError) {
        if (rpcError.code === '23505') {
          throw new Error(
            'This student already has attendance for this event.'
          );
        }

        throw rpcError;
      }

      setAddVisible(false);
      await loadData();

      Alert.alert(
        'Success',
        'Manual attendance added. The reason was recorded in the audit log.'
      );
    } catch (err: any) {
      Alert.alert(
        'Insert Failed',
        err?.message ?? 'Unable to add attendance.'
      );
    } finally {
      setAddSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRecordData || deleteSaving) return;

    const reason = deleteReason.trim();

    if (!validateReason(reason)) return;

    const recordId = deleteRecordData.id;

    setDeleteSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_correct_attendance',
        {
          p_action: 'DELETE',
          p_reason: reason,
          p_attendance_id: recordId,
        }
      );

      if (rpcError) throw rpcError;

      setDeleteRecordData(null);
      setDeleteReason('');

      await loadData();

      Alert.alert(
        'Attendance Removed',
        'The attendance record was removed and the deletion reason was logged.'
      );
    } catch (err: any) {
      Alert.alert(
        'Delete Failed',
        err?.message ?? 'Unable to remove attendance.'
      );
    } finally {
      setDeleteSaving(false);
    }
  };

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
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/admin')}
        >
          <Text style={styles.buttonText}>
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
          title: 'Attendance Records',
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: COLORS.textPrimary,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 40,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              Attendance Records
            </Text>

            <Text style={styles.muted}>
              View and correct student attendance.
            </Text>
          </View>

          <Pressable
            style={styles.addButton}
            onPress={openAdd}
          >
            <Ionicons
              name="add"
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons
            name="document-text-outline"
            size={25}
            color={COLORS.primary}
          />

          <View>
            <Text style={styles.summaryNumber}>
              {records.length}
            </Text>

            <Text style={styles.muted}>
              Total Records
            </Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={19}
            color={COLORS.muted}
          />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search student or event"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
        </View>

        <Pressable
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name="filter-outline"
            size={18}
            color={COLORS.primary}
          />

          <Text style={styles.filterText}>
            {eventFilter === 'all'
              ? 'All Events'
              : events.find(
                  (event) => event.id === eventFilter
                )?.title ?? 'Event'}
          </Text>

          <Ionicons
            name={
              showFilters
                ? 'chevron-up'
                : 'chevron-down'
            }
            size={18}
            color={COLORS.textSecondary}
          />
        </Pressable>

        {showFilters && (
          <View style={styles.filterList}>
            <Pressable
              style={styles.filterItem}
              onPress={() => {
                setEventFilter('all');
                setShowFilters(false);
              }}
            >
              <Text style={styles.filterText}>
                All Events
              </Text>
            </Pressable>

            {events.map((event) => (
              <Pressable
                key={event.id}
                style={styles.filterItem}
                onPress={() => {
                  setEventFilter(event.id);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.filterText}>
                  {event.title} ({event.event_code})
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 30 }}
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable onPress={() => loadData()}>
              <Text style={styles.linkText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="document-outline"
              size={35}
              color={COLORS.textSecondary}
            />

            <Text style={styles.muted}>
              No attendance records found.
            </Text>
          </View>
        ) : (
          filteredRecords.map((record) => (
            <View
              key={record.id}
              style={styles.recordCard}
            >
              <View style={styles.recordHeader}>
                <View style={styles.avatar}>
                  <Ionicons
                    name="person"
                    size={21}
                    color={COLORS.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.recordName}>
                    {record.studentName}
                  </Text>

                  <Text style={styles.recordMeta}>
                    {record.studentEmail}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />

                <Text style={styles.recordMeta}>
                  {record.eventTitle} ({record.eventCode})
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />

                <Text style={styles.recordMeta}>
                  {formatDate(record.scanned_at)}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => openEdit(record)}
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={COLORS.primary}
                  />

                  <Text style={styles.editText}>
                    Correct Time
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => openDelete(record)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color="#EF4444"
                  />

                  <Text style={styles.deleteText}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* CORRECT TIME MODAL */}
      <Modal
        visible={!!editRecord}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!editSaving) setEditRecord(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Correct Attendance Time
              </Text>

              <Text style={styles.muted}>
                {editRecord?.studentName}
              </Text>

              <Text style={styles.fieldLabel}>
                Scan Date & Time
              </Text>

              <Pressable
                style={styles.inputBox}
                onPress={() => openPicker('edit')}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={COLORS.primary}
                />

                <Text style={styles.inputText}>
                  {formatDate(editDate.toISOString())}
                </Text>
              </Pressable>

              <Text style={styles.fieldLabel}>
                Reason for Correction
              </Text>

              <TextInput
                value={editReason}
                onChangeText={setEditReason}
                placeholder="Enter correction reason"
                placeholderTextColor={COLORS.muted}
                style={styles.textInput}
                multiline
                maxLength={500}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  disabled={editSaving}
                  onPress={() => setEditRecord(null)}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  disabled={editSaving}
                  onPress={saveCorrection}
                >
                  {editSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Save Correction
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ADD ATTENDANCE MODAL */}
      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!addSaving) setAddVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Add Manual Attendance
              </Text>

              <Text style={styles.fieldLabel}>
                Select Event
              </Text>

              <ScrollView
                style={styles.selectionList}
                nestedScrollEnabled
              >
                {events.map((event) => (
                  <Pressable
                    key={event.id}
                    style={[
                      styles.selectionItem,
                      addEventId === event.id &&
                        styles.selectedItem,
                    ]}
                    onPress={() => setAddEventId(event.id)}
                  >
                    <Text style={styles.inputText}>
                      {event.title} ({event.event_code})
                    </Text>

                    {addEventId === event.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>
                Select Student
              </Text>

              <TextInput
                value={studentSearch}
                onChangeText={setStudentSearch}
                placeholder="Search student"
                placeholderTextColor={COLORS.muted}
                style={styles.textInput}
              />

              <ScrollView
                style={styles.selectionList}
                nestedScrollEnabled
              >
                {filteredStudents.map((student) => (
                  <Pressable
                    key={student.id}
                    style={[
                      styles.selectionItem,
                      addStudentId === student.id &&
                        styles.selectedItem,
                    ]}
                    onPress={() => setAddStudentId(student.id)}
                  >
                    <Text style={styles.inputText}>
                      {student.full_name ||
                        student.email ||
                        student.id}
                    </Text>

                    {addStudentId === student.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>
                Attendance Date & Time
              </Text>

              <Pressable
                style={styles.inputBox}
                onPress={() => openPicker('add')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={COLORS.primary}
                />

                <Text style={styles.inputText}>
                  {formatDate(addDate.toISOString())}
                </Text>
              </Pressable>

              <Text style={styles.fieldLabel}>
                Reason
              </Text>

              <TextInput
                value={addReason}
                onChangeText={setAddReason}
                placeholder="Reason for manual attendance"
                placeholderTextColor={COLORS.muted}
                style={styles.textInput}
                multiline
                maxLength={500}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  disabled={addSaving}
                  onPress={() => setAddVisible(false)}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  disabled={addSaving}
                  onPress={saveManualAttendance}
                >
                  {addSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Add Attendance
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={!!deleteRecordData}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!deleteSaving) setDeleteRecordData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.deleteIconContainer}>
                <Ionicons
                  name="warning-outline"
                  size={32}
                  color="#EF4444"
                />
              </View>

              <Text style={styles.modalTitle}>
                Remove Attendance?
              </Text>

              <Text style={styles.muted}>
                You are about to remove the attendance
                record of {deleteRecordData?.studentName}
                {' '}for {deleteRecordData?.eventTitle}.
              </Text>

              <Text style={styles.warningText}>
                This action will be recorded in the
                audit log.
              </Text>

              <Text style={styles.fieldLabel}>
                Reason for Removal
              </Text>

              <TextInput
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder="Explain why this record should be removed"
                placeholderTextColor={COLORS.muted}
                style={styles.textInput}
                multiline
                maxLength={500}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  disabled={deleteSaving}
                  onPress={() => setDeleteRecordData(null)}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.confirmDeleteButton}
                  disabled={deleteSaving}
                  onPress={confirmDelete}
                >
                  {deleteSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Remove
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {picker && (
        <DateTimePicker
          value={picker === 'edit' ? editDate : addDate}
          mode={
            Platform.OS === 'android'
              ? pickerMode
              : 'datetime'
          }
          display="default"
          onChange={handlePickerChange}
        />
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    marginBottom: 20,
  },
  summaryNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  filterButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  filterText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  filterList: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 14,
    maxHeight: 230,
  },
  filterItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF10',
  },
  recordCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 17,
    marginBottom: 13,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#8B5CF622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  recordMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#8B5CF622',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  editText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#EF444418',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  deleteText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
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
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000BB',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 17,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    minHeight: 50,
  },
  inputBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  selectionList: {
    maxHeight: 145,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  selectionItem: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF10',
  },
  selectedItem: {
    backgroundColor: '#8B5CF622',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 25,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  deleteIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF444418',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  warningText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '700',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
