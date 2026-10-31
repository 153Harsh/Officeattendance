import { API_BASE_URL } from './apiClient';

export type Employee = {
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  createdAt?: string;
};

export type CreateEmployeeRequest = {
  employeeId: string;
  name: string;
  password: string;
  email: string;
  department: string;
};

export type UpdateEmployeeRequest = {
  name?: string;
  email?: string;
  department?: string;
  password?: string;
};

export type AttendanceHistory = {
  employeeId: string;
  name: string;
  department: string | null;
  date: string;
  status: 'PRESENT' | 'ABSENT';
  checkIn: string | null;
  checkOut: string | null;
};

export type AttendanceHistoryResponse = {
  success: boolean;
  attendance: AttendanceHistory[];
  hasMore: boolean;
};

export type AttendanceHistoryFilters = {
  employeeId?: string;
  department?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getAttendanceHistory(filters?: AttendanceHistoryFilters): Promise<AttendanceHistory[]> {
  const params = new URLSearchParams();
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  if (filters?.department) params.set('department', filters.department);
  if (filters?.date) params.set('date', filters.date);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);

  const query = params.toString();
  const url = `${API_BASE_URL}/admin/attendance/history${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch attendance history');
  }

  const data: AttendanceHistoryResponse = await response.json();
  return data.attendance;
}

export async function getAllEmployees(): Promise<Employee[]> {
  const response = await fetch(
    `${API_BASE_URL}/admin/employees`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.message || 'Failed to fetch employees',
    );
  }

  const data = await response.json();

  return data.employees;
}

export async function createEmployee(
  employee: CreateEmployeeRequest,
): Promise<Employee> {
  const response = await fetch(
    `${API_BASE_URL}/admin/employees`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employee),
    },
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      error.message || 'Failed to create employee',
    );
  }

  const data = await response.json();

  return data.employee;
}

export async function updateEmployee(
  employeeId: string,
  updates: UpdateEmployeeRequest,
): Promise<Employee> {
  const response = await fetch(
    `${API_BASE_URL}/admin/employees/${employeeId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    },
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      error.message || 'Failed to update employee',
    );
  }

  const data = await response.json();

  return data.employee;
}

export async function updateEmployeeStatus(
  employeeId: string,
  isActive: boolean,
): Promise<{
  employeeId: string;
  name: string;
  isActive: boolean;
}> {
  const response = await fetch(
    `${API_BASE_URL}/admin/employees/${employeeId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive }),
    },
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      error.message || 'Failed to update employee status',
    );
  }

  const data = await response.json();

  return data.employee;
}

export type TodayAttendanceRecord = {
  employeeId: string;
  name: string;
  department: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  checkIn: string | null;
  checkOut: string | null;
};

export type TodayAttendanceResponse = {
  success: boolean;
  date: string;
  summary: {
    totalEmployees: number;
    present: number;
    late: number;
    checkedIn: number;
    checkedOut: number;
    absent: number;
  };
  attendance: TodayAttendanceRecord[];
};

export async function getTodayAttendance(): Promise<TodayAttendanceResponse> {
  const response = await fetch(
    `${API_BASE_URL}/admin/attendance/today`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      error.message || "Failed to fetch today's attendance",
    );
  }

  const data: TodayAttendanceResponse =
    await response.json();

  return data;
}
