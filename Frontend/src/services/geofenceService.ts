import { LocationResult } from './locationService';

export type OfficeLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const OFFICE_LOCATION: OfficeLocation = {
  latitude: 19.1788225,
  longitude: 72.8359387,
  radiusMeters: 100,
};

const MAX_LOCATION_ACCURACY_METERS = 100;

function calculateDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadius = 6371000;

  const lat1 = (latitude1 * Math.PI) / 180;
  const lat2 = (latitude2 * Math.PI) / 180;

  const deltaLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const deltaLon = ((longitude2 - longitude1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export function isWithinOffice(
  location: LocationResult,
): {
  isInside: boolean;
  distanceMeters: number;
  accuracyAccepted: boolean;
} {
  const distanceMeters = calculateDistanceMeters(
    location.latitude,
    location.longitude,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
  );

  const accuracyAccepted =
    location.accuracy <= MAX_LOCATION_ACCURACY_METERS;

  const isInside =
    distanceMeters <= OFFICE_LOCATION.radiusMeters &&
    accuracyAccepted;

  return {
    isInside,
    distanceMeters,
    accuracyAccepted,
  };
}