const API_BASE_URL = __DEV__
  ? 'http://31.97.239.1:4343/api'
  : 'http://31.97.239.1:4343/api';

export type LoggedInEmployee = {
  employeeId: string;
  name: string;
  department: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
};

export async function loginEmployee(
  employeeId: string,
  password: string,
): Promise<LoggedInEmployee> {
  console.log('🔐 Attempting login with:', { employeeId, password });
  console.log('📡 API URL:', `${API_BASE_URL}/auth/login`);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          password,
        }),
      },
    );

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);
    
    const data = await response.json();
    console.log('📦 Response data:', data);

    if (!response.ok || !data.success) {
      console.error('❌ Login failed:', data.message || 'Login failed.');
      throw new Error(
        data.message || 'Login failed.',
      );
    }

    console.log('✅ Login successful, employee:', data.employee);
    return data.employee;
  } catch (error) {
    console.error('💥 Network or parsing error:', error);
    throw error;
  }
}