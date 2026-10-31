import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Employee, getAllEmployees } from '../services/adminService';
import { API_BASE_URL } from '../services/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from '../components/StateViews';

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
  greenBg: '#DFF4E3',
  amber: '#A85B00',
  amberBg: '#FFF0D0',
  red: '#C52820',
  redBg: '#FCE1DE',
  white: '#FFFFFF',
};

function eligibleMonths(createdAt?: string): string[] {
  const start = createdAt ? new Date(createdAt) : null;
  if (!start || Number.isNaN(start.getTime())) return [];

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(nowParts.find(p => p.type === 'year')?.value);
  const month = Number(nowParts.find(p => p.type === 'month')?.value);

  const startKey = /^\d{4}-\d{2}/.test(createdAt ?? '')
    ? (createdAt as string).slice(0, 7)
    : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  const endKey = `${year}-${String(month).padStart(2, '0')}`;
  const months: string[] = [];
  const cursor = new Date(
    Number(startKey.slice(0, 4)),
    Number(startKey.slice(5, 7)) - 1,
    1,
  );
  const end = new Date(year, month - 1, 1);

  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
        2,
        '0',
      )}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return startKey <= endKey ? months.reverse() : [];
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export default function EmployeeReportsScreen({
  isOnline,
  onBack,
}: {
  isOnline: boolean;
  onBack: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [month, setMonth] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    return `${parts.find(p => p.type === 'year')?.value}-${
      parts.find(p => p.type === 'month')?.value
    }`;
  });
  const [departmentFilter, setDepartmentFilter] = useState('All Department');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setEmployees(await getAllEmployees());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load employees.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOnline) load();
    else setLoading(false);
  }, [isOnline]);

  const departments = useMemo(
    () => [
      'All Department',
      ...Array.from(
        new Set(
          employees.map(e => e.department).filter((d): d is string => !!d),
        ),
      ),
    ],
    [employees],
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter(employee => {
        const matchesDepartment =
          departmentFilter === 'All Department' ||
          employee.department === departmentFilter;
        const matchesStatus =
          statusFilter === 'All Status' ||
          (statusFilter === 'Active' && employee.isActive) ||
          (statusFilter === 'Inactive' && !employee.isActive);
        return matchesDepartment && matchesStatus;
      }),
    [employees, departmentFilter, statusFilter],
  );

  const download = async (employee: Employee, reportMonth: string) => {
    setSelected(null);
    const url = `${API_BASE_URL}/admin/attendance/report?month=${encodeURIComponent(
      reportMonth,
    )}&employeeId=${encodeURIComponent(employee.employeeId)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Report unavailable',
        'Could not open the attendance PDF. Check your connection and try again.',
      );
    }
  };

  const changeMonth = (offset: number) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
  };

  const currentMonthLabel = monthLabel(month);

  if (!isOnline)
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} />
        <OfflineState onBack={onBack} />
      </SafeAreaView>
    );
  if (loading)
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} />
        <LoadingState message="Loading employees..." />
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={onBack} />
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

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={onBack} />

      <View style={styles.filtersContainer}>
        <View style={styles.filters}>
          <TouchableOpacity
            style={styles.filterWrap}
            onPress={() => {
              setDepartmentDropdownOpen(!departmentDropdownOpen);
              setStatusDropdownOpen(false);
            }}
            accessibilityLabel="Department filter"
          >
            <Text style={styles.filterLabel}>#</Text>
            <Text style={styles.filterText}>{departmentFilter}</Text>
            <Text
              style={[
                styles.filterArrow,
                departmentDropdownOpen && styles.arrowUp,
              ]}
            >
              ⌄
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterWrap}
            onPress={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setDepartmentDropdownOpen(false);
            }}
            accessibilityLabel="Status filter"
          >
            <Text style={styles.filterText}>{statusFilter}</Text>
            <Text
              style={[styles.filterArrow, statusDropdownOpen && styles.arrowUp]}
            >
              ⌄
            </Text>
          </TouchableOpacity>
        </View>

        {/* Department dropdown */}
        {departmentDropdownOpen && (
          <View style={styles.dropdownContainer}>
            {departments.map(department => (
              <TouchableOpacity
                key={department}
                style={[
                  styles.dropdownItem,
                  departmentFilter === department && styles.selectedItem,
                ]}
                onPress={() => {
                  setDepartmentFilter(department);
                  setDepartmentDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    departmentFilter === department && styles.selectedItemText,
                  ]}
                >
                  {department}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status dropdown */}
        {statusDropdownOpen && (
          <View style={[styles.dropdownContainer, styles.statusDropdown]}>
            {['All Status', 'Active', 'Inactive'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.dropdownItem,
                  statusFilter === status && styles.selectedItem,
                ]}
                onPress={() => {
                  setStatusFilter(status);
                  setStatusDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    statusFilter === status && styles.selectedItemText,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={filteredEmployees}
        keyExtractor={e => e.employeeId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.numberCol]}>#</Text>
            <Text style={[styles.th, styles.employeeCol]}>Employee</Text>
            <Text style={[styles.th, styles.departmentCol]}>Department</Text>
            <Text style={[styles.th, styles.metricCol, styles.greenText]}>
              Present
            </Text>
            <Text style={[styles.th, styles.metricCol, styles.amberText]}>
              Late
            </Text>
            <Text style={[styles.th, styles.metricCol, styles.redText]}>
              Absent
            </Text>
            <Text style={[styles.th, styles.metricCol]}>Total</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No employees found"
            subtitle="Try changing the filters."
          />
        }
        renderItem={({ item, index }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.numberCol]}>{index + 1}</Text>
            <View style={styles.employeeCol}>
              <View style={styles.employeeInfo}>
                <View style={styles.avatarWrap}>
                  <Image
                    source={
                      item.name.toLowerCase().includes('sneha') ||
                      item.name.toLowerCase().includes('neha') ||
                      item.name.toLowerCase().includes('girl')
                        ? require('../assets/girl.png')
                        : require('../assets/boy.png')
                    }
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.employeeText}>
                  <Text style={styles.employeeName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.employeeId} numberOfLines={1}>
                    {item.employeeId}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.cell, styles.departmentCol]} numberOfLines={1}>
              {item.department ?? '—'}
            </Text>
            <Text style={[styles.cell, styles.metricCol, styles.greenText]}>
              —
            </Text>
            <Text style={[styles.cell, styles.metricCol, styles.amberText]}>
              —
            </Text>
            <Text style={[styles.cell, styles.metricCol, styles.redText]}>
              —
            </Text>
            <View style={[styles.cell, styles.metricCol]}>
              <TouchableOpacity 
                style={styles.downloadButton}
                onPress={() => setSelected(item)}
                accessibilityLabel="Download report"
              >
                <Text style={styles.downloadIcon}>↓</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Touchable overlay to close dropdowns when clicking outside */}
      {(departmentDropdownOpen || statusDropdownOpen) && (
        <TouchableOpacity
          style={styles.dropdownOverlay}
          onPress={() => {
            setDepartmentDropdownOpen(false);
            setStatusDropdownOpen(false);
          }}
          activeOpacity={1}
        />
      )}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Choose report month</Text>
            <Text style={styles.modalSubtitle}>{selected?.name}</Text>
            <FlatList
              data={selected ? eligibleMonths(selected.createdAt) : []}
              keyExtractor={m => m}
              style={styles.monthList}
              ListEmptyComponent={
                <Text style={styles.emptyMonths}>
                  No eligible months are available for this employee.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.monthButton}
                  onPress={() => download(selected!, item)}
                >
                  <Text style={styles.monthText}>{monthLabel(item)}</Text>
                  <Text style={styles.downloadIcon}>↓</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.cancel}
              onPress={() => setSelected(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Employee Reports</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: { width: 36, height: 38, justifyContent: 'center' },
  backText: { color: C.brown, fontSize: 29, lineHeight: 32 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
  },
  downloadHeader: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadHeaderText: { color: C.brown, fontSize: 23, fontWeight: '800' },
  monthBar: {
    alignSelf: 'center',
    width: '72%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0E7DA',
    borderRadius: 15,
    paddingHorizontal: 5,
    marginBottom: 7,
  },
  monthArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7D9C6',
  },
  monthArrowText: { color: C.brown, fontSize: 25, lineHeight: 29 },
  monthTitle: { color: C.text, fontSize: 11, fontWeight: '700' },
  filters: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    marginBottom: 8,
  },
  filterWrap: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
  },
  filterLabel: { color: C.muted, fontSize: 12, marginRight: 6 },
  filterText: { flex: 1, paddingVertical: 0, color: C.text, fontSize: 11 },
  filterArrow: { color: C.muted, fontSize: 14, width: 16, height: 16, textAlign: 'center' },
  arrowUp: { transform: [{ rotate: '180deg' }] },
  filtersContainer: { position: 'relative', zIndex: 10 },
  dropdownContainer: {
    position: 'absolute',
    top: 40,
    left: 13,
    width: '48%',
    backgroundColor: C.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  statusDropdown: { left: '52%' },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE4D7',
  },
  dropdownText: { color: C.text, fontSize: 11, fontWeight: '500' },
  selectedItem: { backgroundColor: C.brown },
  selectedItemText: { color: C.white, fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  tableHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E7DA',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    paddingHorizontal: 7,
  },
  th: { color: C.text, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tableRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE4D7',
  },
  cell: { color: C.text, fontSize: 10, textAlign: 'center' },
  numberCol: { width: '6%' },
  employeeCol: { width: '29%' },
  departmentCol: { width: '20%', textAlign: 'center' },
  metricCol: { flex: 1, textAlign: 'center' },
  greenText: { color: C.green, fontWeight: '800' },
  amberText: { color: C.amber, fontWeight: '800' },
  redText: { color: C.red, fontWeight: '800' },
  employeeInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E9DFD1',
  },
  avatar: { width: '100%', height: '100%' },
  employeeText: { flex: 1, minWidth: 0 },
  employeeName: { color: C.text, fontSize: 9, fontWeight: '800' },
  employeeId: { color: C.muted, fontSize: 8 },
  overlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: 24,
  },
  dropdownOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'transparent',
    zIndex: 5
  },
  modal: {
    maxHeight: '80%',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  modalTitle: { fontSize: 19, fontWeight: '900', color: C.text },
  modalSubtitle: { color: C.muted, marginTop: 4, marginBottom: 14 },
  monthList: { flexGrow: 0 },
  monthButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    marginBottom: 8,
  },
  monthText: { color: C.text, fontWeight: '700' },
  downloadIcon: { color: C.green, fontWeight: '900', fontSize: 18 },
  downloadButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenBg, borderRadius: 14 },
  emptyMonths: { color: C.muted, paddingVertical: 14 },
  cancel: { alignSelf: 'flex-end', marginTop: 8, padding: 10 },
  cancelText: { color: C.red, fontWeight: '800' },
});