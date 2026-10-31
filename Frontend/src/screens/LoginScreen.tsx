import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerAdminNotifications } from '../services/notificationService';
import { loginEmployee } from '../services/authService';
import { setSetting } from '../database/repositories/settingsRepository';
import { AlertBanner } from '../components/StateViews';

type Props = {
  onLoginSuccess: (employee: {
    employeeId: string;
    name: string;
    department: string | null;
    role: 'ADMIN' | 'EMPLOYEE';
  }) => void;
};

// Warm claymorphism palette. Keep these tokens reusable across the app later.
const C = {
  background: '#F8EBDD',
  surface: 'rgba(255, 250, 242, 0.96)',
  surfaceLight: '#FFFCF7',
  surfaceShade: '#E5D5BF',
  text: '#352316',
  textMuted: '#796653',
  primary: '#4A2D18',
  primaryLight: '#6A472C',
  border: '#DCC6A8',
  placeholder: '#9B8872',
  white: '#FFFFFF',
  error: '#B83D35',
};

const screenHeight = Dimensions.get('window').height;

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const canSubmit =
    employeeId.trim().length > 0 && password.length > 0 && !loggingIn;

  const handleLogin = async () => {
    if (!canSubmit) return;

    try {
      setLoggingIn(true);
      setLoginError(null);

      const employee = await loginEmployee(employeeId.trim(), password);

      await setSetting('EMPLOYEE_ID', employee.employeeId);
      await setSetting('EMPLOYEE_NAME', employee.name);
      await setSetting('EMPLOYEE_ROLE', employee.role);

      if (employee.department) {
        await setSetting('EMPLOYEE_DEPARTMENT', employee.department);
      }

      if (employee.role === 'ADMIN') {
        try {
          await registerAdminNotifications(employee.employeeId, password);
        } catch (notificationError) {
          console.warn(
            'Admin notification registration failed:',
            notificationError,
          );
        }
      }

      onLoginSuccess(employee);
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Unable to login. Please try again.',
      );
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Full-screen decorative background; UI content is layered above it. */}
            <Image
  source={require('../assets/bg.png')}
  style={styles.backgroundImage}
  resizeMode="cover"
  accessibilityLabel="Office building and clock background"
/>
            <View style={styles.contentOverlay}>
              <View style={styles.formCard}>
              {loginError ? (
                <View style={styles.errorWrap}>
                  <AlertBanner type="error" message={loginError} />
                </View>
              ) : null}

              <View style={styles.inputShell}>
                <Text style={styles.inputIcon}>♙</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Employee ID"
                  placeholderTextColor={C.placeholder}
                  value={employeeId}
                  onChangeText={text => {
                    setEmployeeId(text);
                    setLoginError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loggingIn}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  accessibilityLabel="Employee ID"
                />
              </View>

              <View style={styles.inputShell}>
                <Text style={styles.inputIcon}>▣</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={C.placeholder}
                  value={password}
                  onChangeText={text => {
                    setPassword(text);
                    setLoginError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loggingIn}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(value => !value)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '◉' : '◎'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(value => !value)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.optionsText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} accessibilityRole="button">
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                ]}
                onPress={handleLogin}
                disabled={!canSubmit}
                activeOpacity={0.86}
                accessibilityRole="button"
              >
                {loggingIn ? (
                  <ActivityIndicator color={C.surfaceLight} size="small" />
                ) : (
                  <View style={styles.submitBtnContent}>
                    <Text style={styles.submitBtnText}>Login</Text>
                    <Text style={styles.submitArrow}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.appName}>Office Attendance</Text>
              <Text style={styles.tagline}>
                Track Attendance, Manage Team{ '\\n' }Stay Organized
              </Text>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
  flexGrow: 1,
  paddingHorizontal: 0,
  paddingTop: 0,
  paddingBottom: 0,
},
  content: {
  flex: 1,
  width: '100%',
  alignSelf: 'center',
  justifyContent: 'flex-start',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: C.background,
},
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  contentOverlay: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 22,
    zIndex: 1,
    top: '36%',
  },
  titleSection: {
    alignItems: 'center',
    marginHorizontal: 22,
    marginTop: '2%',
    marginBottom: 10,
  },
  appName: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.65,
    color: C.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  tagline: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  formCard: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
  },
  errorWrap: {
    marginBottom: 12,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F8F0E3',
    shadowColor: '#C8B69D',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 3,
  },
  inputIcon: {
    width: 23,
    textAlign: 'center',
    fontSize: 18,
    color: C.textMuted,
    marginRight: 7,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingVertical: 0,
    fontSize: 13,
    color: C.text,
  },
  eyeBtn: {
    padding: 7,
    marginRight: -4,
  },
  eyeIcon: {
    fontSize: 18,
    color: C.textMuted,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 18,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C8B59D',
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceLight,
    shadowColor: '#C8B69D',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 1,
  },
  checkboxChecked: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  checkmark: {
    color: C.white,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  optionsText: {
    fontSize: 10,
    color: C.text,
    fontWeight: '600',
  },
  forgotPasswordText: {
    fontSize: 10,
    color: C.text,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 15,
    height: 47,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#68472D',
    shadowColor: '#8B6B4D',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 5,
  },
  submitBtnDisabled: {
    opacity: 0.88,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: C.surfaceLight,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    letterSpacing: 0.2,
  },
  submitArrow: {
    color: C.surfaceLight,
    fontSize: 19,
    fontWeight: '500',
    marginTop: -2,
  },
  footerSection: {
    alignItems: 'center',
    marginHorizontal: 0,
    marginTop: 17,
    paddingBottom: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 13,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E1D0B9',
  },
  dividerText: {
    marginHorizontal: 13,
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
  fingerprintOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FAF2E6',
    shadowColor: '#C3B097',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  fingerprintInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE1CB',
    borderWidth: 1,
    borderColor: '#E7D6BE',
  },
  fingerprintIcon: {
    fontSize: 30,
    lineHeight: 34,
    color: C.primary,
  },
});
