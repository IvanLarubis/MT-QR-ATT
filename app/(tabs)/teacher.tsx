import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import { createEvent } from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';

export default function TeacherScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  
  // Picker State
  const [editTarget, setEditTarget] = useState<'start' | 'end' | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  
  // Action State
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) {
        setRoleLoading(false);
        return () => { active = false; };
      }
      setRoleLoading(true);
      getProfile(user.id).then((profile) => {
        if (!active) return;
        setRole(profile?.role ?? 'student');
        setRoleLoading(false);
      });
      return () => { active = false; };
    }, [user])
  );

  // --- Date Picker Logic (Bug Fixed) ---
  const openPicker = (target: 'start' | 'end') => {
    setEditTarget(target);
    // On Android, we must start with 'date', then trigger 'time'
    setEditingPart(Platform.OS === 'android' ? 'date' : 'date'); 
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    if (selected) {
      if (editTarget === 'start') setStartDate(selected);
      if (editTarget === 'end') setEndDate(selected);
    }

    // Android flow: Date -> Time -> Close
    if (Platform.OS === 'android') {
      if (editingPart === 'date') {
        setEditingPart('time');
      } else {
        setEditTarget(null);
        setEditingPart('date');
      }
    } 
    // iOS flow: Keeps the spinner open, just updates the value
  };

  const applyQuickDuration = (minutes: number) => {
    setEndDate(new Date(startDate.getTime() + minutes * 60 * 1000));
  };

  const handleCreateEvent = async () => {
    setMessage(null);
    if (!title.trim() || !eventId.trim()) {
      setMessage({ text: 'Event title and code are required.', type: 'error' });
      return;
    }
    if (startDate >= endDate) {
      setMessage({ text: 'Start time must be before end time.', type: 'error' });
      return;
    }

    setSubmitting(true);
    const eventData = {
      eventId: eventId.trim().toUpperCase(),
      title: title.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };

    const { error } = await createEvent(eventData);
    setSubmitting(false);

    if (error) {
      setMessage({ text: 'Could not save the event. Please try again.', type: 'error' });
      return;
    }
    
    setMessage({ 
      text: 'Event saved successfully! Ask a student to scan this QR code.', 
      type: 'success' 
    });
    setPayload(buildQRPayload(eventData));
  };

  // --- Render States ---

  if (roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.centered}>
        <View style={styles.lockIconContainer}>
          <Ionicons name="lock-closed" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.lockTitle}>Teachers Only</Text>
        <Text style={styles.muted}>
          Only teacher accounts have permission to create events.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: COLORS.background }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.delay(100)}>
          <Text style={styles.heading}>Create Event</Text>
          <Text style={styles.subHeading}>Generate a QR code for students to scan.</Text>
        </Animated.View>

        {/* --- Title Input --- */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.inputGroup}>
          <Text style={styles.label}>Event Title</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="text-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Founders Day Assembly"
              placeholderTextColor={COLORS.muted}
              editable={!submitting}
            />
          </View>
        </Animated.View>

        {/* --- Event Code Input --- */}
        <Animated.View entering={FadeInUp.delay(250)} style={styles.inputGroup}>
          <Text style={styles.label}>Event Code</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="barcode-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={eventId}
              onChangeText={setEventId}
              placeholder="EVT-2026-0001"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              editable={!submitting}
            />
          </View>
        </Animated.View>

        {/* --- Date/Time Inputs --- */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start Time</Text>
            <Pressable style={styles.dateBox} onPress={() => openPicker('start')}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <Text style={styles.dateText} numberOfLines={1}>
                {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                {' at '}
                {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>End Time</Text>
            <Pressable style={styles.dateBox} onPress={() => openPicker('end')}>
              <Ionicons name="time-outline" size={20} color={COLORS.accent} />
              <Text style={styles.dateText} numberOfLines={1}>
                {endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                {' at '}
                {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Date Picker Modal */}
        {editTarget && (
          <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
            <DateTimePicker
              value={editTarget === 'start' ? startDate : endDate}
              mode={Platform.OS === 'android' ? editingPart : 'datetime'}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onPickerChange}
              themeVariant="dark" // Forces dark mode on iOS picker (remove if not using dark theme)
            />
          </View>
        )}

        {/* --- Quick Duration Chips --- */}
        <Animated.View entering={FadeInUp.delay(350)} style={styles.chipRow}>
          <Text style={styles.quickLabel}>Quick set end time:</Text>
          <View style={styles.chipContainer}>
            {[30, 60, 120].map((mins) => (
              <Pressable key={mins} style={styles.chip} onPress={() => applyQuickDuration(mins)}>
                <Text style={styles.chipText}>+{mins >= 60 ? `${mins / 60}h` : `${mins}m`}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* --- Submit Button --- */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.submitWrapper}>
          <Pressable 
            style={[styles.primaryButton, submitting && { opacity: 0.7 }]} 
            onPress={handleCreateEvent}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="qr-code" size={20} color={COLORS.textOnPrimary} />
                <Text style={styles.primaryButtonText}>Create & Generate QR</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* --- Messages --- */}
        {message && (
          <Animated.View entering={FadeInUp} style={[
            styles.messageBox, 
            message.type === 'error' ? styles.messageError : styles.messageSuccess
          ]}>
            <Ionicons 
              name={message.type === 'error' ? 'alert-circle' : 'checkmark-circle'} 
              size={20} 
              color={message.type === 'error' ? '#ef4444' : '#22c55e'} 
            />
            <Text style={[
              styles.messageText, 
              { color: message.type === 'error' ? '#ef4444' : '#22c55e' }
            ]}>
              {message.text}
            </Text>
          </Animated.View>
        )}

        {/* --- QR Code Result --- */}
        {payload && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              <Text style={styles.qrHeaderText}>Event Ready!</Text>
            </View>
            
            <View style={styles.qrWrapper}>
              <QRCode value={payload} size={220} />
            </View>
            
            <Text style={styles.payloadText}>Payload: {payload.slice(0, 30)}...</Text>
          </Animated.View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subHeading: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  muted: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // --- Form Inputs ---
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

  // --- Date Pickers ---
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    height: 54,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  iosPickerContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    padding: 8,
  },

  // --- Quick Chips ---
  chipRow: {
    marginBottom: 24,
  },
  quickLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginLeft: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // --- Primary Button ---
  submitWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },

  // --- Messages ---
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  messageError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  messageSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },

  // --- QR Card ---
  qrCard: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  qrHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});