import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
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
import { createEvent, type CloudEvent } from '@/lib/events';

type EventForm = {
  title: string;
  eventCode: string;
  start: Date;
  end: Date;
};

const createEmptyForm = (): EventForm => ({
  title: '',
  eventCode: '',
  start: new Date(),
  end: new Date(Date.now() + 60 * 60 * 1000),
});

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();

  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<CloudEvent | null>(null);
  const [form, setForm] = useState<EventForm>(
    createEmptyForm()
  );
  const [saving, setSaving] = useState(false);

  const [pickerTarget, setPickerTarget] =
    useState<'start' | 'end' | null>(null);
  const [pickerMode, setPickerMode] =
    useState<'date' | 'time'>('date');

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (authLoading) return;

      setCheckingAccess(true);

      if (!session?.user?.id) {
        if (active) {
          setAuthorized(false);
          setCheckingAccess(false);
        }
        return;
      }

      try {
        const profile = await getProfile(session.user.id);

        if (active) {
          setAuthorized(profile?.role === 'admin');
        }
      } catch {
        if (active) setAuthorized(false);
      } finally {
        if (active) setCheckingAccess(false);
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, [session?.user?.id, authLoading]);

  const loadEvents = useCallback(
    async (isRefresh = false) => {
      if (!authorized) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('events')
          .select(
            'id, event_code, title, start_time, end_time, created_by, created_at'
          )
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;

        setEvents((data ?? []) as CloudEvent[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load events.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authorized]
  );

  useEffect(() => {
    if (authorized) loadEvents();
  }, [authorized, loadEvents]);

  const filteredEvents = events.filter((event) => {
    const keyword = search.trim().toLowerCase();

    return (
      event.title.toLowerCase().includes(keyword) ||
      event.event_code.toLowerCase().includes(keyword)
    );
  });

  const openCreate = () => {
    setEditingEvent(null);
    setForm(createEmptyForm());
    setModalVisible(true);
  };

  const openEdit = (event: CloudEvent) => {
    setEditingEvent(event);

    setForm({
      title: event.title,
      eventCode: event.event_code,
      start: event.start_time
        ? new Date(event.start_time)
        : new Date(),
      end: event.end_time
        ? new Date(event.end_time)
        : new Date(Date.now() + 60 * 60 * 1000),
    });

    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setPickerTarget(null);
    setModalVisible(false);
  };

  const openPicker = (target: 'start' | 'end') => {
    setPickerTarget(target);
    setPickerMode('date');
  };

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (event.type === 'dismissed') {
      setPickerTarget(null);
      setPickerMode('date');
      return;
    }

    if (selected && pickerTarget) {
      setForm((current) => ({
        ...current,
        [pickerTarget]: selected,
      }));
    }

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setPickerMode('time');
      } else {
        setPickerTarget(null);
        setPickerMode('date');
      }
    }
  };

  const saveEvent = async () => {
    if (saving) return;

    const title = form.title.trim();
    const code = form.eventCode.trim().toUpperCase();

    if (!title || !code) {
      Alert.alert(
        'Missing Information',
        'Event title and event code are required.'
      );
      return;
    }

    if (form.start >= form.end) {
      Alert.alert(
        'Invalid Schedule',
        'Start time must be earlier than end time.'
      );
      return;
    }

    setSaving(true);

    try {
      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            title,
            event_code: code,
            start_time: form.start.toISOString(),
            end_time: form.end.toISOString(),
          })
          .eq('id', editingEvent.id);

        if (updateError) throw updateError;
      } else {
        const { error: createError } = await createEvent({
          eventId: code,
          title,
          start: form.start.toISOString(),
          end: form.end.toISOString(),
        });

        if (createError) {
          throw new Error(createError);
        }
      }

      setModalVisible(false);
      await loadEvents();

      Alert.alert(
        'Success',
        editingEvent
          ? 'Event updated successfully.'
          : 'Event created successfully.'
      );
    } catch (err: any) {
      Alert.alert(
        'Save Failed',
        err?.message || 'Unable to save event.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = (event: CloudEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { count, error: countError } =
                await supabase
                  .from('attendance')
                  .select('id', {
                    count: 'exact',
                    head: true,
                  })
                  .eq('event_id', event.id);

              if (countError) throw countError;

              if ((count ?? 0) > 0) {
                Alert.alert(
                  'Cannot Delete',
                  'This event already has attendance records.'
                );
                return;
              }

              const { error: deleteError } =
                await supabase
                  .from('events')
                  .delete()
                  .eq('id', event.id);

              if (deleteError) throw deleteError;

              await loadEvents();

              Alert.alert(
                'Deleted',
                'Event deleted successfully.'
              );
            } catch (err: any) {
              Alert.alert(
                'Delete Failed',
                err?.message || 'Unable to delete event.'
              );
            }
          },
        },
      ]
    );
  };

  const formatDate = (value: string | null) => {
    if (!value) return 'Not scheduled';

    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || checkingAccess) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.accent}
        />
        <Text style={styles.helperText}>
          Checking access...
        </Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={COLORS.muted}
        />
        <Text style={styles.title}>
          Access Denied
        </Text>
        <Text style={styles.helperText}>
          Administrators only.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace('/(tabs)/admin')
          }
        >
          <Text style={styles.buttonText}>
            Go Back
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
          title: 'Manage Events',
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: COLORS.textPrimary,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEvents(true)}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              School Events
            </Text>
            <Text style={styles.helperText}>
              Manage attendance events
            </Text>
          </View>

          <Pressable
            onPress={openCreate}
            style={styles.addButton}
          >
            <Ionicons
              name="add"
              size={23}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons
            name="calendar-outline"
            size={27}
            color={COLORS.accent}
          />
          <View>
            <Text style={styles.summaryNumber}>
              {events.length}
            </Text>
            <Text style={styles.summaryLabel}>
              Total Events
            </Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.muted}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search event title or code"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.accent}
            style={{ marginTop: 30 }}
          />
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>
            <Pressable onPress={() => loadEvents()}>
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="calendar-outline"
              size={32}
              color={COLORS.muted}
            />
            <Text style={styles.helperText}>
              No events found.
            </Text>
          </View>
        ) : (
          filteredEvents.map((event) => (
            <View
              key={event.id}
              style={styles.eventCard}
            >
              <View style={styles.eventTop}>
                <View style={styles.eventIcon}>
                  <Ionicons
                    name="calendar"
                    size={23}
                    color={COLORS.accent}
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
              </View>

              <View style={styles.dateInfo}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={COLORS.muted}
                />
                <Text style={styles.dateText}>
                  {formatDate(event.start_time)}
                </Text>
              </View>

              <View style={styles.dateInfo}>
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color={COLORS.muted}
                />
                <Text style={styles.dateText}>
                  {formatDate(event.end_time)}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => openEdit(event)}
                  style={styles.editButton}
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={COLORS.accent}
                  />
                  <Text style={styles.editText}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => deleteEvent(event)}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color="#EF4444"
                  />
                  <Text style={styles.deleteText}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingEvent
                    ? 'Edit Event'
                    : 'Create Event'}
                </Text>

                <Pressable
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.textPrimary}
                  />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>
                Event Title
              </Text>
              <TextInput
                value={form.title}
                onChangeText={(value) =>
                  setForm((current) => ({
                    ...current,
                    title: value,
                  }))
                }
                placeholder="School Assembly"
                placeholderTextColor={COLORS.muted}
                style={styles.modalInput}
                editable={!saving}
              />

              <Text style={styles.fieldLabel}>
                Event Code
              </Text>
              <TextInput
                value={form.eventCode}
                onChangeText={(value) =>
                  setForm((current) => ({
                    ...current,
                    eventCode: value,
                  }))
                }
                placeholder="EVT-2026-0001"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="characters"
                style={styles.modalInput}
                editable={!saving}
              />

              <Text style={styles.fieldLabel}>
                Start Date & Time
              </Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => openPicker('start')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={COLORS.accent}
                />
                <Text style={styles.dateText}>
                  {form.start.toLocaleString()}
                </Text>
              </Pressable>

              <Text style={styles.fieldLabel}>
                End Date & Time
              </Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => openPicker('end')}
              >
                <Ionicons
                  name="time-outline"
                  size={19}
                  color={COLORS.accent}
                />
                <Text style={styles.dateText}>
                  {form.end.toLocaleString()}
                </Text>
              </Pressable>

              {pickerTarget && (
                <DateTimePicker
                  value={form[pickerTarget]}
                  mode={
                    Platform.OS === 'android'
                      ? pickerMode
                      : 'datetime'
                  }
                  display="default"
                  onChange={handlePickerChange}
                />
              )}

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeModal}
                  disabled={saving}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={saveEvent}
                  disabled={saving}
                  style={styles.primaryButton}
                >
                  {saving ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.buttonText}>
                      Save Event
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
  },
  summaryNumber: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
    gap: 10,
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
    marginBottom: 14,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  eventIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
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
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#8B5CF622',
  },
  editText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EF444418',
  },
  deleteText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  messageCard: {
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
  retryText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    padding: 22,
    borderRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});