import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type LocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message:
        'Office Attendance needs your location to verify that you are at the office.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const hasPermission = await requestLocationPermission();

  if (!hasPermission) {
    throw new Error('Location permission was denied.');
  }

  // First try with high accuracy
  try {
    return await new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        error => {
          reject(new Error(error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Shorter timeout for high accuracy
          maximumAge: 5000, // Don't use cached location older than 5 seconds
        },
      );
    });
  } catch (highAccuracyError) {
    // If high accuracy fails, fall back to low accuracy
    console.warn('High accuracy location failed, trying low accuracy:', highAccuracyError);
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        error => {
          reject(new Error(`Failed to get location even with low accuracy: ${error.message}`));
        },
        {
          enableHighAccuracy: false,
          timeout: 20000, // Longer timeout for low accuracy fallback
          maximumAge: 60000, // Allow cached location up to 1 minute old
        },
      );
    });
  }
}