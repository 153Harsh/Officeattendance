import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getTodayAttendance,
  TodayAttendanceResponse,
  TodayAttendanceRecord,
} from '../services/adminService';
import {
  LoadingState,
  ErrorState,
  OfflineState,
} from '../components/StateViews';

type Props = {
  isOnline: boolean;
  onBack: () => void;
  onViewEmployee?: (employeeId: string) => void;
};

const C = {
  bg: '#E9DFC9',
  card: '#fff7e8',
  field: '#F4EEE4',
  border: '#E9DFD0',
  text: '#34271B',
  muted: '#7D7061',
  brown: '#55351D',
  brownDark: '#3D2515',
  green: '#167844',
  greenBg: '#BFECCB',
  amber: '#A85B00',
  amberBg: '#FFE8B5',
  red: '#C52820',
  redBg: '#FFD7D3',
  blue: '#175B9D',
  blueBg: '#DCEBFF',
  white: '#FFFFFF',
};

function formatTimeIST(iso: string | null): string {
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

function formatDateIST(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateForAPI(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default function TodayAttendanceScreen({ isOnline, onBack, onViewEmployee }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState<TodayAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Present' | 'Late' | 'Absent'>(
    'All',
  );

  const load = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const dateString = formatDateForAPI(selectedDate);
      const result = await getTodayAttendance(dateString);
      setData(result);
    } catch {
      setError("Unable to load attendance. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, selectedDate]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    setLoading(true);
  };

  const handleNextDay = () => {
    const today = new Date();
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    // Don't allow navigating to future dates
    if (newDate <= today) {
      setSelectedDate(newDate);
      setLoading(true);
    }
  };

  const handleRefresh = () => {
    // Refresh current selected date
    setRefreshing(true);
    load();
  };

  const summary = data?.summary;
  const attendance = data?.attendance ?? [];
  const presentCount = summary?.present ?? 0;
  const lateCount = summary?.late ?? 0;
  const absentCount = summary?.absent ?? 0;
  const totalCount = summary?.totalEmployees ?? attendance.length;

  const filteredAttendance = useMemo(() => {
    const query = search.trim().toLowerCase();
    return attendance.filter(record => {
      const status = record.status.toLowerCase();
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Present' && status.includes('present')) ||
        (filter === 'Late' && status.includes('late')) ||
        (filter === 'Absent' && status.includes('absent'));
      const matchesSearch =
        !query ||
        record.name.toLowerCase().includes(query) ||
        record.employeeId.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [attendance, filter, search]);

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} />
        <OfflineState onBack={onBack} />
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} onRefresh={handleRefresh} />
        <LoadingState message="Loading attendance..." />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} onRefresh={handleRefresh} />
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            load();
          }}
          onBack={onBack}
        />
      </SafeAreaView>
    );
  }

  const filterItems = [
    { key: 'All' as const, count: totalCount },
    { key: 'Present' as const, count: presentCount },
    { key: 'Late' as const, count: lateCount },
    { key: 'Absent' as const, count: absentCount },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={onBack} onRefresh={handleRefresh} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.brown}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.statsRow}>
          <StatCard
            value={String(presentCount)}
            label="Present"
            bg="#DFF4E3"
            color={C.green}
          />
          <StatCard
            value={String(lateCount)}
            label="Late"
            bg="#FFF0D0"
            color={C.amber}
          />
          <StatCard
            value={String(absentCount)}
            label="Absent"
            bg="#FCE1DE"
            color={C.red}
          />
          <StatCard
            value={String(totalCount)}
            label="Total"
            bg={C.blueBg}
            color={C.blue}
          />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder="Search employee..."
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search employee"
            />
            {!!search && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                accessibilityLabel="Clear search"
              >
                <Text style={styles.clearSearch}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.filterRow}>
          {filterItems.map(item => {
            const selected = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {item.key} ({item.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredAttendance.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matching employees</Text>
            <Text style={styles.emptyText}>
              Try another search or status filter.
            </Text>
          </View>
        ) : (
          filteredAttendance.map(record => (
            <EmployeeAttendanceRow 
              key={record.employeeId} 
              record={record} 
              onPress={() => onViewEmployee?.(record.employeeId)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  onRefresh,
}: {
  onBack: () => void;
  onRefresh?: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerBack}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Today's Attendance</Text>
      <TouchableOpacity
        style={styles.headerAction}
        onPress={onRefresh}
        accessibilityLabel="Refresh attendance"
      >
        <Text style={styles.headerActionText}>↻</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatCard({
  value,
  label,
  bg,
  color,
}: {
  value: string;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

function EmployeeAttendanceRow({ 
  record, 
  onPress 
}: { 
  record: TodayAttendanceRecord; 
  onPress?: () => void;
}) {
  const status = record.status.toLowerCase();
  const isLate = status.includes('late');
  const isAbsent = status.includes('absent');
  const isPresent =
    status.includes('present') || (!!record.checkIn && !isAbsent);
  const avatarSource =
    record.name.toLowerCase().includes('sneha') ||
    record.name.toLowerCase().includes('neha') ||
    record.name.toLowerCase().includes('girl')
      ? require('../assets/girl.png')
      : require('../assets/boy.png');

  const statusLabel = isAbsent ? 'Absent' : isLate ? 'Late' : 'Present';
  const statusStyle = isAbsent
    ? rowStyles.absentPill
    : isLate
    ? rowStyles.latePill
    : rowStyles.presentPill;
  const statusTextStyle = isAbsent
    ? rowStyles.absentText
    : isLate
    ? rowStyles.lateText
    : rowStyles.presentText;

  return (
    <TouchableOpacity 
      style={rowStyles.row} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={rowStyles.avatarWrap}>
        <Image
          source={avatarSource}
          style={rowStyles.avatar}
          resizeMode="cover"
        />
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {record.name}
        </Text>
        <Text style={rowStyles.employeeId}>{record.employeeId}</Text>
      </View>
      <View style={rowStyles.right}>
        <View style={[rowStyles.statusPill, statusStyle]}>
          <Text style={[rowStyles.statusText, statusTextStyle]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={rowStyles.time}>
          {isAbsent ? '—:—' : formatTimeIST(record.checkIn)}
        </Text>
      </View>
      <Text style={rowStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingTop: 5, paddingBottom: 24 },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerBack: {
    width: 30,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: { color: C.brown, fontSize: 32, lineHeight: 35 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#211A14',
    fontSize: 15,
    fontWeight: '800',
  },
  headerAction: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#DDF1E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    color: C.green,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 24,
  },
  dateBar: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0E7DA',
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  dateArrow: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#E7D9C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowText: { color: C.brown, fontSize: 22, lineHeight: 25 },
  dateText: { color: C.text, fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  statCard: {
    flex: 1,
    minWidth: 0,
    height: 53,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  statValue: { fontSize: 16, lineHeight: 19, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 9,
  },
  searchBox: {
    flex: 1,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2EBE0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 9,
  },
  searchGlyph: { color: C.muted, fontSize: 20, marginRight: 6 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 5,
    fontSize: 10,
    color: C.text,
  },
  clearSearch: { fontSize: 18, color: C.muted, paddingLeft: 4 },
  filterIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#F2EBE0',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconText: { color: C.brown, fontSize: 17 },
  filterRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  filterChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#F0E7DA',
    borderWidth: 1,
    borderColor: '#EDE1D0',
  },
  filterChipSelected: { backgroundColor: C.brown, borderColor: C.brown },
  filterText: { color: C.muted, fontSize: 8, fontWeight: '700' },
  filterTextSelected: { color: C.white },
  emptyWrap: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  emptyText: { color: C.muted, fontSize: 11, marginTop: 4 },
});

const rowStyles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE3D6',
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E9DFD1',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 17 },
  info: { flex: 1, minWidth: 0, justifyContent: 'center' },
  name: { color: C.text, fontSize: 10, lineHeight: 13, fontWeight: '800' },
  employeeId: { color: C.muted, fontSize: 9, lineHeight: 12 },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 57,
    marginLeft: 5,
  },
  statusPill: {
    minWidth: 46,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: { fontSize: 9, fontWeight: '800' },
  presentPill: { backgroundColor: C.greenBg },
  presentText: { color: C.green },
  latePill: { backgroundColor: C.amberBg },
  lateText: { color: C.amber },
  absentPill: { backgroundColor: C.redBg },
  absentText: { color: C.red },
  time: { color: C.muted, fontSize: 8, marginTop: 2 },
  chevron: {
    color: '#6E5A45',
    fontSize: 24,
    lineHeight: 27,
    marginLeft: 7,
    marginTop: -2,
  },
});