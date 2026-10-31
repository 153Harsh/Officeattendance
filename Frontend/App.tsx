import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Alert,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';

import { initializeDatabase } from './src/database';
import { getSetting, setSetting } from './src/database/repositories/settingsRepository';
import { createEmployee, getEmployeeById } from './src/database/repositories/employeeRepository';
import { getTodayAttendance } from './src/database/repositories/attendanceRepository';
import { getPendingSyncItems, getAllSyncItems } from './src/database/repositories/syncQueueRepository';
import { checkInEmployee, checkOutEmployee } from './src/services/attendanceService';
import { syncPendingEvents } from './src/services/syncService';

import LoginScreen from './src/screens/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import Avatar from './src/components/Avatar';
import { AlertBanner } from './src/components/StateViews';
import { Colors, Typography, Spacing, Radii, Shadows, Sizes } from './src/theme';

type Employee = {
  employeeId: string;
  name: string;
  department: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
} | null;

type AttendanceStatus = {
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
};

type SyncStatus = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
};

type StatusMessage = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

type AdminTab = 'Dashboard' | 'Employees' | 'Attendance' | 'Reports';

function formatTimeIST(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

function getTodayDateIST(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [employee, setEmployee] = useState<Employee>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: null,
    checkOutTime: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
  });
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [splashVideoFinished, setSplashVideoFinished] = useState(false);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<any>(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('Dashboard');
  const [adminNavigationRequest, setAdminNavigationRequest] = useState<{
    tab: AdminTab;
    version: number;
  }>({ tab: 'Dashboard', version: 0 });

  const appState = useRef(AppState.currentState);
  const isSyncingRef = useRef(false);

  const handleLoginSuccess = (emp: {
    employeeId: string;
    name: string;
    department: string | null;
    role: 'ADMIN' | 'EMPLOYEE';
  }) => {
    setEmployee(emp);
    setLoggedIn(true);
    setActiveAdminTab('Dashboard');
    setAdminNavigationRequest(prev => ({ tab: 'Dashboard', version: prev.version + 1 }));
  };

  const checkAttendanceStatus = useCallback(async () => {
    if (!employee) return;
    try {
      const today = await getTodayAttendance(employee.employeeId);
      if (today) {
        setAttendanceStatus({
          checkedIn: !!today.check_in,
          checkedOut: !!today.check_out,
          checkInTime: today.check_in,
          checkOutTime: today.check_out,
        });
      } else {
        setAttendanceStatus({ checkedIn: false, checkedOut: false, checkInTime: null, checkOutTime: null });
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
    }
  }, [employee]);

  const checkLocationServicesEnabled = async (): Promise<boolean> => {
    const openSettings = () => {
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
      } else {
        Linking.openSettings();
      }
    };

    try {
      const Geolocation = (await import('@react-native-community/geolocation')).default;
      const enabled = await (Geolocation as any).isLocationEnabled?.() ?? true;
      if (!enabled) {
        return new Promise(resolve => {
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services to check in/out.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Enable Location', onPress: () => { openSettings(); resolve(false); } },
            ],
          );
        });
      }
    } catch {
      // If the check fails, proceed and let the geolocation call itself fail
    }
    return true;
  };

  const handleLogout = async () => {
    await setSetting('EMPLOYEE_ID', '');
    await setSetting('EMPLOYEE_NAME', '');
    await setSetting('EMPLOYEE_DEPARTMENT', '');
    await setSetting('EMPLOYEE_ROLE', '');
    setEmployee(null);
    setLoggedIn(false);
    setActiveAdminTab('Dashboard');
    setAdminNavigationRequest(prev => ({ tab: 'Dashboard', version: prev.version + 1 }));
    setAttendanceStatus({ checkedIn: false, checkedOut: false, checkInTime: null, checkOutTime: null });
  };

  const updateSyncStatus = useCallback(async (isConnected: boolean) => {
    setSyncStatus(prev => ({ ...prev, isOnline: isConnected }));
    try {
      const pending = await getPendingSyncItems();
      setSyncStatus(prev => ({ ...prev, pendingCount: pending.length, isSyncing: isSyncingRef.current }));
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase();
        const savedId = await getSetting('EMPLOYEE_ID');
        const savedName = await getSetting('EMPLOYEE_NAME');
        const savedDept = await getSetting('EMPLOYEE_DEPARTMENT');
        const savedRole = await getSetting('EMPLOYEE_ROLE');

        if (savedId && savedName && savedRole) {
          setEmployee({ employeeId: savedId, name: savedName, department: savedDept, role: savedRole as 'ADMIN' | 'EMPLOYEE' });
          setLoggedIn(true);
          const existing = await getEmployeeById(savedId);
          if (!existing) {
            await createEmployee(savedId, savedName, 'employee@company.com', savedDept || 'Unknown');
          }
          const today = await getTodayAttendance(savedId);
          if (today) {
            setAttendanceStatus({
              checkedIn: !!today.check_in,
              checkedOut: !!today.check_out,
              checkInTime: today.check_in,
              checkOutTime: today.check_out,
            });
          }
        } else {
          setLoggedIn(false);
        }

        const networkState = await NetInfo.fetch();
        updateSyncStatus(!!networkState.isConnected);
        setIsInitialized(true);
        isSyncingRef.current = true;
        syncPendingEvents().finally(() => {
          isSyncingRef.current = false;
          updateSyncStatus(!!networkState.isConnected);
        });
      } catch (error) {
        console.error('App initialization error:', error);
        setStatusMessage({ type: 'error', message: error instanceof Error ? error.message : 'Failed to initialize app.' });
        setIsInitialized(true);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const unsubNet = NetInfo.addEventListener(async (state: NetInfoState) => {
      const isConnected = !!state.isConnected;
      updateSyncStatus(isConnected);
      if (isConnected && !isSyncingRef.current) {
        isSyncingRef.current = true;
        await syncPendingEvents();
        isSyncingRef.current = false;
        updateSyncStatus(true);
      }
    });
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (appState.current?.match(/inactive|background/) && nextState === 'active' && !isSyncingRef.current) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          isSyncingRef.current = true;
          await syncPendingEvents();
          isSyncingRef.current = false;
          updateSyncStatus(!!net.isConnected);
        }
      }
      appState.current = nextState;
    };
    const unsubApp = AppState.addEventListener('change', handleAppStateChange);
    return () => { unsubNet(); unsubApp.remove(); };
  }, [isInitialized, updateSyncStatus]);

  useEffect(() => {
    if (isInitialized && loggedIn && employee) {
      checkAttendanceStatus();
    }
  }, [isInitialized, loggedIn, employee, checkAttendanceStatus]);

  const canCheckIn = () => !attendanceStatus.checkedIn && !attendanceStatus.checkedOut && !isProcessing;
  const canCheckOut = () => attendanceStatus.checkedIn && !attendanceStatus.checkedOut && !isProcessing;
  const isActionDisabled = () => !isInitialized || isProcessing;

  const handleCheckIn = async () => {
    if (!employee || !canCheckIn()) return;
    try {
      const locationEnabled = await checkLocationServicesEnabled();
      if (!locationEnabled) {
        setStatusMessage({ type: 'error', message: 'Location services are required to check in.' });
        return;
      }
      setIsProcessing(true);
      setProcessingMessage('Getting your location...');
      setStatusMessage(null);
      const result = await checkInEmployee(employee.employeeId);
      const syncItems = await getAllSyncItems();
      console.log('SYNC QUEUE AFTER CHECK-IN:', syncItems);
      setAttendanceStatus({ checkedIn: true, checkedOut: false, checkInTime: new Date().toISOString(), checkOutTime: null });
      setStatusMessage({ type: 'success', message: `Checked in successfully · ${result.distanceMeters.toFixed(0)}m from office` });
      if (syncStatus.isOnline && !isSyncingRef.current) {
        isSyncingRef.current = true;
        syncPendingEvents().finally(() => { isSyncingRef.current = false; updateSyncStatus(syncStatus.isOnline); });
      }
    } catch (error) {
      console.error('Check-In error:', error);
      setStatusMessage({ type: 'error', message: error instanceof Error ? error.message : 'Check-in failed.' });
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleCheckOut = async () => {
    if (!employee || !canCheckOut()) return;
    try {
      const locationEnabled = await checkLocationServicesEnabled();
      if (!locationEnabled) {
        setStatusMessage({ type: 'error', message: 'Location services are required to check out.' });
        return;
      }
      setIsProcessing(true);
      setProcessingMessage('Verifying location...');
      setStatusMessage(null);
      const result = await checkOutEmployee(employee.employeeId);
      const syncItems = await getAllSyncItems();
      console.log('SYNC QUEUE AFTER CHECK-OUT:', syncItems);
      setAttendanceStatus({ checkedIn: true, checkedOut: true, checkInTime: attendanceStatus.checkInTime, checkOutTime: new Date().toISOString() });
      setStatusMessage({ type: 'success', message: `Checked out successfully · ${result.distanceMeters.toFixed(0)}m from office` });
      if (syncStatus.isOnline && !isSyncingRef.current) {
        isSyncingRef.current = true;
        syncPendingEvents().finally(() => { isSyncingRef.current = false; updateSyncStatus(syncStatus.isOnline); });
      }
    } catch (error) {
      console.error('Check-Out error:', error);
      setStatusMessage({ type: 'error', message: error instanceof Error ? error.message : 'Check-out failed.' });
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const getButtonConfig = () => {
    if (attendanceStatus.checkedOut) return { title: 'Attendance Complete', onPress: null, disabled: true, variant: 'done' as const };
    if (attendanceStatus.checkedIn) return { title: 'Check Out', onPress: handleCheckOut, disabled: !canCheckOut(), variant: 'checkout' as const };
    return { title: 'Check In', onPress: handleCheckIn, disabled: !canCheckIn(), variant: 'checkin' as const };
  };

  const getSyncLabel = () => {
    if (!syncStatus.isOnline) return { text: 'Offline · Saved locally', color: Colors.warning, bg: Colors.warningBg };
    if (isSyncingRef.current) return { text: 'Syncing...', color: Colors.info, bg: Colors.infoBg };
    if (syncStatus.pendingCount > 0) return { text: `${syncStatus.pendingCount} pending sync`, color: Colors.warning, bg: Colors.warningBg };
    return { text: 'Online · Synced', color: Colors.success, bg: Colors.successBg };
  };

  // ── Animated launch splash ─────────────────────────────────────────────────
  // Database initialization continues while the splash video plays.
  useEffect(() => {
    if (!splashVideoFinished) {
      // Start fade in animation when video starts playing
      Animated.timing(splashOpacity, {
        toValue: 1,
        duration: 500, // 500ms fade in
        useNativeDriver: true,
      }).start();
    }
  }, [splashVideoFinished]);

  const handleVideoProgress = (data: any) => {
    if (data.currentTime > 0 && data.seekableDuration > 0) {
      const progress = (data.currentTime / data.seekableDuration) * 100;
      setVideoProgress(progress);
    }
  };

  if (!splashVideoFinished) {
    return (
      <Animated.View style={[styles.splashVideoContainer, { opacity: splashOpacity }]}>
        <Video
          ref={videoRef}
          source={require('./src/assets/splash.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          paused={false}
          muted
          onEnd={() => setSplashVideoFinished(true)}
          onError={(error) => {
            console.warn('Splash video playback failed:', error);
            setSplashVideoFinished(true);
          }}
          onProgress={handleVideoProgress}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
        />
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${videoProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(videoProgress)}%</Text>
        </View>
      </Animated.View>
    );
  }

  // ── Initializing ──────────────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.splashSafe}>
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>OA</Text>
        </View>
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: Spacing['6'] }} />
        <Text style={styles.splashText}>Initializing...</Text>
      </SafeAreaView>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!loggedIn || !employee) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  if (employee.role === 'ADMIN') {
    return (
      <View style={styles.adminAppContainer}>
        <View style={styles.adminContent}>
          <AdminDashboard
            admin={employee}
            onLogout={handleLogout}
            isOnline={syncStatus.isOnline}
            navigationRequest={adminNavigationRequest}
            onActiveTabChange={setActiveAdminTab}
          />
        </View>

        <View style={styles.bottomNav}>
          {(
            [
              { label: 'Dashboard', icon: 'home-outline', activeIcon: 'home' },
              { label: 'Employees', icon: 'people-outline', activeIcon: 'people' },
              { label: 'Attendance', icon: 'calendar-outline', activeIcon: 'calendar' },
              { label: 'Reports', icon: 'document-text-outline', activeIcon: 'document-text' },
            ] as const
          ).map((tab) => {
            const active = activeAdminTab === tab.label;

            return (
              <TouchableOpacity
                key={tab.label}
                style={styles.bottomNavItem}
                onPress={() => {
                  setActiveAdminTab(tab.label);
                  setAdminNavigationRequest((prev) => ({
                    tab: tab.label,
                    version: prev.version + 1,
                  }));
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    styles.bottomNavIconWrap,
                    active && styles.bottomNavIconActive,
                  ]}
                >
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={22}
                    color={active ? '#4A2D18' : Colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.bottomNavLabel,
                    active && styles.bottomNavLabelSelected,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ── Employee attendance screen ────────────────────────────────────────────
  const btnCfg = getButtonConfig();
  const syncLabel = getSyncLabel();

  const attendanceState =
    attendanceStatus.checkedOut ? 'completed' :
    attendanceStatus.checkedIn ? 'checkedIn' : 'notCheckedIn';

  const stateConfig = {
    completed:    { label: 'Completed',      dotColor: Colors.accent,   labelColor: Colors.accent },
    checkedIn:    { label: 'Checked In',     dotColor: Colors.success,  labelColor: Colors.success },
    notCheckedIn: { label: 'Not Checked In', dotColor: Colors.textDisabled, labelColor: Colors.textSecondary },
  }[attendanceState];

  return (
    <SafeAreaView style={styles.employeeSafe}>
      <ImageBackground
        source={require('./src/assets/bg1.png')}
        style={styles.employeeBackground}
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={styles.employeeScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.employeeTopBar}>
            <View style={[styles.syncPill, { backgroundColor: syncLabel.bg }]}>
              <View style={[styles.syncDot, { backgroundColor: syncLabel.color }]} />
              <Text style={[styles.syncPillText, { color: syncLabel.color }]}>
                {syncLabel.text}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.roundIconButton}
              onPress={() => Alert.alert('Connection status', syncLabel.text)}
              accessibilityRole="button"
              accessibilityLabel="Show connection status"
            >
              <Ionicons name="notifications-outline" size={21} color="#4A2D18" />
              {!syncStatus.isOnline || syncStatus.pendingCount > 0 ? (
                <View style={styles.notificationDot} />
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.employeeWelcome}>
            <View style={styles.employeeAvatarRing}>
              <Avatar name={employee.name} size="lg" />
            </View>
            <View style={styles.employeeWelcomeText}>
              <Text style={styles.employeeGreeting}>{getGreeting()},</Text>
              <Text style={styles.employeeName} numberOfLines={1}>{employee.name}</Text>
              <Text style={styles.employeeMeta} numberOfLines={1}>
                {employee.employeeId}
                {employee.department ? `  ·  ${employee.department}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.dateQuoteBlock}>
            <Text style={styles.employeeDate}>{getTodayDateIST()}</Text>
            <Text style={styles.employeeQuote}>
              “Small steps make big progress.”
            </Text>
          </View>

          <View style={styles.employeeAttendanceCard}>
            <View style={styles.attendanceCardHeading}>
              <View style={styles.fingerprintCircle}>
                <Ionicons name="finger-print-outline" size={38} color="#FFF9F0" />
              </View>
              <View style={styles.attendanceHeadingText}>
                <Text style={styles.employeeActionTitle}>
                  {attendanceStatus.checkedOut
                    ? 'Attendance Complete'
                    : attendanceStatus.checkedIn
                      ? 'You’re Checked In'
                      : 'Mark Attendance'}
                </Text>
                <Text style={styles.employeeActionSubtitle}>
                  {attendanceStatus.checkedOut
                    ? 'Your attendance for today is complete.'
                    : attendanceStatus.checkedIn
                      ? 'Check out when you finish your workday.'
                      : 'Tap below to verify your location and check in.'}
                </Text>
              </View>
            </View>

            <View style={styles.employeeStatusLine}>
              <View style={[styles.stateDot, { backgroundColor: stateConfig.dotColor }]} />
              <Text style={[styles.stateLabel, { color: stateConfig.labelColor }]}>
                {stateConfig.label}
              </Text>
            </View>

            <View style={styles.employeeTimesRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>CHECK IN</Text>
                <Text style={[styles.timeValue, !attendanceStatus.checkInTime && styles.timeEmpty]}>
                  {attendanceStatus.checkInTime ? formatTimeIST(attendanceStatus.checkInTime) : '—'}
                </Text>
              </View>
              <View style={styles.timesDivider} />
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>CHECK OUT</Text>
                <Text style={[styles.timeValue, !attendanceStatus.checkOutTime && styles.timeEmpty]}>
                  {attendanceStatus.checkOutTime ? formatTimeIST(attendanceStatus.checkOutTime) : '—'}
                </Text>
              </View>
            </View>

            {isProcessing && processingMessage ? (
              <View style={styles.employeeProcessingRow}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.processingText}>{processingMessage}</Text>
              </View>
            ) : null}

            {statusMessage ? (
              <AlertBanner
                type={statusMessage.type === 'info' ? 'info' : statusMessage.type}
                message={statusMessage.message}
              />
            ) : null}

            <TouchableOpacity
              style={[
                styles.employeeActionBtn,
                btnCfg.variant === 'checkout' && styles.employeeActionBtnCheckout,
                (btnCfg.disabled || isActionDisabled()) && styles.employeeActionBtnDisabled,
              ]}
              onPress={btnCfg.onPress ?? undefined}
              disabled={btnCfg.disabled || isActionDisabled()}
              accessibilityLabel={btnCfg.title}
              accessibilityRole="button"
              activeOpacity={0.86}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF9F0" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={attendanceStatus.checkedOut ? 'checkmark-circle-outline' : 'finger-print-outline'}
                    size={21}
                    color="#FFF9F0"
                    style={{ marginRight: 9 }}
                  />
                  <Text style={styles.employeeActionBtnText}>{btnCfg.title}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.gpsInfo}>
              <Ionicons name="location-outline" size={17} color="#7A6248" />
              <Text style={styles.gpsInfoText}>
                {isProcessing
                  ? 'Verifying your location against office geofence…'
                  : 'GPS location verification is required for attendance.'}
              </Text>
            </View>
          </View>

          {!syncStatus.isOnline ? (
            <View style={styles.employeeOfflineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#8A5B16" />
              <Text style={styles.employeeOfflineText}>
                Offline mode · Attendance is saved locally and will sync when you reconnect.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.employeeLogout} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={17} color="#80513D" />
            <Text style={styles.employeeLogoutText}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashVideoContainer: {
    flex: 1,
    backgroundColor: '#000000', // Match native splash screen background
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  progressText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },


  // ── Employee dashboard UI ──
  employeeSafe: {
    flex: 1,
    backgroundColor: '#F8EBDD',
  },
  employeeBackground: {
    flex: 1,
  },
  employeeScroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
  },
  employeeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  roundIconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9EF',
    borderWidth: 1,
    borderColor: '#D9C3A2',
    borderBottomWidth: 3,
    borderBottomColor: '#CBB18B',
    position: 'relative',
    shadowColor: '#5A3B20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C84A3D',
  },
  employeeWelcome: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 250, 242, 0.94)',
    borderWidth: 1,
    borderColor: '#E3D0B5',
    borderBottomWidth: 3,
    borderBottomColor: '#D4BB97',
    marginBottom: 10,
    shadowColor: '#684A2B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  employeeAvatarRing: {
    width: 70,
    height: 70,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D7B98D',
    backgroundColor: '#F0E0C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  employeeWelcomeText: {
    flex: 1,
    minWidth: 0,
  },
  employeeGreeting: {
    fontSize: 15,
    color: '#7A6044',
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  employeeName: {
    fontSize: 22,
    lineHeight: 28,
    color: '#382313',
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  employeeMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#765F48',
  },
  dateQuoteBlock: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 10,
    marginLeft: "20%",
  },
  dateWeekday: {
    fontSize: 10,
    color: '#826A50',
    fontWeight: '600',
    marginLeft: "20%",
  },
  employeeDate: {
    fontSize: 16,
    lineHeight: 31,
    color: '#382313',
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  employeeQuote: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: '#826B53',
  },
  employeeAttendanceCard: {
    padding: 18,
    borderRadius: 21,
    backgroundColor: '#fff7e8',
    borderWidth: 1,
    borderColor: '#DCC4A0',
    borderTopColor: '#FFFDF8',
    borderBottomWidth: 5,
    borderBottomColor: '#CDB18A',
    shadowColor: '#5B3C20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 13,
    elevation: 6,
  },
  attendanceCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E9D9C1',
  },
  fingerprintCircle: {
    width: 64,
    height: 64,
    borderRadius: 19,
    backgroundColor: '#3E6041',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    borderWidth: 1,
    borderTopColor: '#789078',
    borderBottomWidth: 4,
    borderBottomColor: '#263F29',
    shadowColor: '#2B472E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  attendanceHeadingText: {
    flex: 1,
    minWidth: 0,
  },
  employeeActionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#382313',
    marginBottom: 5,
    letterSpacing: -0.25,
  },
  employeeActionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#806A53',
  },
  employeeStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F2E5D0',
    borderWidth: 1,
    borderColor: '#E2CFB0',
    marginBottom: 13,
    gap: 7,
  },
  employeeTimesRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EBDD',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E6D5BA',
    paddingVertical: 15,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  employeeProcessingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#E5EEF7',
    marginBottom: 12,
  },
  employeeActionBtn: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: '#4A2D18',
    borderWidth: 1,
    borderTopColor: '#806044',
    borderBottomWidth: 4,
    borderBottomColor: '#2E1C10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 15,
    shadowColor: '#4A2D18',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 4,
  },
  employeeActionBtnCheckout: {
    backgroundColor: '#98601F',
    borderTopColor: '#C38D4B',
    borderBottomColor: '#6F4316',
  },
  employeeActionBtnDisabled: {
    opacity: 0.65,
  },
  employeeActionBtnText: {
    color: '#FFF9F0',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  gpsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2D0B4',
  },
  gpsInfoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#806A53',
  },
  employeeOfflineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#FFF3D9',
    borderWidth: 1,
    borderColor: '#E2C795',
    borderLeftWidth: 4,
    borderLeftColor: '#B77A27',
  },
  employeeOfflineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#8A5B16',
  },
  employeeLogout: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 249, 239, 0.92)',
    borderWidth: 1,
    borderColor: '#E2CDB0',
    borderBottomWidth: 3,
    borderBottomColor: '#D0B28B',
  },
  employeeLogoutText: {
    color: '#80513D',
    fontSize: 12,
    fontWeight: '700',
  },

  adminAppContainer: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  adminContent: {
    flex: 1,
  },
  
  // ── Admin Bottom Nav ──
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSurface, // The cream/beige background
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12, // Extra padding for iPhone home indicator
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 12,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomNavIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bottomNavIconActive: {
    // The pill background seen behind the active icon
    backgroundColor: '#F0E5D5', 
  },
  bottomNavLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  bottomNavLabelSelected: {
    color: '#4A2D18', // Warm brown matching your active state
    fontWeight: '700',
  },

  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    padding: Spacing['5'],
    paddingBottom: Spacing['10'],
  },

  // Splash
  splashSafe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.accent,
  },
  splashLogoText: {
    color: Colors.textInverse,
    fontSize: Typography.xl,
    fontWeight: Typography.extrabold,
  },
  splashText: {
    marginTop: Spacing['3'],
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing['5'],
  },
  appLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2.5'],
    paddingVertical: Spacing['1'],
    borderRadius: Radii.full,
    gap: Spacing['1'],
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncPillText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },

  // Welcome
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['4'],
    marginBottom: Spacing['5'],
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: '#D8C9AD',
    padding: Spacing['4'],
    ...Shadows.sm,
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  welcomeName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  welcomeMeta: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Attendance card
  attendanceCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: '#D8C9AD',
    padding: Spacing['5'],
    marginBottom: Spacing['4'],
    ...Shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing['1'],
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['1'],
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stateLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  dateText: {
    fontSize: Typography.xs,
    color: '#ffe2e2',
    marginBottom: Spacing['4'],
  },
  timesRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgPrimary,
    borderRadius: Radii.md,
    padding: Spacing['4'],
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timesDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing['3'],
  },
  timeLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing['1'],
  },
  timeValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  timeEmpty: {
    color: Colors.textDisabled,
    fontSize: Typography.md,
  },

  // Processing
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
    backgroundColor: Colors.infoBg,
    borderRadius: Radii.md,
    padding: Spacing['3'],
    marginBottom: Spacing['3'],
    borderLeftWidth: 3,
    borderLeftColor: Colors.infoBorder,
  },
  processingText: {
    fontSize: Typography.sm,
    color: Colors.info,
    fontWeight: Typography.medium,
    flex: 1,
  },

  // Action button
  actionBtn: {
    height: 60,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#77957A',
    borderBottomWidth: 3,
    borderBottomColor: Colors.accentPressed,
    marginBottom: Spacing['4'],
  },
  actionBtnCheckIn: {
    backgroundColor: Colors.accent,
    ...Shadows.accent,
  },
  actionBtnCheckOut: {
    backgroundColor: Colors.warning,
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnDisabled: {
    backgroundColor: Colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    letterSpacing: 0.3,
  },

  // Info card
  infoCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['3'],
    marginBottom: Spacing['3'],
    ...Shadows.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  infoDotIdle: {
    backgroundColor: Colors.success,
  },
  infoDotPulsing: {
    backgroundColor: Colors.warning,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Offline banner
  offlineBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radii.md,
    padding: Spacing['3'],
    marginBottom: Spacing['3'],
    borderLeftWidth: 3,
    borderLeftColor: Colors.warningBorder,
  },
  offlineBannerText: {
    fontSize: Typography.xs,
    color: Colors.warning,
    fontWeight: Typography.medium,
    lineHeight: 18,
  },

  // Logout
  logoutBtn: {
    height: Sizes.buttonHeightSm,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
    marginTop: Spacing['2'],
  },
  logoutBtnText: {
    color: Colors.error,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
});