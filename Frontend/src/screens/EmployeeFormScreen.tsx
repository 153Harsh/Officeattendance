import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createEmployee, updateEmployee, Employee } from '../services/adminService';
import { AlertBanner, OfflineState } from '../components/StateViews';

type Props = {
  isOnline: boolean;
  onBack: () => void;
  onSuccess: () => void;
  editEmployee?: Employee | null;
};

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales'];
const C = {
  bg: '#E9DFC9',
  card: '#fff7e8',
  field: '#F4EEE4',
  fieldBorder: '#E9DFD0',
  text: '#34271B',
  muted: '#7D7061',
  brown: '#55351D',
  brownDark: '#3D2515',
  white: '#FFFFFF',
  error: '#B42318',
  success: '#207647',
};

export default function EmployeeFormScreen({
  isOnline,
  onBack,
  onSuccess,
  editEmployee,
}: Props) {
  const isEditMode = !!editEmployee;
  const [formData, setFormData] = useState({
    employeeId: editEmployee?.employeeId ?? '',
    name: editEmployee?.name ?? '',
    password: '',
    email: editEmployee?.email ?? '',
    department: editEmployee?.department ?? '',
    gender: editEmployee?.gender ?? 'male',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const update = (key: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const getAvatarSource = () => {
    return formData.gender === 'male' 
      ? require('../assets/boy.png') 
      : require('../assets/girl.png');
  };

  const validateForm = (): boolean => {
    if (!formData.employeeId.trim()) { setError('Employee ID is required.'); return false; }
    if (!formData.name.trim()) { setError('Name is required.'); return false; }
    if (!isEditMode && !formData.password.trim()) { setError('Password is required.'); return false; }
    if (!formData.department.trim()) { setError('Please select a department.'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!isOnline) { setError('Internet connection required to save employee.'); return; }
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isEditMode && editEmployee) {
        const updates: Record<string, string> = {};
        if (formData.name) updates.name = formData.name;
        if (formData.email !== undefined) updates.email = formData.email;
        if (formData.department) updates.department = formData.department;
        if (formData.password) updates.password = formData.password;
        await updateEmployee(editEmployee.employeeId, updates);
        setSuccess('Employee updated successfully.');
      } else {
        await createEmployee({
          employeeId: formData.employeeId.trim(),
          name: formData.name.trim(),
          password: formData.password.trim(),
          email: formData.email.trim(),
          department: formData.department,
        });
        setSuccess('Employee created successfully.');
      }
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={isEditMode ? 'Edit Employee' : 'Add Employee'} onBack={onBack} />
        <OfflineState onBack={onBack} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={isEditMode ? 'Edit Employee' : 'Add Employee'} onBack={onBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? <AlertBanner type="error" message={error} /> : null}
          {success ? <AlertBanner type="success" message={success} /> : null}

          <View style={styles.formCard}>
            <View style={styles.photoArea}>
              <View style={styles.photoCircle}>
                <Image source={getAvatarSource()} style={styles.avatarImage} resizeMode="cover" />
              </View>
              <Text style={styles.photoLabel}>Select Avatar</Text>
              <View style={styles.genderSelector}>
                <TouchableOpacity 
                  style={[styles.genderButton, formData.gender === 'male' && styles.selectedGender]} 
                  onPress={() => update('gender', 'male')}
                  accessibilityLabel="Select male avatar"
                >
                  <Text style={styles.genderButtonText}>Boy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderButton, formData.gender === 'female' && styles.selectedGender]} 
                  onPress={() => update('gender', 'female')}
                  accessibilityLabel="Select female avatar"
                >
                  <Text style={styles.genderButtonText}>Girl</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Field icon="♙" label={`Employee ID${!isEditMode ? ' *' : ''}`}>
              <TextInput
                style={[styles.input, isEditMode && styles.disabledInput]}
                value={formData.employeeId}
                onChangeText={text => update('employeeId', text)}
                placeholder="e.g. EMP001"
                placeholderTextColor={C.muted}
                editable={!isEditMode}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
                blurOnSubmit={false}
                accessibilityLabel="Employee ID"
              />
            </Field>

            <Field icon="♙" label="Full Name *">
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={formData.name}
                onChangeText={text => update('name', text)}
                placeholder="Enter full name"
                placeholderTextColor={C.muted}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                accessibilityLabel="Full name"
              />
            </Field>

            <Field icon="▣" label={isEditMode ? 'Password (optional)' : 'Password *'} trailing={
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.trailingButton}>
                <Text style={styles.trailingText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            }>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={formData.password}
                onChangeText={text => update('password', text)}
                placeholder={isEditMode ? 'Leave blank to keep current' : 'Enter password'}
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                accessibilityLabel="Password"
              />
            </Field>

            <Field icon="✉" label="Email">
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={formData.email}
                onChangeText={text => update('email', text)}
                placeholder="employee@company.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Email address"
              />
            </Field>

            <View style={styles.field}>
              <Text style={styles.label}>Department *</Text>
              <View style={styles.deptGrid}>
                {DEPARTMENTS.map(dept => {
                  const selected = formData.department === dept;
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.deptChip, selected && styles.deptChipSelected]}
                      onPress={() => update('department', dept)}
                      accessibilityLabel={`Select ${dept} department`}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.deptChipText, selected && styles.deptChipTextSelected]}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                New employees are created with the Employee role and active status.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? 'Update employee' : 'Create employee'}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditMode ? 'Update Employee' : 'Save Employee'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function Field({
  icon,
  label,
  children,
  trailing,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldIcon}>
        <Text style={styles.fieldIconText}>{icon}</Text>
      </View>
      <View style={styles.fieldContent}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {trailing}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: C.bg,
  },
  backButton: {
    width: 34,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 34,
    lineHeight: 36,
    color: C.brown,
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#17130F',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 34,
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE5D8',
  },
  photoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
    paddingBottom: 10,
  },
  photoCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#E9DFD1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  photoLabel: {
    color: C.text,
    fontSize: 12,
    fontWeight: '500',
  },
  genderSelector: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 16 
  },
  genderButton: { 
    paddingVertical: 9, 
    paddingHorizontal: 16, 
    backgroundColor: C.field, 
    borderRadius: 9, 
    borderWidth: 1, 
    borderColor: C.fieldBorder 
  },
  selectedGender: { 
    backgroundColor: C.brown, 
    borderColor: C.brown 
  },
  genderButtonText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: C.text 
  },
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.field,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: '#F0E8DC',
  },
  fieldIcon: {
    width: 25,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 4,
  },
  fieldIconText: {
    color: '#5A4A39',
    fontSize: 18,
  },
  fieldContent: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    minHeight: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 1,
  },
  input: {
    minHeight: 22,
    paddingVertical: 1,
    paddingHorizontal: 0,
    color: C.text,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  disabledInput: {
    color: C.muted,
  },
  trailingButton: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  trailingText: {
    color: C.brown,
    fontSize: 10,
    fontWeight: '700',
  },
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 4,
  },
  deptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    backgroundColor: C.field,
  },
  deptChipSelected: {
    backgroundColor: C.brown,
    borderColor: C.brown,
  },
  deptChipText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '600',
  },
  deptChipTextSelected: {
    color: C.white,
  },
  infoBox: {
    backgroundColor: '#F8F0E4',
    borderRadius: 10,
    padding: 9,
    borderLeftWidth: 3,
    borderLeftColor: '#C8A982',
    marginTop: 2,
  },
  infoText: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
  },
  submitBtn: {
    minHeight: 48,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: C.brown,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: C.brownDark,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },
});