
import { PermissionsAndroid, Platform } from 'react-native';
import { getMessaging, getToken, registerDeviceForRemoteMessages } from '@react-native-firebase/messaging';
import { API_BASE_URL } from './apiClient';

async function getFcmToken(): Promise<string | null> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      return null;
    }
  }

const messagingInstance = getMessaging();

await registerDeviceForRemoteMessages(messagingInstance);

return getToken(messagingInstance);
}

export async function registerAdminNotifications(
  employeeId: string,
  password: string,
): Promise<void> {
  const fcmToken = await getFcmToken();

  if (!fcmToken) {
    throw new Error('Notification permission was not granted.');
  }

  const response = await fetch(`${API_BASE_URL}/admin/fcm-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employeeId,
      password,
      fcmToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to register this device for notifications.');
  }
}
