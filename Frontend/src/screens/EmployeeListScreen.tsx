import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Employee, getAllEmployees } from '../services/adminService';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, OfflineState, EmptyState } from '../components/StateViews';

const C = {
  background: '#E9DFC9',
  paper: '#fff7e8',
  field: '#F4EEE4',
  fieldBorder: '#E9DFD0',
  text: '#34271B',
  muted: '#7D7061',
  brown: '#55351D',
  brownDark: '#3D2515',
  green: '#167844',
  greenBg: '#BFECCB',
  red: '#C52820',
  redBg: '#FFD7D3',
  white: '#FFFFFF',
};

type Props = {
  isOnline: boolean;
  onBack: () => void;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  currentAdminEmployeeId: string;
};

type Filter = 'All' | 'Active' | 'Inactive';

export default function EmployeeListScreen({
  isOnline,
  onBack,
  onAddEmployee,
  onEditEmployee,
  currentAdminEmployeeId,
}: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const loadEmployees = async () => {
    if (!isOnline) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const data = await getAllEmployees();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [isOnline]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEmployees();
  };

  const active = employees.filter(employee => employee.isActive);
  const inactive = employees.filter(employee => !employee.isActive);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter(employee => {
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Active' && employee.isActive) ||
        (filter === 'Inactive' && !employee.isActive);
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query) ||
        (employee.department ?? '').toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [employees, filter, search]);

  const header = (
    <View>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Open menu">
          <Text style={styles.menuIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employees</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.searchIconButton} onPress={() => {}} accessibilityLabel="Search employees">
            <Text style={styles.searchIcon}>⌕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={onAddEmployee} accessibilityRole="button" accessibilityLabel="Add employee">
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, ID or department"
          placeholderTextColor={C.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search by name, ID or department"
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Text style={styles.clearSearch}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {([
          { key: 'All', count: employees.length },
          { key: 'Active', count: active.length },
          { key: 'Inactive', count: inactive.length },
        ] as { key: Filter; count: number }[]).map(item => {
          const selected = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {item.key} ({item.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconButton} onPress={onBack} accessibilityLabel="Go back">
            <Text style={styles.menuIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employees</Text>
          <View style={styles.headerSpacer} />
        </View>
        <OfflineState onBack={onBack} />
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <LoadingState message="Loading employees..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <ErrorState
          message={error}
          onRetry={() => { setLoading(true); loadEmployees(); }}
          onBack={onBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredEmployees}
        keyExtractor={item => item.employeeId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.brown}
            colors={[C.brown]}
          />
        }
        ListEmptyComponent={
          employees.length === 0 ? (
            <EmptyState
              title="No employees yet"
              subtitle="Create your first employee account to get started."
              action={{ label: 'Add Employee', onPress: onAddEmployee }}
            />
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsTitle}>No matching employees</Text>
              <Text style={styles.noResultsText}>Try another name, ID, department or filter.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <EmployeeCard
            employee={item}
            isCurrentAdmin={item.employeeId === currentAdminEmployeeId}
            onEdit={() => onEditEmployee(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function EmployeeCard({
  employee,
  isCurrentAdmin,
  onEdit,
}: {
  employee: Employee;
  isCurrentAdmin: boolean;
  onEdit: () => void;
}) {
  const isActive = employee.isActive;

  return (
    <TouchableOpacity
      style={cardStyles.card}
      onPress={onEdit}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`View or edit ${employee.name}`}
    >
      <View style={cardStyles.avatarWrap}>
  <Image
    source={
      employee.name.toLowerCase().includes('girl') ||
      employee.name.toLowerCase().includes('sneha') ||
      employee.name.toLowerCase().includes('neha')
        ? require('../assets/girl.png')
        : require('../assets/boy.png')
    }
    style={cardStyles.avatarImage}
    resizeMode="cover"
  />
</View>

      <View style={cardStyles.info}>
        <Text style={cardStyles.id}>{employee.employeeId}</Text>
        <View style={cardStyles.nameLine}>
          <Text style={cardStyles.name} numberOfLines={1}>{employee.name}</Text>
          {isCurrentAdmin && <Text style={cardStyles.youTag}>You</Text>}
        </View>
        <Text style={cardStyles.department} numberOfLines={1}>
          {employee.department ?? 'No department'}
        </Text>
      </View>

      <View style={[cardStyles.status, isActive ? cardStyles.activeStatus : cardStyles.inactiveStatus]}>
        <Text style={[cardStyles.statusText, isActive ? cardStyles.activeText : cardStyles.inactiveText]}>
          {isActive ? 'Active' : 'Inactive'}
        </Text>
      </View>
      <Text style={cardStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 28,
  },
  header: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 5,
  },
  headerIconButton: {
    width: 32,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuIcon: {
    color: C.brown,
    fontSize: 23,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#211A14',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerActions: {
    width: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  searchIconButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 27,
    color: C.brown,
    lineHeight: 30,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: C.white,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '400',
    marginTop: -1,
  },
  headerSpacer: {
    width: 32,
  },
  searchBox: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2EBE0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    paddingHorizontal: 11,
    marginBottom: 10,
  },
  searchGlyph: {
    color: C.muted,
    fontSize: 21,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 7,
    color: C.text,
    fontSize: 11,
  },
  clearSearch: {
    color: C.muted,
    fontSize: 20,
    paddingLeft: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
  },
  filterChip: {
    flex: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#F0E7DA',
    borderWidth: 1,
    borderColor: '#EDE1D0',
  },
  filterChipSelected: {
    backgroundColor: C.brown,
    borderColor: C.brown,
  },
  filterText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: C.white,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  noResultsTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  noResultsText: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paper,
    borderRadius: 15,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F0E8DC',
  },
  avatarWrap: {
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: '#E9DFD1',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 8,
  overflow: 'hidden',
},

avatarImage: {
  width: '100%',
  height: '100%',
  borderRadius: 21,
},
  info: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  id: {
    color: C.muted,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: C.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  youTag: {
    color: C.brown,
    fontSize: 8,
    fontWeight: '800',
  },
  department: {
    color: '#66594A',
    fontSize: 9,
    lineHeight: 12,
  },
  status: {
    minWidth: 43,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  activeStatus: {
    backgroundColor: C.greenBg,
  },
  inactiveStatus: {
    backgroundColor: C.redBg,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  activeText: {
    color: C.green,
  },
  inactiveText: {
    color: C.red,
  },
  chevron: {
    fontSize: 25,
    lineHeight: 28,
    color: '#6E5A45',
    marginLeft: 7,
    marginTop: -2,
  },
});
