import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAttendanceHistory,
  getAllEmployees,
  AttendanceHistory,
  AttendanceHistoryFilters,
  Employee,
} from '../services/adminService';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, OfflineState, EmptyState, AlertBanner } from '../components/StateViews';
import { Colors, Typography, Spacing, Radii, Shadows, Sizes } from '../theme';

type Props = {
  onBack: () => void;
  isOnline: boolean;
};

type DateMode = 'none' | 'specific' | 'range';

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateString));
}

function isValidDate(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(new Date(val).getTime());
}

export default function AttendanceHistoryScreen({ onBack, isOnline }: Props) {
  const [records, setRecords] = useState<AttendanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const [activeFilters, setActiveFilters] = useState<AttendanceHistoryFilters>({});
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pending filter state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('none');
  const [specificDate, setSpecificDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const fetchHistory = useCallback(async (filters: AttendanceHistoryFilters) => {
    setError(null);
    try {
      const data = await getAttendanceHistory(filters);
      setRecords(data);
    } catch {
      setError('Unable to load attendance history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data);
      const depts = Array.from(
        new Set(data.map(e => e.department).filter((d): d is string => !!d)),
      ).sort();
      setDepartments(depts);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    setLoading(true);
    fetchHistory({});
    loadEmployees();
  }, [isOnline]);

  const handleRefresh = useCallback(() => {
    if (!isOnline) return;
    setRefreshing(true);
    fetchHistory(activeFilters);
  }, [activeFilters, isOnline, fetchHistory]);

  const handleApplyFilters = () => {
    setFilterError(null);
    const filters: AttendanceHistoryFilters = {};
    if (selectedEmployeeId) filters.employeeId = selectedEmployeeId;
    if (selectedDepartment) filters.department = selectedDepartment;

    if (dateMode === 'specific') {
      if (!specificDate) { setFilterError('Please enter a date (YYYY-MM-DD).'); return; }
      if (!isValidDate(specificDate)) { setFilterError('Invalid date. Use YYYY-MM-DD.'); return; }
      filters.date = specificDate;
    } else if (dateMode === 'range') {
      if (!fromDate && !toDate) { setFilterError('Enter at least one date for the range.'); return; }
      if (fromDate && !isValidDate(fromDate)) { setFilterError('Invalid From Date. Use YYYY-MM-DD.'); return; }
      if (toDate && !isValidDate(toDate)) { setFilterError('Invalid To Date. Use YYYY-MM-DD.'); return; }
      if (fromDate && toDate && fromDate > toDate) { setFilterError('From date cannot be after To date.'); return; }
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
    }

    setActiveFilters(filters);
    setFiltersApplied(Object.keys(filters).length > 0);
    setLoading(true);
    setShowFilters(false);
    setShowEmpPicker(false);
    setShowDeptPicker(false);
    fetchHistory(filters);
  };

  const handleClearFilters = () => {
    setSelectedEmployeeId('');
    setSelectedDepartment('');
    setDateMode('none');
    setSpecificDate('');
    setFromDate('');
    setToDate('');
    setFilterError(null);
    setActiveFilters({});
    setFiltersApplied(false);
    setShowEmpPicker(false);
    setShowDeptPicker(false);
    setLoading(true);
    fetchHistory({});
  };

  const selectedEmployee = employees.find(e => e.employeeId === selectedEmployeeId);

  const filterBtn = (
    <TouchableOpacity
      style={[styles.filterToggleBtn, filtersApplied && styles.filterToggleBtnActive]}
      onPress={() => setShowFilters(v => !v)}
      accessibilityLabel="Toggle filters"
    >
      <Text style={[styles.filterToggleBtnText, filtersApplied && styles.filterToggleBtnTextActive]}>
        {filtersApplied ? '⚙ Filtered' : '⚙ Filter'}
      </Text>
    </TouchableOpacity>
  );

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Attendance History" onBack={onBack} />
        <OfflineState onBack={onBack} />
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Attendance History" onBack={onBack} />
        <LoadingState message="Loading history..." />
      </SafeAreaView>
    );
  }

  if (error && records.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Attendance History" onBack={onBack} />
        <ErrorState
          message={error}
          onRetry={() => { setLoading(true); fetchHistory(activeFilters); }}
          onBack={onBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Attendance History" onBack={onBack} rightElement={filterBtn} />

      <FlatList
        data={records}
        keyExtractor={(item, i) => `${item.employeeId}-${item.date}-${i}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <>
            {/* Filter panel */}
            {showFilters && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterPanelTitle}>Filter Records</Text>

                {filterError ? <AlertBanner type="error" message={filterError} /> : null}

                {/* Employee picker */}
                <Text style={styles.filterLabel}>Employee</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => { setShowEmpPicker(v => !v); setShowDeptPicker(false); }}
                >
                  <Text style={selectedEmployeeId ? styles.pickerBtnTextSelected : styles.pickerBtnTextPlaceholder} numberOfLines={1}>
                    {selectedEmployee
                      ? `${selectedEmployee.name} (${selectedEmployee.employeeId})`
                      : 'Any employee'}
                  </Text>
                  <Text style={styles.chevron}>{showEmpPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showEmpPicker && (
                  <ScrollView style={styles.dropdown} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSelectedEmployeeId(''); setShowEmpPicker(false); }}>
                      <Text style={styles.dropdownClear}>— Any employee —</Text>
                    </TouchableOpacity>
                    {employees.map(emp => (
                      <TouchableOpacity
                        key={emp.employeeId}
                        style={[styles.dropdownItem, selectedEmployeeId === emp.employeeId && styles.dropdownItemActive]}
                        onPress={() => { setSelectedEmployeeId(emp.employeeId); setShowEmpPicker(false); }}
                      >
                        <Text style={[styles.dropdownItemText, selectedEmployeeId === emp.employeeId && styles.dropdownItemTextActive]}>
                          {emp.name}
                        </Text>
                        <Text style={styles.dropdownItemSub}>{emp.employeeId} · {emp.department ?? 'N/A'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Department picker */}
                <Text style={styles.filterLabel}>Department</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => { setShowDeptPicker(v => !v); setShowEmpPicker(false); }}
                >
                  <Text style={selectedDepartment ? styles.pickerBtnTextSelected : styles.pickerBtnTextPlaceholder}>
                    {selectedDepartment || 'Any department'}
                  </Text>
                  <Text style={styles.chevron}>{showDeptPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showDeptPicker && (
                  <ScrollView style={styles.dropdown} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSelectedDepartment(''); setShowDeptPicker(false); }}>
                      <Text style={styles.dropdownClear}>— Any department —</Text>
                    </TouchableOpacity>
                    {departments.map(dept => (
                      <TouchableOpacity
                        key={dept}
                        style={[styles.dropdownItem, selectedDepartment === dept && styles.dropdownItemActive]}
                        onPress={() => { setSelectedDepartment(dept); setShowDeptPicker(false); }}
                      >
                        <Text style={[styles.dropdownItemText, selectedDepartment === dept && styles.dropdownItemTextActive]}>
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Date mode */}
                <Text style={styles.filterLabel}>Date</Text>
                <View style={styles.dateModeRow}>
                  {(['none', 'specific', 'range'] as DateMode[]).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.dateModeBtn, dateMode === mode && styles.dateModeBtnActive]}
                      onPress={() => setDateMode(mode)}
                    >
                      <Text style={[styles.dateModeBtnText, dateMode === mode && styles.dateModeBtnTextActive]}>
                        {mode === 'none' ? 'Any' : mode === 'specific' ? 'Specific' : 'Range'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {dateMode === 'specific' && (
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textDisabled}
                    value={specificDate}
                    onChangeText={setSpecificDate}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                )}
                {dateMode === 'range' && (
                  <View style={styles.dateRangeRow}>
                    <TextInput
                      style={[styles.dateInput, styles.dateRangeInput]}
                      placeholder="From: YYYY-MM-DD"
                      placeholderTextColor={Colors.textDisabled}
                      value={fromDate}
                      onChangeText={setFromDate}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <TextInput
                      style={[styles.dateInput, styles.dateRangeInput]}
                      placeholder="To: YYYY-MM-DD"
                      placeholderTextColor={Colors.textDisabled}
                      value={toDate}
                      onChangeText={setToDate}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                )}

                <View style={styles.filterActions}>
                  <TouchableOpacity
                    style={[styles.applyBtn, loading && styles.applyBtnDisabled]}
                    onPress={handleApplyFilters}
                    disabled={loading}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
                    <Text style={styles.clearBtnText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Active filter summary */}
            {filtersApplied && !showFilters && (
              <View style={styles.filterSummary}>
                <Text style={styles.filterSummaryText}>
                  Filters active
                  {activeFilters.employeeId ? ` · ${employees.find(e => e.employeeId === activeFilters.employeeId)?.name ?? activeFilters.employeeId}` : ''}
                  {activeFilters.department ? ` · ${activeFilters.department}` : ''}
                  {activeFilters.date ? ` · ${activeFilters.date}` : ''}
                  {activeFilters.fromDate ? ` · From ${activeFilters.fromDate}` : ''}
                  {activeFilters.toDate ? ` · To ${activeFilters.toDate}` : ''}
                </Text>
                <TouchableOpacity onPress={handleClearFilters}>
                  <Text style={styles.filterSummaryClear}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {records.length === 0 && !loading && (
              <EmptyState
                title={filtersApplied ? 'No matching records' : 'No attendance history'}
                subtitle={filtersApplied ? 'Try adjusting or clearing your filters.' : undefined}
                action={filtersApplied ? { label: 'Clear Filters', onPress: handleClearFilters } : undefined}
              />
            )}
          </>
        }
        renderItem={({ item }) => <HistoryCard record={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function HistoryCard({ record }: { record: AttendanceHistory }) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.top}>
        <Avatar name={record.name} size="md" />
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{record.name}</Text>
          <Text style={cardStyles.meta}>
            {record.employeeId}
            {record.department ? ` · ${record.department}` : ''}
          </Text>
        </View>
        <StatusBadge status={record.status as any} size="sm" />
      </View>
      <View style={cardStyles.bottom}>
        <Text style={cardStyles.date}>{formatDate(record.date)}</Text>
        <View style={cardStyles.times}>
          <View style={cardStyles.timeItem}>
            <Text style={cardStyles.timeLabel}>In</Text>
            <Text style={cardStyles.timeValue}>{formatTime(record.checkIn)}</Text>
          </View>
          <View style={cardStyles.timeSep} />
          <View style={cardStyles.timeItem}>
            <Text style={cardStyles.timeLabel}>Out</Text>
            <Text style={cardStyles.timeValue}>{formatTime(record.checkOut)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  listContent: {
    padding: Spacing['4'],
    paddingBottom: Spacing['10'],
  },
  filterToggleBtn: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['1.5'],
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
    borderBottomWidth: 2,
    borderBottomColor: '#D8C9AD',
  },
  filterToggleBtnActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  filterToggleBtnText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  filterToggleBtnTextActive: {
    color: Colors.accent,
  },

  // Filter panel
  filterPanel: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.lg,
    padding: Spacing['4'],
    marginBottom: Spacing['3'],
    ...Shadows.sm,
  },
  filterPanelTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing['4'],
  },
  filterLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing['2'],
    marginTop: Spacing['3'],
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Sizes.inputHeight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    backgroundColor: Colors.bgSurfaceRaised,
  },
  pickerBtnTextPlaceholder: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textDisabled,
  },
  pickerBtnTextSelected: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  chevron: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: Spacing['2'],
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.bgSurface,
    marginTop: Spacing['1'],
    maxHeight: 200,
    ...Shadows.sm,
  },
  dropdownItem: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dropdownItemActive: {
    backgroundColor: Colors.accentLight,
  },
  dropdownItemText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  dropdownItemTextActive: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  dropdownItemSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dropdownClear: {
    fontSize: Typography.base,
    color: Colors.textDisabled,
    fontStyle: 'italic',
  },
  dateModeRow: {
    flexDirection: 'row',
    gap: Spacing['2'],
  },
  dateModeBtn: {
    flex: 1,
    paddingVertical: Spacing['2'],
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgSurfaceRaised,
  },
  dateModeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dateModeBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  dateModeBtnTextActive: {
    color: Colors.textInverse,
  },
  dateInput: {
    height: Sizes.inputHeight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    fontSize: Typography.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSurfaceRaised,
    borderTopColor: '#B6A17E',
    borderBottomColor: '#FFF9ED',
    marginTop: Spacing['2'],
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: Spacing['2'],
    marginTop: Spacing['2'],
  },
  dateRangeInput: {
    flex: 1,
    marginTop: 0,
  },
  filterActions: {
    flexDirection: 'row',
    gap: Spacing['2'],
    marginTop: Spacing['4'],
  },
  applyBtn: {
    flex: 1,
    height: Sizes.buttonHeightSm,
    backgroundColor: Colors.accent,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#77957A',
    borderBottomWidth: 2,
    borderBottomColor: Colors.accentPressed,
  },
  applyBtnDisabled: {
    backgroundColor: Colors.textDisabled,
  },
  applyBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  clearBtn: {
    flex: 1,
    height: Sizes.buttonHeightSm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSurface,
  },
  clearBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },

  // Filter summary bar
  filterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    marginBottom: Spacing['3'],
  },
  filterSummaryText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.accent,
    fontWeight: Typography.medium,
  },
  filterSummaryClear: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.accent,
    marginLeft: Spacing['3'],
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: '#D8C9AD',
    padding: Spacing['4'],
    marginBottom: Spacing['3'],
    ...Shadows.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
    marginBottom: Spacing['3'],
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgPrimary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
  },
  date: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  times: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  timeValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  timeSep: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
});
