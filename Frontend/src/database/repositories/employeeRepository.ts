import { db } from '../database';

export type Employee = {
  id: number;
  employee_id: string;
  name: string;
  email: string | null;
  department: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export async function createEmployee(
  employeeId: string,
  name: string,
  email?: string,
  department?: string,
) {
  const database = await db;
  const now = new Date().toISOString();

  return new Promise<void>((resolve, reject) => {
    database.transaction(tx => {
      tx.executeSql(
        `
          INSERT INTO employees (
            employee_id,
            name,
            email,
            department,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 1, ?, ?)
        `,
        [employeeId, name, email ?? null, department ?? null, now, now],
        () => resolve(),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  const database = await db;
  return new Promise<Employee | null>((resolve, reject) => {
    database.transaction(tx => {
      tx.executeSql(
        `
          SELECT *
          FROM employees
          WHERE employee_id = ?
          LIMIT 1
        `,
        [employeeId],
        (_, result) => {
          if (result.rows.length > 0) {
            resolve(result.rows.item(0) as Employee);
          } else {
            resolve(null);
          }
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}