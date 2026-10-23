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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

type UserRole = 'student' | 'teacher' | 'admin';
type EditableRole = 'student' | 'teacher';
type RoleFilter = 'all' | UserRole;

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
};

const FILTERS: RoleFilter[] = [
  'all',
  'student',
  'teacher',
  'admin',
];

export default function ManageUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();

  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] =
    useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] =
    useState<EditableRole>('student');
  const [saving, setSaving] = useState(false);

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

  const loadUsers = useCallback(
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
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name', { ascending: true });

        if (queryError) throw queryError;

        setUsers((data ?? []) as UserProfile[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load users.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authorized]
  );

  useEffect(() => {
    if (authorized) loadUsers();
  }, [authorized, loadUsers]);

  const filteredUsers = users.filter((user) => {
    const keyword = search.trim().toLowerCase();

    const matchesSearch =
      (user.full_name ?? '').toLowerCase().includes(keyword) ||
      user.email.toLowerCase().includes(keyword);

    const matchesRole =
      filter === 'all' || user.role === filter;

    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return '#A78BFA';
      case 'teacher':
        return '#38BDF8';
      default:
        return '#34D399';
    }
  };

  const openEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditName(user.full_name ?? '');

    if (user.role !== 'admin') {
      setEditRole(user.role);
    }
  };

  const closeEdit = () => {
    if (saving) return;
    setSelectedUser(null);
  };

  const saveUser = async () => {
    if (!selectedUser || saving) return;

    const trimmedName = editName.trim();

    if (!trimmedName) {
      Alert.alert(
        'Validation Error',
        'Please enter the user full name.'
      );
      return;
    }

    const isAdmin = selectedUser.role === 'admin';

    const roleChanged =
      !isAdmin && editRole !== selectedUser.role;

    const nameChanged =
      trimmedName !== (selectedUser.full_name ?? '');

    if (!roleChanged && !nameChanged) {
      setSelectedUser(null);
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.rpc(
        'admin_manage_user',
        {
          p_user_id: selectedUser.id,
          p_full_name: trimmedName,
          p_role: roleChanged ? editRole : null,
          p_status: null,
        }
      );

      if (updateError) throw updateError;

      setSelectedUser(null);
      await loadUsers();

      Alert.alert(
        'Success',
        'User information updated successfully.'
      );
    } catch (err: any) {
      Alert.alert(
        'Update Failed',
        err?.message || 'Unable to update user.'
      );
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.errorTitle}>
          Access Denied
        </Text>
        <Text style={styles.helperText}>
          This page is only available to administrators.
        </Text>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/admin')}
        >
          <Text style={styles.backButtonText}>
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
          title: 'Manage Users',
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
            onRefresh={() => loadUsers(true)}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.summaryCard}>
          <Ionicons
            name="people"
            size={28}
            color={COLORS.accent}
          />
          <View>
            <Text style={styles.summaryNumber}>
              {users.length}
            </Text>
            <Text style={styles.summaryLabel}>
              Registered Users
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
            placeholder="Search name or email"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
        >
          {FILTERS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.filterChip,
                filter === item && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item && styles.filterTextActive,
                ]}
              >
                {item.charAt(0).toUpperCase() +
                  item.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>
          Users ({filteredUsers.length})
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.accent}
            style={{ marginTop: 40 }}
          />
        ) : error ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color="#EF4444"
            />
            <Text style={styles.errorText}>
              {error}
            </Text>
            <Pressable onPress={() => loadUsers()}>
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="people-outline"
              size={32}
              color={COLORS.muted}
            />
            <Text style={styles.helperText}>
              No users found.
            </Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <View
              key={user.id}
              style={styles.userCard}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.full_name || user.email)
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {user.full_name || 'Unnamed User'}
                </Text>

                <Text style={styles.userEmail}>
                  {user.email}
                </Text>

                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor:
                        getRoleColor(user.role) + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color: getRoleColor(user.role),
                      },
                    ]}
                  >
                    {user.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => openEdit(user)}
                style={styles.editButton}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={COLORS.accent}
                />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={selectedUser !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios' ? 'padding' : undefined
          }
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit User
              </Text>

              <Pressable
                onPress={closeEdit}
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
              Email Address
            </Text>
            <Text style={styles.readOnlyField}>
              {selectedUser?.email}
            </Text>

            <Text style={styles.fieldLabel}>
              Full Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter full name"
              placeholderTextColor={COLORS.muted}
              style={styles.modalInput}
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>
              Account Role
            </Text>

            {selectedUser?.role === 'admin' ? (
              <View style={styles.adminNotice}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={COLORS.accent}
                />
                <Text style={styles.adminNoticeText}>
                  Administrator role is protected.
                </Text>
              </View>
            ) : (
              <View style={styles.roleOptions}>
                {(['student', 'teacher'] as const).map(
                  (role) => (
                    <Pressable
                      key={role}
                      disabled={saving}
                      onPress={() => setEditRole(role)}
                      style={[
                        styles.roleOption,
                        editRole === role &&
                          styles.roleOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          editRole === role &&
                            styles.roleOptionTextActive,
                        ]}
                      >
                        {role === 'student'
                          ? 'Student'
                          : 'Teacher'}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEdit}
                disabled={saving}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={saveUser}
                disabled={saving}
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    marginBottom: 22,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  filters: {
    marginBottom: 22,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#8B5CF622',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.accent,
    fontSize: 19,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 9,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  editButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#8B5CF619',
  },
  messageCard: {
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  helperText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 15,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
  retryText: {
    color: COLORS.accent,
    fontWeight: '700',
    marginTop: 10,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 22,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  readOnlyField: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#8B5CF622',
  },
  roleOptionText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  roleOptionTextActive: {
    color: COLORS.accent,
  },
  adminNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#8B5CF619',
    borderRadius: 12,
  },
  adminNoticeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});