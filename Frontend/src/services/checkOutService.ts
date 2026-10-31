import { getCurrentLocation } from './locationService';
import { isWithinOffice } from './geofenceService';
import {
  getTodayAttendance,
  createCheckOut,
} from '../database/repositories/attendanceRepository';
import { addToSyncQueue } from '../database/repositories/syncQueueRepository';
export async function checkOutEmployee(employeeId: string) {
  // Check today's attendance first
  const attendance = await getTodayAttendance(employeeId);

  if (!attendance?.check_in) {
    throw new Error('You have not checked in today.');
  }

  if (attendance.check_out) {
    throw new Error('You have already checked out today.');
  }

  // Get current location
  const location = await getCurrentLocation();

  // Validate office location
  const geofenceResult = isWithinOffice(location);

  console.log('CHECK-OUT LOCATION:', {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    distanceMeters: geofenceResult.distanceMeters,
    accuracyAccepted: geofenceResult.accuracyAccepted,
    isInside: geofenceResult.isInside,
  });

  if (!geofenceResult.isInside) {
    if (!geofenceResult.accuracyAccepted) {
      throw new Error(
        `Location accuracy is too low (${location.accuracy.toFixed(
          0,
        )}m). Please try again.`,
      );
    }

    throw new Error(
      `You are ${geofenceResult.distanceMeters.toFixed(
        0,
      )}m away from the office. You must be within 100m to check out.`,
    );
  }

  await createCheckOut(
    employeeId,
    location.latitude,
    location.longitude,
    location.accuracy,
  );
const now = new Date().toISOString();
const eventId = `${employeeId}-CHECK_OUT-${Date.now()}`;

await addToSyncQueue(
  eventId,
  employeeId,
  'CHECK_OUT',
  {
    employeeId,
    date: now.split('T')[0],
    checkOut: now,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
  },
);
  return {
    location,
    distanceMeters: geofenceResult.distanceMeters,
  };
}