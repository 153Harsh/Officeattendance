import { getCurrentLocation } from './locationService';
import { isWithinOffice } from './geofenceService';
import {
  createCheckIn,
  createCheckOut,
  getTodayAttendance,
} from '../database/repositories/attendanceRepository';
import { addToSyncQueue } from '../database/repositories/syncQueueRepository';



export async function checkInEmployee(employeeId: string) {
  // Check if the employee has already checked in today
  const existingAttendance = await getTodayAttendance(employeeId);

  if (existingAttendance?.check_in) {
    throw new Error('You have already checked in today.');
  }

  const location = await getCurrentLocation();

  const geofenceResult = isWithinOffice(location);

  console.log('CHECK-IN LOCATION:', {
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
        )}m). Please try again from the office.`,
      );
    }

    throw new Error(
      `You are ${geofenceResult.distanceMeters.toFixed(
        0,
      )}m away from the office. You must be within 100m to check in.`,
    );
  }

  await createCheckIn(
    employeeId,
    location.latitude,
    location.longitude,
    location.accuracy,
  );
const eventId = `${employeeId}-CHECK_IN-${Date.now()}`;

await addToSyncQueue(
  eventId,
  employeeId,
  'CHECK_IN',
  {
    employeeId,
    date: new Date().toISOString().split('T')[0],
    checkIn: new Date().toISOString(),
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

export async function checkOutEmployee(employeeId: string) {
  const existingAttendance = await getTodayAttendance(employeeId);

  if (!existingAttendance?.check_in) {
    throw new Error('You have not checked in today.');
  }

  if (existingAttendance?.check_out) {
    throw new Error('You have already checked out today.');
  }

  const location = await getCurrentLocation();

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
        )}m). Please try again from the office.`,
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

  const eventId = `${employeeId}-CHECK_OUT-${Date.now()}`;

  await addToSyncQueue(
    eventId,
    employeeId,
    'CHECK_OUT',
    {
      employeeId,
      date: new Date().toISOString().split('T')[0],
      checkOut: new Date().toISOString(),
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