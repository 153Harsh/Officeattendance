import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmployeeListScreen from './EmployeeListScreen';
import EmployeeFormScreen from './EmployeeFormScreen';
import TodayAttendanceScreen from './TodayAttendanceScreen';
import AttendanceHistoryScreen from './AttendanceHistoryScreen';
import EmployeeReportsScreen from './EmployeeReportsScreen';

import {
  Employee,
  getAllEmployees,
  getTodayAttendance,
} from '../services/adminService';

import Avatar from '../components/Avatar';
import { Image, ImageBackground } from 'react-native';
import StatusBadge from '../components/StatusBadge';
import { OfflineState } from '../components/StateViews';

type AdminTab = 'Dashboard' | 'Employees' | 'Attendance' | 'Reports';

type Props = {
  navigationRequest: { tab: AdminTab; version: number };
  onActiveTabChange: (tab: AdminTab) => void;
  admin: {
    employeeId: string;
    name: string;
    department: string | null;
    role: 'ADMIN' | 'EMPLOYEE';
  };
  onLogout: () => void;
  isOnline: boolean;
};

type Screen =
  | 'main'
  | 'employees'
  | 'add-employee'
  | 'edit-employee'
  | 'today-attendance'
  | 'attendance-history'
  | 'download-report';

type OverviewStats = {
  totalEmployees: string;
  present: string;
  late: string;
  checkedIn: string;
  checkedOut: string;
  absent: string;
};

type DashboardAttendance = {
  employeeId: string;
  name: string;
  department?: string | null;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
};

const INITIAL_STATS: OverviewStats = {
  totalEmployees: '—',
  present: '—',
  late: '—',
  checkedIn: '—',
  checkedOut: '—',
  absent: '—',
};

const C = {
  background: '#E9DFC9',
  paper: '#F8F0DE',
  paperLight: '#FFF9ED',
  paperDark: '#D8C9AD',
  border: '#E4D7BE',
  text: '#423528',
  muted: '#82735E',
  green: '#208653',
  greenBg: '#DDF3E5',
  red: '#D94C4C',
  redBg: '#FCE5E2',
  amber: '#D58A16',
  amberBg: '#FFF0D2',
  blue: '#3478E5',
  blueBg: '#E1ECFF',
  purple: '#8055C7',
  purpleBg: '#EEE5FF',
};

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning,';
  if (hour < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export default function AdminDashboard({
  admin,
  onLogout,
  isOnline,
  navigationRequest,
  onActiveTabChange,
}: Props) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [overviewStats, setOverviewStats] = useState<OverviewStats>(INITIAL_STATS);
  const [todayAttendance, setTodayAttendance] = useState<DashboardAttendance[]>([]);

  useEffect(() => {
    const screenByTab: Record<AdminTab, Screen> = {
      Dashboard: 'main',
      Employees: 'employees',
      Attendance: 'today-attendance',
      Reports: 'download-report',
    };
    setSelectedEmployee(null);
    setCurrentScreen(screenByTab[navigationRequest.tab]);
  }, [navigationRequest.version]);

  useEffect(() => {
    let tab: AdminTab;
    if (currentScreen === 'main') tab = 'Dashboard';
    else if (
      currentScreen === 'employees' ||
      currentScreen === 'add-employee' ||
      currentScreen === 'edit-employee'
    ) tab = 'Employees';
    else if (
      currentScreen === 'today-attendance' ||
      currentScreen === 'attendance-history'
    ) tab = 'Attendance';
    else tab = 'Reports';

    onActiveTabChange(tab);
  }, [currentScreen, onActiveTabChange]);

  useEffect(() => {
    if (!isOnline || currentScreen !== 'main') return;
    let cancelled = false;

    const loadOverview = async () => {
      try {
        const [employees, today] = await Promise.all([
          getAllEmployees(),
          getTodayAttendance(),
        ]);
        if (cancelled) return;

        setOverviewStats({
          totalEmployees: String(employees.length),
          present: String(today.summary.present),
          late: String(today.summary.late),
          checkedIn: String(today.summary.checkedIn),
          checkedOut: String(today.summary.checkedOut),
          absent: String(today.summary.absent),
        });
        setTodayAttendance((today.attendance ?? []) as DashboardAttendance[]);
      } catch {
        // Keep the last successful dashboard data if a request fails.
      }
    };

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [isOnline, currentScreen]);

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setCurrentScreen('edit-employee');
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
    setSelectedEmployee(null);
  };

  const handleBackToEmployees = () => {
    setCurrentScreen('employees');
    setSelectedEmployee(null);
  };

  if (currentScreen === 'employees') {
    return (
      <EmployeeListScreen
        isOnline={isOnline}
        currentAdminEmployeeId={admin.employeeId}
        onBack={handleBackToMain}
        onAddEmployee={() => setCurrentScreen('add-employee')}
        onEditEmployee={handleEditEmployee}
      />
    );
  }

  if (currentScreen === 'add-employee') {
    return (
      <EmployeeFormScreen
        isOnline={isOnline}
        onBack={handleBackToEmployees}
        onSuccess={handleBackToEmployees}
      />
    );
  }

  if (currentScreen === 'edit-employee' && selectedEmployee) {
    return (
      <EmployeeFormScreen
        isOnline={isOnline}
        onBack={handleBackToEmployees}
        onSuccess={handleBackToEmployees}
        editEmployee={selectedEmployee}
      />
    );
  }

  if (currentScreen === 'today-attendance') {
    return <TodayAttendanceScreen isOnline={isOnline} onBack={handleBackToMain} />;
  }

  if (currentScreen === 'attendance-history') {
    return <AttendanceHistoryScreen onBack={handleBackToMain} isOnline={isOnline} />;
  }

  if (currentScreen === 'download-report') {
    return <EmployeeReportsScreen isOnline={isOnline} onBack={handleBackToMain} />;
  }

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.safe}>
        <OfflineState onBack={onLogout} />
      </SafeAreaView>
    );
  }

  const firstName = admin.name.split(' ')[0];

  const stats = [
    { label: 'Present', value: overviewStats.present, color: C.green, bg: C.greenBg, icon: '✓' },
    { label: 'Late', value: overviewStats.late, color: C.amber, bg: C.amberBg, icon: '◷' },
    { label: 'Absent', value: overviewStats.absent, color: C.red, bg: C.redBg, icon: '×' },
    { label: 'Total', value: overviewStats.totalEmployees, color: C.blue, bg: C.blueBg, icon: '▦' },
  ];

  const actions: Array<{ id: Screen; title: string; icon: string; color: string; bg: string }> = [
    { id: 'add-employee', title: 'Add Employee', icon: '♙', color: C.amber, bg: C.amberBg },
    { id: 'download-report', title: 'View Reports', icon: '▤', color: C.red, bg: C.redBg },
    { id: 'today-attendance', title: 'Today Attendance', icon: '◷', color: C.blue, bg: C.blueBg },
    { id: 'attendance-history', title: 'Attendance', icon: '⚙', color: C.purple, bg: C.purpleBg },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/icon.png')} style={styles.brandImage} resizeMode="contain" />
            <Text style={styles.appLabel}>Office Attendance</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            activeOpacity={0.75}
          >
            <Image source={require('../assets/boy.png')} style={styles.adminicon} resizeMode="contain" />
            {/* <Avatar name={admin.name} size="md" /> */}
          </TouchableOpacity>
        </View>

        <ImageBackground
          source={require('../assets/bg.png')}
          resizeMode="cover"
          imageStyle={styles.welcomeBackgroundImage}
          style={styles.welcomeCard}
        >
          <View style={styles.welcomeCopy}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.welcomeName}>{firstName},</Text>
            <Text style={styles.welcomeSub}>Here's what's happening today.</Text>
          </View>
          <View style={styles.dateCard}>
            <Text style={styles.dateDay}>
              {new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date())}
            </Text>
            <Text style={styles.dateNumber}>{new Date().getDate()}</Text>
            <Text style={styles.dateMonth}>
              {new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date())}
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.statsGrid}>
          {stats.map(stat => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <View style={[styles.statIcon, { backgroundColor: stat.color }]}>
                <Text style={styles.statIconText}>{stat.icon}</Text>
              </View>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Attendance</Text>
          <TouchableOpacity
            onPress={() => setCurrentScreen('today-attendance')}
            accessibilityRole="button"
          >
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.attendanceCard}>
          {todayAttendance.length === 0 ? (
            <View style={styles.emptyAttendance}>
              <Text style={styles.emptyText}>No attendance records to show yet.</Text>
            </View>
          ) : (
            <ScrollView style={styles.attendanceScroll} nestedScrollEnabled={true}>
              {todayAttendance.map((record, index) => (
                <View
                  key={record.employeeId || `${record.name}-${index}`}
                  style={[
                    styles.employeeRow,
                    index === todayAttendance.length - 1 && styles.employeeRowLast,
                  ]}
                >
                  <Image
                    source={record.employeeId?.toUpperCase().includes('EMP') && index % 2 === 1
                      ? require('../assets/girl.png')
                      : require('../assets/boy.png')}
                    style={styles.employeeAvatar}
                    resizeMode="cover"
                  />
                  <View style={styles.employeeInfo}>
                    <Text numberOfLines={1} style={styles.employeeName}>{record.name}</Text>
                    <Text style={styles.employeeId}>{record.employeeId}</Text>
                  </View>
                  <StatusBadge status={record.status as any} size="sm" />
                  <Text style={styles.employeeTime}>{formatTime(record.checkIn)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsGrid}>
          {actions.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={() => setCurrentScreen(action.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={action.title}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                <Text style={[styles.actionIconText, { color: action.color }]}>{action.icon}</Text>
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
  },
  topBar: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandImage: {
  width: 36,
  height: 36,
},
  adminicon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    borderRadius: 12,
  },
  appLabel: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
  },
  welcomeCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    marginBottom: 10,
    borderRadius: 15,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 3,
    borderBottomColor: C.paperDark,
    overflow: 'hidden',
  },
  welcomeBackgroundImage: {
    borderRadius: 15,
    opacity: 0.22,
  },
  welcomeCopy: {
    flex: 1,
    paddingRight: 8,
  },
  greeting: {
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
  },
  welcomeName: {
    color: C.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  welcomeSub: {
    marginTop: 3,
    color: C.muted,
    fontSize: 9,
  },
  dateCard: {
    minWidth: 61,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: '#F1E3CE',
    borderWidth: 1,
    borderColor: '#E2CFB0',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 9,
    fontWeight: '700',
    color: C.muted,
  },
  dateNumber: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '900',
    color: C.text,
  },
  dateMonth: {
    fontSize: 8,
    color: C.muted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 13,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF90',
  },
  statIcon: {
    width: 19,
    height: 19,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  statIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  statValue: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 1,
    fontSize: 9,
    color: C.text,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: C.text,
  },
  viewAll: {
    color: C.green,
    fontSize: 10,
    fontWeight: '800',
  },
  attendanceCard: {
    backgroundColor: C.paper,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 9,
    marginBottom: 13,
    maxHeight: 250,
  },
  attendanceScroll: {
    width: '100%',
  },
  emptyAttendance: {
    minHeight: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: C.muted,
    fontSize: 10,
  },
  employeeRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E9DEC9',
  },
  employeeRowLast: {
    borderBottomWidth: 0,
  },
  employeeAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.paperDark,
  },
  employeeInfo: {
    flex: 1,
    minWidth: 0,
  },
  employeeName: {
    color: C.text,
    fontSize: 10,
    fontWeight: '800',
  },
  employeeId: {
    color: C.muted,
    fontSize: 8,
    marginTop: 1,
  },
  employeeTime: {
    color: C.muted,
    fontSize: 8,
    minWidth: 44,
    textAlign: 'right',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  actionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    paddingVertical: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 3,
    borderBottomColor: C.paperDark,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  actionIconText: {
    fontSize: 18,
    fontWeight: '800',
  },
  actionTitle: {
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    color: C.text,
  },
  bottomSpace: {
    height: 30,
  },
  logoutButton: {
    backgroundColor: C.red,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 10,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});