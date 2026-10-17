import { MongoClient } from 'mongodb';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { randomUUID } from 'crypto';

dotenv.config();
const firebaseApp = initializeApp({
  credential: applicationDefault(),
});

const firebaseMessaging = getMessaging(firebaseApp);

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not configured.');
}

const mongoClient = new MongoClient(MONGODB_URI);

app.use(cors());
app.use(express.json());

const db = () => mongoClient.db('Attendance');

const NOTIFICATION_MAX_ATTEMPTS = 8;
const NOTIFICATION_RETRY_INTERVAL_MS = 5000;

let notificationWorkerRunning = false;

async function processNotificationQueue(): Promise<void> {
  if (notificationWorkerRunning) return;
  notificationWorkerRunning = true;

  try {
    const jobs = db().collection('notification_jobs');
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      const job = await jobs.findOneAndUpdate(
        {
          status: 'PENDING',
          nextAttemptAt: { $lte: now },
        },
        {
          $set: {
            status: 'PROCESSING',
            lockedAt: now,
          },
        },
        {
          sort: { nextAttemptAt: 1 },
          returnDocument: 'after',
        },
      );

      if (!job) break;

      try {
        let tokens: string[];

        // Retry only tokens that failed on the previous attempt.
        if (
          Array.isArray(job.pendingTokens) &&
          job.pendingTokens.length > 0
        ) {
          tokens = [
            ...new Set(
              job.pendingTokens.filter(
                (token: unknown): token is string =>
                  typeof token === 'string' && token.length > 0,
              ),
            ),
          ];
        } else {
          const admins = await db()
            .collection('employees')
            .find(
              {
                role: 'ADMIN',
                isActive: true,
                fcmTokens: { $exists: true, $ne: [] },
              },
              { projection: { fcmTokens: 1 } },
            )
            .toArray();

          tokens = [
            ...new Set(
              admins.flatMap((admin) =>
                Array.isArray(admin.fcmTokens)
                  ? admin.fcmTokens.filter(
                      (token): token is string =>
                        typeof token === 'string' && token.length > 0,
                    )
                  : [],
              ),
            ),
          ];
        }

        if (tokens.length === 0) {
          throw new Error('No Admin notification tokens remain to send to.');
        }

        const result = await firebaseMessaging.sendEachForMulticast({
          tokens,
          notification: {
            title:
              job.eventType === 'CHECK_IN'
                ? 'Employee Check-In'
                : 'Employee Check-Out',
            body: job.message,
          },
          data: {
            type: job.eventType,
            employeeId: job.employeeId,
            eventId: job.eventId,
            date: job.date,
          },
          android: { priority: 'high' },
        });

        const failedTokens: string[] = [];
        const invalidTokens: string[] = [];

        result.responses.forEach((response, index) => {
          if (response.success) return;

          const token = tokens[index];
          const code = response.error?.code;

          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(token);
          } else {
            failedTokens.push(token);
          }
        });

        // Remove invalid tokens from employee records.
        if (invalidTokens.length > 0) {
          await db().collection('employees').updateMany(
            { fcmTokens: { $in: invalidTokens } },
            {
              $pull: {
                fcmTokens: { $in: invalidTokens },
              } as any,
            },
          );
        }

        const attempts = (job.attempts ?? 0) + 1;

        if (failedTokens.length > 0) {
          const permanentlyFailed =
            attempts >= NOTIFICATION_MAX_ATTEMPTS;

          const delayMs =
            NOTIFICATION_RETRY_INTERVAL_MS *
            Math.pow(2, Math.min(attempts - 1, 6));

          await jobs.updateOne(
            { _id: job._id, status: 'PROCESSING' },
            {
              $set: {
                status: permanentlyFailed ? 'FAILED' : 'PENDING',
                pendingTokens: failedTokens,
                attempts,
                lastError: `${failedTokens.length} notification token(s) failed.`,
                nextAttemptAt: new Date(Date.now() + delayMs),
                successCount:
                  (job.successCount ?? 0) + result.successCount,
                failureCount: failedTokens.length,
              },
              $unset: { lockedAt: '' },
            },
          );

          console.error(
            `Notification retry scheduled for ${job.eventId}:`,
            failedTokens.length,
            'token(s) remain.',
          );

          continue;
        }

        // Every remaining token succeeded or was permanently invalid.
        await jobs.updateOne(
          { _id: job._id, status: 'PROCESSING' },
          {
            $set: {
              status: 'SENT',
              sentAt: new Date(),
              successCount:
                (job.successCount ?? 0) + result.successCount,
              failureCount: 0,
              pendingTokens: [],
            },
            $unset: {
              lockedAt: '',
              lastError: '',
            },
          },
        );

        console.log(
          `Attendance FCM: ${result.successCount} sent, ` +
            `${result.failureCount} failed in this attempt.`,
        );
      } catch (error) {
        const attempts = (job.attempts ?? 0) + 1;
        const permanentlyFailed =
          attempts >= NOTIFICATION_MAX_ATTEMPTS;

        const delayMs =
          NOTIFICATION_RETRY_INTERVAL_MS *
          Math.pow(2, Math.min(attempts - 1, 6));

        await jobs.updateOne(
          { _id: job._id, status: 'PROCESSING' },
          {
            $set: {
              status: permanentlyFailed ? 'FAILED' : 'PENDING',
              attempts,
              lastError:
                error instanceof Error ? error.message : String(error),
              nextAttemptAt: new Date(Date.now() + delayMs),
            },
            $unset: { lockedAt: '' },
          },
        );

        console.error('Notification job failed:', job.eventId, error);
      }
    }
  } catch (error) {
    console.error('Notification queue worker failed:', error);
  } finally {
    notificationWorkerRunning = false;
  }
}


type SyncEventRequest = {
  eventId: string;
  employeeId: string;
  eventType: string;
  payload: Record<string, any>;
  createdAt: string;
};

// Office start: 10:30 IST, grace period: 15 min → cutoff 10:45 IST
function classifyAttendanceStatus(checkIn: string | undefined | null): 'PRESENT' | 'LATE' | 'ABSENT' {
  if (!checkIn) return 'ABSENT';

  // Parse the ISO timestamp and extract IST hour/minute
  const date = new Date(checkIn);
  // toLocaleString gives us the wall-clock time in IST
  const istParts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(istParts.find(p => p.type === 'hour')!.value, 10);
  const minute = parseInt(istParts.find(p => p.type === 'minute')!.value, 10);
  const totalMinutes = hour * 60 + minute;

  // 10:45 IST = 645 minutes from midnight
  return totalMinutes <= 645 ? 'PRESENT' : 'LATE';
}

interface AttendanceDocument {
  _id: string; // Explicitly define _id as string
  employeeId: string;
  date: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  createdAt: string;
  checkIn?: string;
  checkInLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  checkOut?: string;
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  updatedAt?: string;
}

type AttendanceReportRow = {
  employeeId: string;
  name: string;
  department: string | null;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
};

function pdfText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .slice(0, maxLength)
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[()\\]/g, '\\$&');
}

function buildAttendanceReportPdf(rows: AttendanceReportRow[], month: string): Buffer {
  const pageSize = 22;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const objects: string[] = [];
  const pageIds = Array.from({ length: pageCount }, (_, index) => 5 + index * 2);

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  const columns = [
    { label: 'Employee ID', x: 30, max: 13 },
    { label: 'Employee', x: 126, max: 19 },
    { label: 'Department', x: 276, max: 16 },
    { label: 'Date', x: 402, max: 10 },
    { label: 'Status', x: 493, max: 10 },
    { label: 'Check In', x: 588, max: 12 },
    { label: 'Check Out', x: 710, max: 12 },
  ];

  for (let page = 0; page < pageCount; page++) {
    const pageId = pageIds[page];
    const contentId = pageId + 1;
    const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
    const ops: string[] = [
      'q 0.976 0.953 0.902 rg 0 0 842 595 re f Q',
      'q 0.192 0.361 0.263 rg 24 548 794 34 re f Q',
      '1 1 1 rg',
      `BT /F2 15 Tf 36 566 Td (Monthly Attendance Report - ${pdfText(month, 7)}) Tj ET`,
      `BT /F1 8 Tf 36 554 Td (${pdfText(`${rows.length} attendance records`, 50)}) Tj ET`,
      'q 0.84 0.78 0.65 rg 24 518 794 22 re f Q',
      '0.25 0.20 0.15 rg',
    ];

    for (const column of columns) {
      ops.push(`BT /F2 8 Tf ${column.x} 526 Td (${pdfText(column.label, column.max)}) Tj ET`);
    }

    pageRows.forEach((row, index) => {
      const y = 500 - index * 21;
      if (index % 2 === 0) ops.push(`q 1 0.976 0.929 rg 24 ${y - 7} 794 20 re f Q`);
      const values = [
        row.employeeId,
        row.name,
        row.department || '-',
        row.date,
        row.status,
        reportTime(row.checkIn),
        reportTime(row.checkOut),
      ];
      columns.forEach((column, colIndex) => {
        ops.push(`BT /F1 8 Tf ${column.x} ${y} Td (${pdfText(values[colIndex], column.max)}) Tj ET`);
      });
    });

    ops.push(`BT /F1 8 Tf 36 24 Td (Page ${page + 1} of ${pageCount}) Tj ET`);
    const stream = ops.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

function reportTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

app.get('/api/health', async (_req, res) => {
  try {
    await db().command({ ping: 1 });

    res.json({
      success: true,
      message: 'Office Attendance API is running',
      database: 'connected',
    });
  } catch (error) {
    console.error('MongoDB health check failed:', error);

    res.status(500).json({
      success: false,
      message: 'API is running but MongoDB is not connected.',
    });
  }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and password are required.',
      });
    }

    const employeesCollection = db().collection('employees');

    const employee = await employeesCollection.findOne({
      employeeId,
      password,
      isActive: true,
    });

    // Check if employee exists but is inactive
    const anyEmployee = await employeesCollection.findOne({ employeeId, password });
    if (anyEmployee && !anyEmployee.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Please contact your administrator.',
      });
    }
    
    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid employee ID or password.',
      });
    }

    return res.json({
      success: true,
      message: 'Login successful.',
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department ?? null,
        role: employee.role ?? 'EMPLOYEE',
      },
    });
  } catch (error) {
    console.error('Login failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed.',
    });
  }
});

app.post('/api/admin/fcm-token', async (req, res) => {
  try {
    const { employeeId, password, fcmToken } = req.body;

    if (
      typeof employeeId !== 'string' ||
      typeof password !== 'string' ||
      typeof fcmToken !== 'string' ||
      !employeeId.trim() ||
      !password ||
      !fcmToken.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, password, and FCM token are required.',
      });
    }

    const employees = db().collection('employees');

    // Verify that the employee is an active Admin.
    const admin = await employees.findOne({
      employeeId: employeeId.trim(),
      password,
      isActive: true,
      role: 'ADMIN',
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin authentication failed.',
      });
    }

    // Save the token without creating duplicate entries.
    await employees.updateOne(
      { _id: admin._id },
      { $addToSet: { fcmTokens: fcmToken.trim() } },
    );

    return res.json({
      success: true,
      message: 'Admin device registered for notifications.',
    });
  } catch (error) {
    console.error('FCM token registration failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to register notification device.',
    });
  }
});

app.post('/api/admin/test-notification', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (
      typeof employeeId !== 'string' ||
      typeof password !== 'string' ||
      !employeeId.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and password are required.',
      });
    }

    const admin = await db().collection('employees').findOne({
      employeeId: employeeId.trim(),
      password,
      role: 'ADMIN',
      isActive: true,
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin authentication failed.',
      });
    }

    const tokens = Array.isArray(admin.fcmTokens)
      ? admin.fcmTokens.filter(
          (token): token is string =>
            typeof token === 'string' && token.length > 0,
        )
      : [];

    if (tokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registered FCM devices found for this Admin.',
      });
    }

    const result = await firebaseMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Office Attendance Test',
        body: 'Your phone is successfully connected to attendance notifications.',
      },
      data: {
        type: 'FCM_TEST',
      },
      android: {
        priority: 'high',
      },
    });

    return res.json({
      success: true,
      message: 'Test notification request processed.',
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    console.error('Test notification failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification.',
    });
  }
});

app.post('/api/attendance/sync', async (req, res) => {
  try {
    const {
      eventId,
      employeeId,
      eventType,
      payload,
      createdAt,
    } = req.body as SyncEventRequest;

    if (
      !eventId ||
      !employeeId ||
      !eventType ||
      !payload ||
      !createdAt
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required sync event fields.',
      });
    }

    const eventsCollection = db().collection('attendance_events');
    const attendanceCollection = db().collection<AttendanceDocument>('attendance');

    // Check whether this event was already processed.
    const existingEvent = await eventsCollection.findOne({
      eventId,
    });

    if (existingEvent) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Event was already processed.',
      });
    }

    const date = payload.date;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Attendance event is missing date.',
      });
    }

    const attendanceId = `${employeeId}_${date}`;

    // CHECK-IN
    if (eventType === 'CHECK_IN') {
      const status = classifyAttendanceStatus(payload.checkIn);
      await attendanceCollection.updateOne(
        {
          _id: attendanceId,
        },
        {
          $setOnInsert: {
            employeeId,
            date,
            createdAt,
          },
          $set: {
            status,
            checkIn: payload.checkIn,
            checkInLocation: {
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
            },
            updatedAt: new Date().toISOString(),
          },
        },
        {
          upsert: true,
        },
      );
    }

    // CHECK-OUT
    else if (eventType === 'CHECK_OUT') {
      await attendanceCollection.updateOne(
        {
          _id: attendanceId,
        },
        {
          $set: {
            checkOut: payload.checkOut,
            checkOutLocation: {
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
            },
            updatedAt: new Date().toISOString(),
          },
        },
        {
          upsert: true,
        },
      );
    }

    else {
      return res.status(400).json({
        success: false,
        message: `Unsupported event type: ${eventType}`,
      });
    }

    // Store the original sync event after attendance was updated.
    try {
      await eventsCollection.insertOne({
        eventId,
        employeeId,
        eventType,
        payload,
        createdAt,
        receivedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      // Another request may have inserted the same event simultaneously.
      if (error?.code === 11000) {
        return res.json({
          success: true,
          alreadyProcessed: true,
          message: 'Event was already processed.',
        });
      }

      throw error;
    }

    // Queue a notification for durable delivery.
try {
  const employee = await db().collection('employees').findOne(
    { employeeId },
    { projection: { name: 1 } },
  );

  const employeeName =
    typeof employee?.name === 'string'
      ? employee.name
      : employeeId;

  const isCheckIn = eventType === 'CHECK_IN';
  // Format the time in IST
  const eventTime = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date(createdAt));

  await db().collection('notification_jobs').updateOne(
    { eventId },
    {
      $setOnInsert: {
        _id: randomUUID(),
        eventId,
        employeeId,
        eventType,
        date: String(date),
        message: isCheckIn
          ? `${employeeName} checked in at ${eventTime}.`
          : `${employeeName} checked out at ${eventTime}.`,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
        nextAttemptAt: new Date(),
      },
    },
    { upsert: true },
  );

  console.log(`Attendance notification queued: ${eventId}`);
} catch (notificationError) {
  // Do not fail attendance sync if queue insertion fails.
  console.error(
    'Failed to queue attendance notification:',
    notificationError,
  );
}

    return res.status(201).json({
      success: true,
      alreadyProcessed: false,
      message: 'Attendance event synced successfully.',
    });
  } catch (error) {
    console.error('Attendance sync failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to sync attendance event.',
    });
  }
});

// ADMIN: Get all employees
app.get('/api/admin/employees', async (req, res) => {
  try {
    const employeesCollection = db().collection('employees');
    
    const employees = await employeesCollection.find({}).toArray();
    
    // Remove password from response and filter admin visibility
    const safeEmployees = employees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || '',
      department: emp.department,
      role: emp.role,
      isActive: emp.isActive,
      createdAt: emp.createdAt ?? null,
    }));

    return res.json({
      success: true,
      employees: safeEmployees,
    });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch employees.',
    });
  }
});

// ADMIN: Add new employee
app.post('/api/admin/employees', async (req, res) => {
  try {
    const { employeeId, name, password, email, department } = req.body;

    // Validate required fields
    if (!employeeId || !name || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, name, password, and department are required.',
      });
    }

    const employeesCollection = db().collection('employees');
    
    // Check if employee ID already exists
    const existingEmployee = await employeesCollection.findOne({ employeeId });
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID already exists.',
      });
    }

    // Create new employee with role: EMPLOYEE and isActive: true
    const newEmployee = {
      employeeId,
      name,
      password,
      email: email || '',
      department,
      role: 'EMPLOYEE',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await employeesCollection.insertOne(newEmployee);

    // Return safe version without password
    return res.json({
      success: true,
      message: 'Employee created successfully.',
      employee: {
        employeeId: newEmployee.employeeId,
        name: newEmployee.name,
        email: newEmployee.email,
        department: newEmployee.department,
        role: newEmployee.role,
        isActive: newEmployee.isActive,
      },
    });
  } catch (error) {
    console.error('Failed to create employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create employee.',
    });
  }
});

// ADMIN: Update employee
app.put('/api/admin/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, email, department, password } = req.body;

    const employeesCollection = db().collection('employees');
    
    // Find existing employee
    const existingEmployee = await employeesCollection.findOne({ employeeId });
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    // Build update object - only update provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (department) updateData.department = department;
    if (password) updateData.password = password;
    // Never update role or employeeId - ensure we can't promote to ADMIN

    await employeesCollection.updateOne(
      { employeeId },
      { $set: updateData }
    );

    // Return updated employee without password
    const updatedEmployee = await employeesCollection.findOne({ employeeId });

if (!updatedEmployee) {
  return res.status(500).json({
    success: false,
    message: 'Failed to retrieve updated employee.',
  });
}

return res.json({
  success: true,
  message: 'Employee updated successfully.',
  employee: {
    employeeId: updatedEmployee.employeeId,
    name: updatedEmployee.name,
    email: updatedEmployee.email || '',
    department: updatedEmployee.department,
    role: updatedEmployee.role,
    isActive: updatedEmployee.isActive,
  },
});
  } catch (error) {
    console.error('Failed to update employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee.',
    });
  }
})
// ADMIN: Get attendance history (with optional filters)
app.get('/api/admin/attendance/history', async (req, res) => {
  try {
    const attendanceCollection = db().collection<AttendanceDocument>('attendance');
    const employeesCollection = db().collection('employees');

    const { employeeId, department, date, fromDate, toDate } = req.query as Record<string, string | undefined>;

    const limit = 200;
    const pipeline: object[] = [];

    // If department filter is supplied, resolve matching employeeIds first
    let departmentEmployeeIds: string[] | null = null;
    if (department) {
      const deptEmployees = await employeesCollection
        .find({ department }, { projection: { employeeId: 1 } })
        .toArray();
      departmentEmployeeIds = deptEmployees.map(e => e.employeeId);
      // If no employees in that department, return empty immediately
      if (departmentEmployeeIds.length === 0) {
        return res.json({ success: true, attendance: [], hasMore: false });
      }
    }

    // Build $match conditions
    const match: Record<string, any> = {};

    if (employeeId) {
      match.employeeId = employeeId;
    }

    if (departmentEmployeeIds !== null) {
      // AND with employeeId filter if both supplied
      if (match.employeeId) {
        // Only keep the record if it satisfies both
        if (!departmentEmployeeIds.includes(match.employeeId)) {
          return res.json({ success: true, attendance: [], hasMore: false });
        }
      } else {
        match.employeeId = { $in: departmentEmployeeIds };
      }
    }

    if (date) {
      // Exact date match using the stored date string field
      match.date = date;
    } else if (fromDate || toDate) {
      const dateRange: Record<string, string> = {};
      if (fromDate) dateRange.$gte = fromDate;
      if (toDate) dateRange.$lte = toDate;
      match.date = dateRange;
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push(
      { $sort: { date: -1, employeeId: 1 } },
      { $limit: limit + 1 },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: 'employeeId',
          as: 'employeeInfo',
        },
      },
      {
        $unwind: {
          path: '$employeeInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          employeeId: '$employeeId',
          name: { $ifNull: ['$employeeInfo.name', 'Unknown Employee'] },
          department: { $ifNull: ['$employeeInfo.department', null] },
          date: '$date',
          status: '$status',
          checkIn: '$checkIn',
          checkOut: '$checkOut',
        },
      },
    );

    const attendanceRecords = await attendanceCollection.aggregate(pipeline).toArray();

    const hasMore = attendanceRecords.length > limit;
    const attendance = hasMore ? attendanceRecords.slice(0, limit) : attendanceRecords;

    return res.json({ success: true, attendance, hasMore });
  } catch (error) {
    console.error('Failed to fetch attendance history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance history.',
    });
  }
});

app.get('/api/admin/attendance/report', async (req, res) => {
  try {
    const month = String(req.query.month ?? '');
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId.trim() : '';
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Month must use YYYY-MM format.' });
    }

    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const fromDate = `${match[1]}-${match[2]}-01`;
    const toDate = `${match[1]}-${match[2]}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`;
    const attendance = await db()
      .collection<AttendanceDocument>('attendance')
      .aggregate<AttendanceReportRow>([
        { $match: { date: { $gte: fromDate, $lte: toDate }, ...(employeeId ? { employeeId } : {}) } },
        { $sort: { date: 1, employeeId: 1 } },
        {
          $lookup: {
            from: 'employees',
            localField: 'employeeId',
            foreignField: 'employeeId',
            as: 'employeeInfo',
          },
        },
        { $unwind: { path: '$employeeInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            employeeId: '$employeeId',
            name: { $ifNull: ['$employeeInfo.name', 'Unknown Employee'] },
            department: { $ifNull: ['$employeeInfo.department', null] },
            date: '$date',
            status: '$status',
            checkIn: { $ifNull: ['$checkIn', null] },
            checkOut: { $ifNull: ['$checkOut', null] },
          },
        },
      ])
      .toArray();

    const pdf = buildAttendanceReportPdf(attendance, month);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.send(pdf);
  } catch (error) {
    console.error('Failed to generate attendance report:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate attendance report.' });
  }
});
// ADMIN APIs: Employee Management
// Get all employees (excludes passwords)
app.get('/api/admin/employees', async (req, res) => {
  try {
    const employeesCollection = db().collection('employees');
    const employees = await employeesCollection.find({}).toArray();
    
    // Remove passwords from response and format
    const sanitizedEmployees = employees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || '',
      department: emp.department || null,
      role: emp.role,
      isActive: emp.isActive
    }));

    return res.json({
      success: true,
      employees: sanitizedEmployees
    });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load employees.'
    });
  }
});

// Create new employee (auto-sets role=EMPLOYEE, isActive=true)
app.post('/api/admin/employees', async (req, res) => {
  try {
    const { employeeId, name, password, email, department } = req.body;
    
    // Validate required fields
    if (!employeeId || !name || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, name, password, and department are required.'
      });
    }

    const employeesCollection = db().collection('employees');
    
    // Check for duplicate employee ID
    const existingEmployee = await employeesCollection.findOne({ employeeId });
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID already exists.'
      });
    }

    const newEmployee = {
      employeeId,
      name,
      password, // Keep plain text as requested
      email: email || '',
      department,
      role: 'EMPLOYEE', // Always EMPLOYEE, never allow creating ADMIN
      isActive: true,
      createdAt: new Date().toISOString()
    };

    await employeesCollection.insertOne(newEmployee);

    // Return sanitized employee data
    return res.json({
      success: true,
      message: 'Employee created successfully.',
      employee: {
        employeeId: newEmployee.employeeId,
        name: newEmployee.name,
        email: newEmployee.email,
        department: newEmployee.department,
        role: newEmployee.role,
        isActive: newEmployee.isActive
      }
    });
  } catch (error) {
    console.error('Failed to create employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create employee.'
    });
  }
});

// Update existing employee
app.put('/api/admin/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, email, department, password } = req.body;
    
    const employeesCollection = db().collection('employees');
    const existingEmployee = await employeesCollection.findOne({ employeeId });
    
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    // Build update object - only update provided fields
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (department) updateData.department = department;
    if (password) updateData.password = password; // Only update if password is provided
    
    // Never allow changing employeeId or role
    updateData.updatedAt = new Date().toISOString();

    await employeesCollection.updateOne(
      { employeeId },
      { $set: updateData }
    );

    // Get updated employee
    const updatedEmployee: any = await employeesCollection.findOne({ employeeId });
    
    if (!updatedEmployee) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated employee.'
      });
    }
    
    return res.json({
      success: true,
      message: 'Employee updated successfully.',
      employee: {
        employeeId: updatedEmployee.employeeId,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        department: updatedEmployee.department,
        role: updatedEmployee.role,
        isActive: updatedEmployee.isActive
      }
    });
  } catch (error) {
    console.error('Failed to update employee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee.'
    });
  }
});

// Update employee status (activate/deactivate)
app.patch('/api/admin/employees/:employeeId/status', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { isActive } = req.body;
    
    // Validate isActive is a boolean
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value.'
      });
    }
    
    const employeesCollection = db().collection('employees');
    const existingEmployee = await employeesCollection.findOne({ employeeId });
    
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }
    
    // Update the isActive status
    await employeesCollection.updateOne(
      { employeeId },
      { $set: { isActive, updatedAt: new Date().toISOString() } }
    );
    
    // Get updated employee
    const updatedEmployee: any = await employeesCollection.findOne({ employeeId });
    
    if (!updatedEmployee) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated employee.'
      });
    }
    
    const message = isActive 
      ? 'Employee activated successfully.' 
      : 'Employee deactivated successfully.';
    
    return res.json({
      success: true,
      message,
      employee: {
        employeeId: updatedEmployee.employeeId,
        name: updatedEmployee.name,
        isActive: updatedEmployee.isActive
      }
    });
  } catch (error) {
    console.error('Failed to update employee status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee status.'
    });
  }
});

// Get today's attendance (IST timezone)
app.get('/api/admin/attendance/today', async (req, res) => {
  try {
   // Get today's date directly in IST.
const dateStr = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
    
    const employeesCollection = db().collection('employees');
    const attendanceCollection = db().collection('attendance');
    
    // Get all active employees only
    const activeEmployees = await employeesCollection.find({ isActive: true }).toArray();
    
    // Get today's attendance records
    const todayAttendance = await attendanceCollection.find({ date: dateStr }).toArray();
    
    // Create a map of attendance records for quick lookup
    const attendanceMap = new Map();
    todayAttendance.forEach(record => {
      attendanceMap.set(record.employeeId, record);
    });
    
    // Combine employee data with attendance data
    const attendanceList = activeEmployees.map(employee => {
      const record = attendanceMap.get(employee.employeeId);
      const status = classifyAttendanceStatus(record?.checkIn);
      return {
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        status,
        checkIn: record?.checkIn || null,
        checkOut: record?.checkOut || null,
      };
    });

    // Calculate summary statistics
    const totalEmployees = activeEmployees.length;
    const present = attendanceList.filter(a => a.status === 'PRESENT').length;
    const late = attendanceList.filter(a => a.status === 'LATE').length;
    const checkedIn = attendanceList.filter(a => a.checkIn && !a.checkOut).length;
    const checkedOut = attendanceList.filter(a => a.checkIn && a.checkOut).length;
    const absent = attendanceList.filter(a => a.status === 'ABSENT').length;

    return res.json({
      success: true,
      date: dateStr,
      summary: {
        totalEmployees,
        present,
        late,
        checkedIn,
        checkedOut,
        absent,
      },
      attendance: attendanceList,
    });
  } catch (error) {
    console.error('Failed to fetch today\'s attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load today\'s attendance.'
    });
  }
});

async function startServer() {
  try {
    await mongoClient.connect();

    await db().command({ ping: 1 });

    console.log('MongoDB connected successfully.');
    console.log('Attendance collections ready.');
    // Recover notification jobs left processing after a backend crash.
const recoveryResult = await db()
  .collection('notification_jobs')
  .updateMany(
    {
      status: 'PROCESSING',
      lockedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
    },
    {
      $set: {
        status: 'PENDING',
        nextAttemptAt: new Date(),
      },
      $unset: {
        lockedAt: '',
      },
    },
  );

if (recoveryResult.modifiedCount > 0) {
  console.log(
    `Recovered ${recoveryResult.modifiedCount} stuck notification job(s).`,
  );
}
// Start the notification queue worker.
void processNotificationQueue();

setInterval(() => {
  void processNotificationQueue();
}, 5000);
    app.listen(PORT, () => {
      console.log(`Office Attendance API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
